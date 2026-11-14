import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Actor } from '../identity/identity.js';
import { boolean, coordinates, cropId, historyData, name, objectBody, soilNotes } from './validation.js';
import { defaultWeights, normalizeWeights } from './priorities/normalize.js';

@Injectable()
export class FarmService {
  constructor(private readonly prisma: PrismaService) {}
  async parcel(id: string, actor: Actor) {
    const parcel = await this.prisma.parcel.findUnique({ where: { id }, include: { zones: { orderBy: { createdAt: 'asc' } } } });
    if (!parcel) throw new NotFoundException('Parcela inexistente');
    if (actor.role !== 'ADMIN' && parcel.ownerId !== actor.id) throw new ForbiddenException('Acceso denegado');
    return parcel;
  }
  async zone(id: string, actor: Actor) {
    const zone = await this.prisma.zone.findUnique({ where: { id }, include: { parcel: true, history: { orderBy: { plantedAt: 'desc' } } } });
    if (!zone) throw new NotFoundException('Zona inexistente');
    if (actor.role !== 'ADMIN' && zone.parcel.ownerId !== actor.id) throw new ForbiddenException('Acceso denegado');
    return zone;
  }
  list(actor: Actor) { return this.prisma.parcel.findMany({ where: actor.role === 'ADMIN' ? {} : { ownerId: actor.id }, include: { zones: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }); }
  createParcel(body: unknown, actor: Actor) {
    const input = objectBody(body, ['name', 'lat', 'lon', 'currentCropId', 'irrigated']);
    const point = coordinates(input.lat, input.lon);
    return this.prisma.parcel.create({ data: { name: name(input.name), ...point, ownerId: actor.id,
      zones: { create: { name: 'Zona principal', currentCropId: cropId(input.currentCropId), irrigated: input.irrigated === undefined ? false : boolean(input.irrigated) } } }, include: { zones: true } });
  }
  async updateParcel(id: string, body: unknown, actor: Actor) {
    const parcel = await this.parcel(id, actor);
    const input = objectBody(body, ['name', 'lat', 'lon']);
    const point = 'lat' in input || 'lon' in input ? coordinates(input.lat ?? parcel.lat, input.lon ?? parcel.lon) : {};
    return this.prisma.parcel.update({ where: { id }, data: { ...point, ...('name' in input ? { name: name(input.name) } : {}) }, include: { zones: true } });
  }
  async deleteParcel(id: string, actor: Actor) { await this.parcel(id, actor); await this.prisma.parcel.delete({ where: { id } }); }
  async createZone(parcelId: string, body: unknown, actor: Actor) {
    await this.parcel(parcelId, actor);
    return this.prisma.zone.create({ data: { parcelId, ...this.zoneData(body, false) } });
  }
  async updateZone(id: string, body: unknown, actor: Actor) {
    await this.zone(id, actor);
    return this.prisma.zone.update({ where: { id }, data: this.zoneData(body, true) });
  }
  private zoneData(body: unknown, patch: boolean) {
    const input = objectBody(body, ['name', 'currentCropId', 'lat', 'lon', 'irrigated', 'soilNotes']);
    const point = 'lat' in input || 'lon' in input ? input.lat === null && input.lon === null ? { lat: null, lon: null } : coordinates(input.lat, input.lon) : {};
    return { ...point, ...(!patch || 'name' in input ? { name: name(input.name) } : {}),
      ...(!patch || 'currentCropId' in input ? { currentCropId: cropId(input.currentCropId) } : {}),
      ...('irrigated' in input ? { irrigated: boolean(input.irrigated) } : {}),
      ...('soilNotes' in input ? { soilNotes: soilNotes(input.soilNotes) } : {}) } as { name: string; currentCropId: string; lat?: number | null; lon?: number | null; irrigated?: boolean; soilNotes?: string | null };
  }
  async deleteZone(id: string, actor: Actor) {
    const zone = await this.zone(id, actor);
    await this.prisma.$transaction(async tx => {
      // Serializa altas/bajas de zonas de la misma parcela antes de contar.
      await tx.$queryRaw`SELECT id FROM parcels WHERE id = ${zone.parcelId}::uuid FOR UPDATE`;
      const count = await tx.zone.count({ where: { parcelId: zone.parcelId } });
      if (count <= 1) throw new ConflictException('La parcela debe conservar al menos una zona');
      await tx.zone.delete({ where: { id } });
    });
  }
  async addHistory(zoneId: string, body: unknown, actor: Actor) {
    await this.zone(zoneId, actor);
    const input = objectBody(body, ['cropId', 'plantedAt', 'harvestedAt', 'yieldTonHa']);
    return this.prisma.cropHistory.create({ data: { zoneId, ...historyData(input) } });
  }
  async updateHistory(zoneId: string, id: string, body: unknown, actor: Actor) {
    const zone = await this.zone(zoneId, actor);
    const old = zone.history.find(h => h.id === id);
    if (!old) throw new NotFoundException('Historial inexistente');
    const input = objectBody(body, ['cropId', 'plantedAt', 'harvestedAt', 'yieldTonHa']);
    return this.prisma.cropHistory.update({ where: { id }, data: historyData({ cropId: old.cropId, plantedAt: old.plantedAt.toISOString(), harvestedAt: old.harvestedAt.toISOString(), yieldTonHa: old.yieldTonHa, ...input }) });
  }
  async deleteHistory(zoneId: string, id: string, actor: Actor) {
    const zone = await this.zone(zoneId, actor);
    if (!zone.history.some(h => h.id === id)) throw new NotFoundException('Historial inexistente');
    await this.prisma.cropHistory.delete({ where: { id } });
  }
  async priorities(userId: string) {
    const row = await this.prisma.priorities.findUnique({ where: { userId } });
    return row ? { water: row.water, soil: row.soil, income: row.income, risk: row.risk } : { ...defaultWeights };
  }
  async setPriorities(userId: string, body: unknown) {
    const weights = normalizeWeights(body);
    await this.prisma.priorities.upsert({ where: { userId }, create: { userId, ...weights }, update: weights });
    return weights;
  }
}

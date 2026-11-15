import { BadRequestException, ConflictException, HttpException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { FieldDevice, FieldReading, Prisma } from '../../generated/prisma/client.js';
import type { Actor } from '../identity/identity.js';
import { FarmService } from '../farm-context/farm.service.js';
import { name, objectBody } from '../farm-context/validation.js';
import { bounded, calibrated, measurementDate, readingInput, setting, uuid } from './validation.js';

const hash = (key: string) => createHash('sha256').update(key).digest('hex');
const credential = () => { const apiKey = randomBytes(32).toString('base64url'); return { apiKey, keyHash: hash(apiKey) }; };
type Tx = Prisma.TransactionClient;

export function deviceView(device: FieldDevice, now = Date.now()) {
  const { keyHash: _secret, ...safe } = device;
  void _secret;
  const ageSeconds = device.lastMeasuredAt ? Math.max(0, (now - device.lastMeasuredAt.getTime()) / 1000) : null;
  return { ...safe, ageSeconds, connection: device.status === 'REVOKED' ? 'revoked' as const
    : ageSeconds !== null && ageSeconds <= device.expectedIntervalSeconds * 3 ? 'online' as const : 'offline' as const };
}
function readingView(reading: FieldReading) {
  const { payloadHash: _hash, ...safe } = reading;
  void _hash;
  return safe;
}
function receipt(reading: FieldReading, duplicate: boolean) {
  return { accepted: true as const, duplicate, id: reading.id, readingId: reading.readingId,
    measuredAt: reading.measuredAt, receivedAt: reading.receivedAt, origin: reading.origin };
}

@Injectable()
export class SensorsService {
  private readonly logger = new Logger(SensorsService.name);
  private readonly rates = new Map<string, { until: number; count: number }>();
  constructor(private readonly prisma: PrismaService, private readonly farm: FarmService) {}

  private async locked(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM field_devices WHERE id = ${id}::uuid FOR UPDATE`;
    const device = await tx.fieldDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Dispositivo inexistente');
    return device;
  }
  private config(input: Record<string, unknown>, old?: FieldDevice) {
    const dryRaw = 'dryRaw' in input ? input.dryRaw === null ? null : bounded(input.dryRaw, 'dryRaw', 0, 4095, true) : old?.dryRaw ?? null;
    const wetRaw = 'wetRaw' in input ? input.wetRaw === null ? null : bounded(input.wetRaw, 'wetRaw', 0, 4095, true) : old?.wetRaw ?? null;
    if ((dryRaw === null) !== (wetRaw === null) || (dryRaw !== null && dryRaw === wetRaw)) throw new BadRequestException('Calibración requiere seco y húmedo distintos, o ambos nulos');
    return { name: 'name' in input ? name(input.name) : old!.name, dryRaw, wetRaw,
      depthCm: 'depthCm' in input ? input.depthCm === null ? null : bounded(input.depthCm, 'depthCm', 0, 200) : old?.depthCm ?? null,
      expectedIntervalSeconds: 'expectedIntervalSeconds' in input ? bounded(input.expectedIntervalSeconds, 'expectedIntervalSeconds', 30, 86400, true) : old?.expectedIntervalSeconds ?? 300,
      calibrationVersion: old ? old.calibrationVersion + Number(dryRaw !== old.dryRaw || wetRaw !== old.wetRaw) : 1 };
  }
  async create(body: unknown, actor: Actor) {
    const input = objectBody(body, ['zoneId', 'name', 'origin', 'expectedIntervalSeconds', 'dryRaw', 'wetRaw', 'depthCm']);
    const zoneId = uuid(input.zoneId);
    await this.farm.zone(zoneId, actor);
    if (!['REAL', 'SIMULATED'].includes(input.origin as string)) throw new BadRequestException('Origen REAL o SIMULATED requerido');
    if (!('name' in input)) throw new BadRequestException('Nombre requerido');
    const { apiKey, keyHash } = credential();
    const device = await this.prisma.fieldDevice.create({ data: { zoneId, origin: input.origin as 'REAL' | 'SIMULATED', keyHash, ...this.config(input) } });
    return { device: deviceView(device), apiKey };
  }
  async list(zoneId: string, actor: Actor) {
    await this.farm.zone(zoneId, actor);
    return (await this.prisma.fieldDevice.findMany({ where: { zoneId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).map(d => deviceView(d));
  }
  async update(id: string, body: unknown, actor: Actor) {
    const input = objectBody(body, ['zoneId', 'name', 'expectedIntervalSeconds', 'dryRaw', 'wetRaw', 'depthCm']);
    if ('zoneId' in input) await this.farm.zone(uuid(input.zoneId), actor);
    return this.prisma.$transaction(async tx => {
      const old = await this.locked(tx, id);
      return deviceView(await tx.fieldDevice.update({ where: { id }, data: { ...this.config(input, old),
        ...('zoneId' in input && uuid(input.zoneId) !== old.zoneId ? { zoneId: uuid(input.zoneId), lastMeasuredAt: null, lastReceivedAt: null } : {}) } }));
    });
  }
  async rotate(id: string) {
    return this.prisma.$transaction(async tx => {
      const old = await this.locked(tx, id);
      if (old.status !== 'ACTIVE') throw new ConflictException('Un dispositivo revocado no puede reactivarse');
      const { apiKey, keyHash } = credential();
      const device = await tx.fieldDevice.update({ where: { id }, data: { keyHash } });
      return { device: deviceView(device), apiKey };
    });
  }
  async revoke(id: string) {
    return this.prisma.$transaction(async tx => {
      await this.locked(tx, id);
      return deviceView(await tx.fieldDevice.update({ where: { id }, data: { status: 'REVOKED' } }));
    });
  }
  private keyHash(key: unknown): string {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(key)) throw new UnauthorizedException('Clave de dispositivo inválida');
    return hash(key);
  }
  async authenticate(key: unknown) {
    const keyHash = this.keyHash(key);
    const device = await this.prisma.fieldDevice.findUnique({ where: { keyHash } });
    if (!device || device.status !== 'ACTIVE') throw new UnauthorizedException('Clave de dispositivo inválida');
    const now = Date.now();
    for (const [id, rate] of this.rates) if (rate.until <= now) this.rates.delete(id);
    const rate = this.rates.get(device.id) ?? { until: now + 60000, count: 0 };
    if (++rate.count > 60) throw new HttpException('Demasiadas solicitudes del dispositivo', 429);
    this.rates.set(device.id, rate);
    return device;
  }
  async self(key: unknown) { return deviceView(await this.authenticate(key)); }
  async ingest(key: unknown, body: unknown, rawSize?: number) {
    if ((rawSize ?? Buffer.byteLength(JSON.stringify(body) ?? '')) > 4096) throw new HttpException('Lectura demasiado grande', 413);
    const authenticated = await this.authenticate(key);
    try {
      const input = readingInput(body);
      return await this.prisma.$transaction(async tx => {
        const device = await this.locked(tx, authenticated.id);
        if (device.status !== 'ACTIVE' || device.keyHash !== authenticated.keyHash) throw new UnauthorizedException('Clave de dispositivo inválida');
        const previous = await tx.fieldReading.findUnique({ where: { deviceId_readingId: { deviceId: device.id, readingId: input.readingId } } });
        if (previous) {
          if (previous.payloadHash !== input.payloadHash) throw new ConflictException('readingId ya usado con otro contenido');
          return receipt(previous, true);
        }
        const now = new Date(), age = now.getTime() - input.measuredAt.getTime();
        if (age < 0 || age > setting(process.env.READINGS_MAX_AGE_HOURS, 168) * 3600000) throw new BadRequestException('Fecha futura o demasiado antigua');
        const reading = await tx.fieldReading.create({ data: { ...input, deviceId: device.id, zoneId: device.zoneId, origin: device.origin,
          receivedAt: now, calibrationVersion: device.calibrationVersion, soilMoisture: calibrated(input.soilMoistureRaw, device.dryRaw, device.wetRaw) } });
        await tx.fieldDevice.update({ where: { id: device.id }, data: { lastReceivedAt: now,
          ...(!device.lastMeasuredAt || input.measuredAt > device.lastMeasuredAt ? { lastMeasuredAt: input.measuredAt } : {}) } });
        return receipt(reading, false);
      });
    } catch (error) {
      if (error instanceof HttpException) this.logger.warn(`Lectura rechazada: dispositivo=${authenticated.id}, motivo=${error.message}`);
      throw error;
    }
  }
  async readings(zoneId: string, actor: Actor, query: { from?: string; to?: string; limit?: string; cursor?: string }) {
    await this.farm.zone(zoneId, actor);
    const to = query.to ? measurementDate(query.to) : new Date();
    const from = query.from ? measurementDate(query.from) : new Date(to.getTime() - 7 * 86400000);
    const limit = query.limit === undefined ? 50 : /^\d+$/.test(query.limit) ? Number(query.limit) : NaN;
    if (from > to || to.getTime() - from.getTime() > 31 * 86400000 || !Number.isInteger(limit) || limit < 1 || limit > 200) throw new BadRequestException('Rango máximo 31 días y límite 1–200');
    const cursor = query.cursor ? uuid(query.cursor) : undefined;
    if (cursor) {
      const row = await this.prisma.fieldReading.findUnique({ where: { id: cursor } });
      if (!row || row.zoneId !== zoneId || row.measuredAt < from || row.measuredAt > to) throw new BadRequestException('Cursor fuera de la consulta');
    }
    const rows = await this.prisma.fieldReading.findMany({ where: { zoneId, measuredAt: { gte: from, lte: to } },
      orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }], take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    return { items: rows.slice(0, limit).map(readingView), nextCursor: rows.length > limit ? rows[limit - 1].id : null, from, to };
  }
}

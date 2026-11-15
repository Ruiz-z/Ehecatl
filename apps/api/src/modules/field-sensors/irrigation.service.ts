import { ConflictException, HttpException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { FarmService } from '../farm-context/farm.service.js';
import type { Actor } from '../identity/identity.js';
import { objectBody } from '../farm-context/validation.js';
import { bounded } from './validation.js';
import { deviceView, SensorsService } from './sensors.service.js';

type Tx = Prisma.TransactionClient;
const active = ['PENDING', 'DELIVERED'] as const;

@Injectable()
export class IrrigationService {
  private readonly logger = new Logger(IrrigationService.name);
  private readonly rates = new Map<string, { until: number; count: number }>();
  constructor(private readonly prisma: PrismaService, private readonly farm: FarmService, private readonly sensors: SensorsService) {}

  private async expire(tx: Tx, now: Date) {
    await tx.irrigationCommand.updateMany({ where: { status: 'PENDING', expiresAt: { lte: now } }, data: { status: 'EXPIRED', finishedAt: now } });
    // Sin reporte no se supone que la bomba nunca encendió.
    await tx.irrigationCommand.updateMany({ where: { status: 'DELIVERED', expiresAt: { lte: now } }, data: { status: 'FAILED', finishedAt: now } });
  }
  private async deviceLock(tx: Tx, id: string, keyHash?: string) {
    await tx.$queryRaw`SELECT id FROM field_devices WHERE id = ${id}::uuid FOR UPDATE`;
    const device = await tx.fieldDevice.findUniqueOrThrow({ where: { id } });
    if (keyHash && (device.status !== 'ACTIVE' || device.keyHash !== keyHash)) throw new UnauthorizedException('Clave de dispositivo inválida');
    return device;
  }
  async create(zoneId: string, body: unknown, actor: Actor) {
    await this.farm.zone(zoneId, actor);
    const input = objectBody(body, ['durationSeconds']);
    const durationSeconds = bounded(input.durationSeconds, 'durationSeconds', 1, 30, true);
    const stamp = Date.now();
    for (const [id, rate] of this.rates) if (rate.until <= stamp) this.rates.delete(id);
    const rate = this.rates.get(actor.id) ?? { until: stamp + 60000, count: 0 };
    this.rates.set(actor.id, rate);
    if (++rate.count > 10) throw new HttpException('Demasiadas solicitudes de riego', 429);
    await this.prisma.$transaction(tx => this.expire(tx, new Date()));
    return this.prisma.$transaction(async tx => {
      // Serializa también zonas con varios dispositivos y creaciones concurrentes.
      await tx.$queryRaw`SELECT id FROM zones WHERE id = ${zoneId}::uuid FOR UPDATE`;
      const candidates = await tx.fieldDevice.findMany({ where: { zoneId, status: 'ACTIVE' }, orderBy: { id: 'asc' } });
      const candidate = candidates.find(d => deviceView(d).connection === 'online');
      if (!candidate) throw new ConflictException('No hay dispositivo en línea');
      const device = await this.deviceLock(tx, candidate.id);
      if (device.zoneId !== zoneId || deviceView(device).connection !== 'online') throw new ConflictException('El dispositivo ya no está disponible');
      const now = new Date();
      const scope = { OR: [{ zoneId }, { deviceId: device.id }] };
      const busy = await tx.irrigationCommand.findFirst({ where: { ...scope, status: { in: [...active] } } });
      if (busy) throw new ConflictException('Ya hay una orden de riego activa');
      const recent = await tx.irrigationCommand.findFirst({ where: { ...scope, status: { in: ['DONE', 'FAILED'] }, finishedAt: { gt: new Date(now.getTime() - 300000) } } });
      if (recent) throw new ConflictException('Espera cinco minutos desde el final del último riego');
      const command = await tx.irrigationCommand.create({ data: { zoneId, deviceId: device.id, requestedByUserId: actor.id,
        durationSeconds, origin: device.origin, expiresAt: new Date(now.getTime() + 120000) } });
      this.logger.log(`Riego manual solicitado: orden=${command.id}, usuario=${actor.id}, zona=${zoneId}, segundos=${durationSeconds}, fecha=${now.toISOString()}`);
      return command;
    });
  }
  async history(zoneId: string, actor: Actor) {
    await this.farm.zone(zoneId, actor);
    return this.prisma.$transaction(async tx => {
      await this.expire(tx, new Date());
      return tx.irrigationCommand.findMany({ where: { zoneId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100,
        include: { requestedBy: { select: { id: true, name: true } } } });
    });
  }
  async cancel(id: string, actor: Actor) {
    const command = await this.prisma.irrigationCommand.findUnique({ where: { id } });
    if (!command) throw new NotFoundException('Orden inexistente');
    await this.farm.zone(command.zoneId, actor);
    const changed = await this.prisma.irrigationCommand.updateMany({ where: { id, status: 'PENDING', expiresAt: { gt: new Date() } }, data: { status: 'CANCELLED', finishedAt: new Date() } });
    if (!changed.count) throw new ConflictException('Solo puedes cancelar una orden pendiente vigente');
    this.logger.log(`Riego cancelado: orden=${id}, usuario=${actor.id}`);
    return { cancelled: true };
  }
  async next(key: unknown) {
    const authenticated = await this.sensors.authenticate(key);
    return this.prisma.$transaction(async tx => {
      const device = await this.deviceLock(tx, authenticated.id, authenticated.keyHash);
      const now = new Date();
      await this.expire(tx, now);
      const command = await tx.irrigationCommand.findFirst({ where: { deviceId: device.id, zoneId: device.zoneId, status: 'PENDING', expiresAt: { gt: now } }, orderBy: { createdAt: 'asc' } });
      if (!command) return null;
      const changed = await tx.irrigationCommand.updateMany({ where: { id: command.id, status: 'PENDING' }, data: { status: 'DELIVERED', deliveredAt: now } });
      if (!changed.count) return null;
      return { id: command.id, durationSeconds: command.durationSeconds, createdAt: command.createdAt, expiresAt: command.expiresAt };
    });
  }
  async result(id: string, key: unknown, body: unknown) {
    const authenticated = await this.sensors.authenticate(key);
    const input = objectBody(body, ['status', 'actualSeconds']);
    if (input.status !== 'DONE' && input.status !== 'FAILED') throw new ConflictException('Estado de resultado inválido');
    const status = input.status;
    const actualSeconds = bounded(input.actualSeconds, 'actualSeconds', 0, 30);
    return this.prisma.$transaction(async tx => {
      await this.deviceLock(tx, authenticated.id, authenticated.keyHash);
      const command = await tx.irrigationCommand.findUnique({ where: { id } });
      if (!command || command.deviceId !== authenticated.id) throw new NotFoundException('Orden inexistente');
      bounded(actualSeconds, 'actualSeconds', 0, command.durationSeconds);
      if (command.status === status && command.actualSeconds === actualSeconds) return { accepted: true };
      if (command.status !== 'DELIVERED') throw new ConflictException('La orden ya terminó o no fue entregada');
      if (status === 'DONE' && new Date() >= command.expiresAt) throw new ConflictException('La orden venció');
      await tx.irrigationCommand.update({ where: { id }, data: { status, actualSeconds, finishedAt: new Date() } });
      this.logger.log(`Resultado de riego: orden=${id}, estado=${status}, segundos=${actualSeconds}`);
      return { accepted: true };
    });
  }
}

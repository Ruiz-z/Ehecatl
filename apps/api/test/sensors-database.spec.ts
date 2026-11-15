import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { SensorsService } from '../src/modules/field-sensors/sensors.service.js';

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;
integration('Sensores con PostgreSQL: permisos, idempotencia, ciclo de claves e historial', () => {
  let app: INestApplication, prisma: PrismaService, deviceId: string, key: string, previousKey: string, revokedKey: string;
  const ownerId = randomUUID(), otherId = randomUUID(), adminId = randomUUID();
  const parcelId = randomUUID(), zoneId = randomUUID(), nextZoneId = randomUUID();
  const secret = 'sensors-integration-secret-at-least-thirty-two-bytes';
  const token = (id: string) => new JwtService({ secret }).sign({ sub: id });
  const env = { DATABASE_URL: process.env.DATABASE_URL, JWT_SECRET: process.env.JWT_SECRET };
  const sample = () => ({ readingId: randomUUID(), measuredAt: new Date(Date.now() - 1000).toISOString(), soilMoistureRaw: 1800, airTemperature: 24, airHumidity: 60, mq2Raw: 300 });
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL; process.env.JWT_SECRET = secret;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ rawBody: true }); await app.init(); prisma = module.get(PrismaService);
    for (const [id, role] of [[ownerId, 'FARMER'], [otherId, 'FARMER'], [adminId, 'ADMIN']] as const) await prisma.user.create({ data: { id, email: `${id}@sensors.invalid`, name: 'Prueba', role, passwordHash: 'not-a-login' } });
    await prisma.parcel.create({ data: { id: parcelId, ownerId, name: 'Sensores QA', lat: 0, lon: 0,
      zones: { create: [{ id: zoneId, name: 'Inicial', currentCropId: 'maize' }, { id: nextZoneId, name: 'Otra', currentCropId: 'cowpea' }] } } });
  }, 30000);
  afterAll(async () => {
    if (prisma) await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId, adminId] } } });
    await app?.close();
    for (const [name, value] of Object.entries(env)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  });
  it('solo admin registra y las consultas no exponen hash o claves', async () => {
    const body = { zoneId, name: 'Simulador', origin: 'SIMULATED' };
    await request(app.getHttpServer()).post('/devices').auth(token(ownerId), { type: 'bearer' }).send(body).expect(403);
    const result = await request(app.getHttpServer()).post('/devices').auth(token(adminId), { type: 'bearer' }).send(body).expect(201);
    deviceId = result.body.device.id; key = result.body.apiKey;
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(result.body.device).not.toHaveProperty('keyHash');
    expect((await prisma.fieldDevice.findUniqueOrThrow({ where: { id: deviceId } })).keyHash).not.toBe(key);
    await request(app.getHttpServer()).get(`/zones/${zoneId}/devices`).auth(token(otherId), { type: 'bearer' }).expect(403);
    const list = await request(app.getHttpServer()).get(`/zones/${zoneId}/devices`).auth(token(ownerId), { type: 'bearer' }).expect(200);
    expect(list.body[0]).not.toHaveProperty('keyHash'); expect(list.body[0]).not.toHaveProperty('apiKey');
    await request(app.getHttpServer()).get('/device').set('X-Device-Key', key).expect(200).expect(res => expect(res.body.origin).toBe('SIMULATED'));
  });
  it('rechaza clave ausente o falsa, campos ajenos, futuros, viejos y exceso de tamaño', async () => {
    for (const bad of ['', 'wrong', 'x'.repeat(43)]) await request(app.getHttpServer()).post('/readings').set('X-Device-Key', bad).send(sample()).expect(401);
    for (const change of [{ measuredAt: new Date(Date.now() + 3600000).toISOString() }, { measuredAt: new Date(Date.now() - 8 * 86400000).toISOString() }, { origin: 'REAL' }, { zoneId: nextZoneId }, { soilMoistureRaw: 4096 }]) await request(app.getHttpServer()).post('/readings').set('X-Device-Key', key).send({ ...sample(), ...change }).expect(400);
    await request(app.getHttpServer()).post('/readings').set('X-Device-Key', key).send({ ...sample(), unexpected: 'x'.repeat(4500) }).expect(413);
    expect(await prisma.fieldReading.count({ where: { deviceId } })).toBe(0);
  });
  it('reintentos concurrentes crean una muestra; sin calibrar conserva null y origen simulado', async () => {
    const body = sample();
    const results = await Promise.all([0, 1, 2].map(() => request(app.getHttpServer()).post('/readings').set('X-Device-Key', key).send(body).expect(200)));
    expect(results.filter(r => !r.body.duplicate)).toHaveLength(1);
    const row = await prisma.fieldReading.findFirstOrThrow({ where: { deviceId } });
    expect(row.soilMoisture).toBeNull(); expect(row.origin).toBe('SIMULATED');
    expect(results[0].body).not.toHaveProperty('decision');
    await request(app.getHttpServer()).post('/readings').set('X-Device-Key', key).send({ ...body, airTemperature: 25 }).expect(409);
    expect(await prisma.fieldReading.count({ where: { deviceId } })).toBe(1);
  });
  it('calibración versionada, lecturas fuera de intervalo y origen inmutable', async () => {
    await request(app.getHttpServer()).patch(`/devices/${deviceId}`).auth(token(ownerId), { type: 'bearer' }).send({ name: 'Ajeno' }).expect(403);
    for (const body of [{ dryRaw: 100 }, { dryRaw: 100, wetRaw: 100 }, { origin: 'REAL' }]) await request(app.getHttpServer()).patch(`/devices/${deviceId}`).auth(token(adminId), { type: 'bearer' }).send(body).expect(400);
    await request(app.getHttpServer()).patch(`/devices/${deviceId}`).auth(token(adminId), { type: 'bearer' }).send({ dryRaw: 3000, wetRaw: 600 }).expect(200);
    await request(app.getHttpServer()).post('/readings').set('X-Device-Key', key).send(sample()).expect(200);
    await request(app.getHttpServer()).post('/readings').set('X-Device-Key', key).send({ ...sample(), soilMoistureRaw: 4000 }).expect(400);
    const rows = await prisma.fieldReading.findMany({ where: { deviceId }, orderBy: { createdAt: 'asc' } });
    expect(rows[0].soilMoisture).toBeNull(); expect(rows[1].soilMoisture).toBe(0.5); expect(rows[1].calibrationVersion).toBe(2);
  });
  it('historial con permisos, paginación y cursor fuera de zona rechazado', async () => {
    await request(app.getHttpServer()).get(`/zones/${zoneId}/readings`).auth(token(otherId), { type: 'bearer' }).expect(403);
    const first = await request(app.getHttpServer()).get(`/zones/${zoneId}/readings?limit=1`).auth(token(ownerId), { type: 'bearer' }).expect(200);
    expect(first.body.items).toHaveLength(1); expect(first.body.nextCursor).toBeTruthy(); expect(first.body.items[0]).not.toHaveProperty('payloadHash');
    const second = await request(app.getHttpServer()).get(`/zones/${zoneId}/readings`).query({ from: first.body.from, to: first.body.to, limit: 1, cursor: first.body.nextCursor }).auth(token(ownerId), { type: 'bearer' }).expect(200);
    expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
    await request(app.getHttpServer()).get(`/zones/${nextZoneId}/readings`).query({ cursor: first.body.nextCursor }).auth(token(ownerId), { type: 'bearer' }).expect(400);
    await request(app.getHttpServer()).get(`/zones/${zoneId}/readings?limit=201`).auth(token(ownerId), { type: 'bearer' }).expect(400);
  });
  it('reasignar conserva historial en zona original y no marca fresca la nueva zona', async () => {
    await request(app.getHttpServer()).patch(`/devices/${deviceId}`).auth(token(adminId), { type: 'bearer' }).send({ zoneId: nextZoneId }).expect(200).expect(res => expect(res.body.connection).toBe('offline'));
    expect(await prisma.fieldReading.count({ where: { zoneId, deviceId } })).toBe(2);
    await request(app.getHttpServer()).post('/readings').set('X-Device-Key', key).send(sample()).expect(200);
    expect(await prisma.fieldReading.count({ where: { zoneId: nextZoneId, deviceId } })).toBe(1);
  });
  it('rotación y revocación invalidan la clave anterior inmediatamente', async () => {
    previousKey = key;
    const rotated = await request(app.getHttpServer()).post(`/devices/${deviceId}/rotate-key`).auth(token(adminId), { type: 'bearer' }).expect(200);
    key = rotated.body.apiKey;
    await request(app.getHttpServer()).post('/readings').set('X-Device-Key', previousKey).send(sample()).expect(401);
    await request(app.getHttpServer()).post('/readings').set('X-Device-Key', key).send(sample()).expect(200);
    revokedKey = key;
    await request(app.getHttpServer()).post(`/devices/${deviceId}/revoke`).auth(token(adminId), { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).post('/readings').set('X-Device-Key', revokedKey).send(sample()).expect(401);
    await request(app.getHttpServer()).post(`/devices/${deviceId}/rotate-key`).auth(token(adminId), { type: 'bearer' }).expect(409);
  });
  it('aplica límite de tasa a dispositivos conocidos', async () => {
    const result = await request(app.getHttpServer()).post('/devices').auth(token(adminId), { type: 'bearer' }).send({ zoneId, name: 'Límite', origin: 'SIMULATED' }).expect(201);
    const service = app.get(SensorsService);
    for (let n = 0; n < 60; n++) await service.self(result.body.apiKey);
    await request(app.getHttpServer()).get('/device').set('X-Device-Key', result.body.apiKey).expect(429);
  });
});

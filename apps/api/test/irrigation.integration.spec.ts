import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;
integration('RF-15 y RF-20 a RF-23: riego solo manual', () => {
  let app: INestApplication, prisma: PrismaService, deviceId: string, key: string, commandId: string;
  const owner = randomUUID(), other = randomUUID(), admin = randomUUID(), parcel = randomUUID(), zone = randomUUID();
  const secret = 'irrigation-test-secret-at-least-thirty-two-bytes';
  const token = (id: string) => new JwtService({ secret }).sign({ sub: id });
  const env = { DATABASE_URL: process.env.DATABASE_URL, JWT_SECRET: process.env.JWT_SECRET };
  const userPost = (id: string, seconds = 10) => request(app.getHttpServer()).post(`/zones/${zone}/irrigation-commands`).auth(token(id), { type: 'bearer' }).send({ durationSeconds: seconds });
  const next = () => request(app.getHttpServer()).get('/device/commands/next').set('X-Device-Key', key);
  const result = (id: string, seconds = 10) => request(app.getHttpServer()).post(`/device/commands/${id}/result`).set('X-Device-Key', key).send({ status: 'DONE', actualSeconds: seconds });
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL; process.env.JWT_SECRET = secret;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ rawBody: true }); await app.init(); prisma = module.get(PrismaService);
    for (const [id, role] of [[owner, 'FARMER'], [other, 'FARMER'], [admin, 'ADMIN']] as const) await prisma.user.create({ data: { id, role, email: `${id}@irrigation.invalid`, name: 'Prueba riego', passwordHash: 'not-a-login' } });
    await prisma.parcel.create({ data: { id: parcel, ownerId: owner, name: 'Riego QA', lat: 0, lon: 0, zones: { create: { id: zone, name: 'Zona', currentCropId: 'maize' } } } });
    const device = await request(app.getHttpServer()).post('/devices').auth(token(admin), { type: 'bearer' }).send({ zoneId: zone, name: 'Simulado QA', origin: 'SIMULATED' }).expect(201);
    deviceId = device.body.device.id; key = device.body.apiKey;
  }, 30000);
  afterAll(async () => {
    if (prisma) await prisma.user.deleteMany({ where: { id: { in: [owner, other, admin] } } });
    await app?.close();
    for (const [name, value] of Object.entries(env)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  });
  it('rechaza acceso ajeno, duración inválida y dispositivo sin señal', async () => {
    await userPost(other).expect(403);
    await request(app.getHttpServer()).get(`/zones/${zone}/irrigation-commands`).auth(token(other), { type: 'bearer' }).expect(403);
    for (const seconds of [0, 31, 1.5]) await userPost(owner, seconds).expect(400);
    await userPost(owner).expect(409);
    await request(app.getHttpServer()).post('/readings').set('X-Device-Key', key).send({ readingId: randomUUID(), measuredAt: new Date(Date.now() - 1000).toISOString(), soilMoistureRaw: 1800 }).expect(200);
  });
  it('serializa creación, entrega una sola vez y reporta con enfriamiento', async () => {
    const orders = await Promise.all([userPost(owner), userPost(admin)]);
    expect(orders.map(r => r.status).sort()).toEqual([201, 409]);
    commandId = orders.find(r => r.status === 201)!.body.id;
    expect(orders.find(r => r.status === 201)!.body.origin).toBe('SIMULATED');
    const deliveries = await Promise.all([next(), next()]);
    expect(deliveries.map(r => r.status).sort()).toEqual([200, 204]);
    expect(deliveries.find(r => r.status === 200)!.body.id).toBe(commandId);
    await result(commandId, 31).expect(400);
    await result(commandId).expect(200); await result(commandId).expect(200);
    await result(commandId, 9).expect(409);
    await userPost(owner).expect(409);
    const history = await request(app.getHttpServer()).get(`/zones/${zone}/irrigation-commands`).auth(token(admin), { type: 'bearer' }).expect(200);
    expect(history.body[0]).toMatchObject({ status: 'DONE', actualSeconds: 10, origin: 'SIMULATED', requestedBy: { name: 'Prueba riego' } });
    expect(history.body[0].requestedBy).not.toHaveProperty('passwordHash');
  });
  it('cancelación exige dueño o administrador y PENDING', async () => {
    await prisma.irrigationCommand.updateMany({ where: { zoneId: zone }, data: { finishedAt: new Date(Date.now() - 301000) } });
    const created = await userPost(admin).expect(201);
    await request(app.getHttpServer()).delete(`/irrigation-commands/${created.body.id}`).auth(token(other), { type: 'bearer' }).expect(403);
    await request(app.getHttpServer()).delete(`/irrigation-commands/${created.body.id}`).auth(token(owner), { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).delete(`/irrigation-commands/${created.body.id}`).auth(token(owner), { type: 'bearer' }).expect(409);
    await next().expect(204);
  });
  it('no entrega órdenes vencidas y cierra entregadas sin reporte', async () => {
    const created = await userPost(owner).expect(201);
    await prisma.irrigationCommand.update({ where: { id: created.body.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    await next().expect(204);
    expect((await prisma.irrigationCommand.findUniqueOrThrow({ where: { id: created.body.id } })).status).toBe('EXPIRED');
    const second = await userPost(admin).expect(201); await next().expect(200);
    await prisma.irrigationCommand.update({ where: { id: second.body.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    await userPost(owner).expect(409);
    expect((await prisma.irrigationCommand.findUniqueOrThrow({ where: { id: second.body.id } })).status).toBe('FAILED');
  });
  it('rechaza resultados de otro dispositivo y claves revocadas', async () => {
    const stranger = await request(app.getHttpServer()).post('/devices').auth(token(admin), { type: 'bearer' }).send({ zoneId: zone, name: 'Otro', origin: 'SIMULATED' }).expect(201);
    await request(app.getHttpServer()).post(`/device/commands/${commandId}/result`).set('X-Device-Key', stranger.body.apiKey).send({ status: 'DONE', actualSeconds: 10 }).expect(404);
    await request(app.getHttpServer()).post(`/devices/${deviceId}/revoke`).auth(token(admin), { type: 'bearer' }).expect(200);
    await next().expect(401); await result(commandId).expect(401);
  });
  it('limita a diez solicitudes válidas por usuario por minuto', async () => {
    const statuses: number[] = [];
    for (let n = 0; n < 11; n++) statuses.push((await userPost(owner)).status);
    expect(statuses).toContain(429);
    expect(statuses.every(status => status === 409 || status === 429)).toBe(true);
  });

});

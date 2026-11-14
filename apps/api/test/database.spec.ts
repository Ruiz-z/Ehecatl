import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID, createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { indicators } from './fixtures.js';

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;

integration('PostgreSQL real: RF ownership, CRUD, cascadas y caché', () => {
  let app: INestApplication, prisma: PrismaService, geo: Server;
  const userIds = [randomUUID(), randomUUID(), randomUUID()];
  const tokens: string[] = [];
  let parcelId: string, zoneId: string;
  const historyYear = new Date().getUTCFullYear()-1;
  const previousDatabase = process.env.DATABASE_URL, previousGeo = process.env.GEO_URL, previousSecret = process.env.JWT_SECRET;
  let cacheKey = '', sourceCalls = 0;
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET = 'integration-only-secret-at-least-thirty-two-bytes';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); await app.init(); prisma = module.get(PrismaService);
    const passwordHash = await bcrypt.hash('integration-test-password', 4);
    for (let n = 0; n < 3; n++) {
      const email = `${userIds[n]}@tests.invalid`;
      await prisma.user.create({ data: { id: userIds[n], name: `Test ${n}`, email, passwordHash, role: n === 2 ? 'ADMIN' : 'FARMER' } });
      const login = await request(app.getHttpServer()).post('/auth/login').send({ email, password: 'integration-test-password' }).expect(200);
      tokens.push(login.body.accessToken);
    }
  }, 30000);
  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      if (cacheKey) await prisma.nasaCache.deleteMany({ where: { key: cacheKey } });
    }
    await app?.close();
    if (geo) await new Promise<void>((resolve, reject) => geo.close(error => error ? reject(error) : resolve()));
    for (const [key, value] of Object.entries({ DATABASE_URL: previousDatabase, GEO_URL: previousGeo, JWT_SECRET: previousSecret })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }, 30000);
  it('persiste zona por defecto y aplica aislamiento entre dos agricultores y admin', async () => {
    const create = await request(app.getHttpServer()).post('/parcels').auth(tokens[0], { type: 'bearer' }).send({ name: 'Integración', lat: -33, lon: 140, currentCropId: 'maize' }).expect(201);
    parcelId = create.body.id; zoneId = create.body.zones[0].id;
    expect(create.body.ownerId).toBe(userIds[0]);
    expect(await prisma.zone.count({ where: { parcelId } })).toBe(1);
    await request(app.getHttpServer()).get(`/zones/${zoneId}`).auth(tokens[1], { type: 'bearer' }).expect(403);
    await request(app.getHttpServer()).get(`/zones/${zoneId}`).auth(tokens[2], { type: 'bearer' }).expect(200);
    const other = await request(app.getHttpServer()).get('/parcels').auth(tokens[1], { type: 'bearer' }).expect(200);
    expect(other.body).toEqual([]);
    await request(app.getHttpServer()).patch(`/parcels/${parcelId}`).auth(tokens[2], { type: 'bearer' }).send({ name: 'Editada por admin', lat: -34 }).expect(200);
    expect((await prisma.parcel.findUniqueOrThrow({ where: { id: parcelId } })).lat).toBe(-34);
  }, 30000);
  it('conserva al menos una zona y permite CRUD de historial y prioridades', async () => {
    await request(app.getHttpServer()).delete(`/zones/${zoneId}`).auth(tokens[0], { type: 'bearer' }).expect(409);
    const zone = await request(app.getHttpServer()).post(`/parcels/${parcelId}/zones`).auth(tokens[0], { type: 'bearer' }).send({ name: 'Segunda', lat: -35, lon: 141, currentCropId: 'cowpea', irrigated: true }).expect(201);
    const item = await request(app.getHttpServer()).post(`/zones/${zoneId}/history`).auth(tokens[0], { type: 'bearer' }).send({ cropId: 'wheat', plantedAt: `${historyYear}-01-01`, harvestedAt: `${historyYear}-05-01`, yieldTonHa: 3 }).expect(201);
    await request(app.getHttpServer()).patch(`/zones/${zoneId}/history/${item.body.id}`).auth(tokens[0], { type: 'bearer' }).send({ yieldTonHa: 4 }).expect(200);
    await request(app.getHttpServer()).patch(`/zones/${zone.body.id}`).auth(tokens[0], { type: 'bearer' }).send({ soilNotes: 'Suelo arenoso', lat: null, lon: null }).expect(200);
    expect((await prisma.zone.findUniqueOrThrow({ where: { id: zone.body.id } })).lat).toBeNull();
    await request(app.getHttpServer()).put('/me/priorities').auth(tokens[0], { type: 'bearer' }).send({ water: 10, soil: 20, income: 30, risk: 0 }).expect(200);
    const weights = await prisma.priorities.findUniqueOrThrow({ where: { userId: userIds[0] } });
    expect(weights.water+weights.soil+weights.income+weights.risk).toBe(100);
    await request(app.getHttpServer()).delete(`/zones/${zone.body.id}`).auth(tokens[0], { type: 'bearer' }).expect(204);
  }, 30000);
  it('cache miss/hit persiste en Postgres y recomienda por HTTP con los tres insumos', async () => {
    geo = createServer((req, res) => {
      sourceCalls++;
      const query = new URL(req.url!, 'http://localhost').searchParams;
      const data = indicators();
      data.point = { lat: Number(query.get('lat')), lon: Number(query.get('lon')) };
      data.period = { start: query.get('start')!, end: query.get('end')! };
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data));
      cacheKey = createHash('sha256').update(`indicators:v1:${query}`).digest('hex');
    });
    await new Promise<void>(resolve => geo.listen(0, '127.0.0.1', resolve));
    const address = geo.address();
    process.env.GEO_URL = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
    for (const origin of ['live', 'cache']) {
      const result = await request(app.getHttpServer()).get(`/zones/${zoneId}/recommendations`).auth(tokens[0], { type: 'bearer' }).expect(200);
      expect(result.body.origin).toBe(origin); expect(result.body.recommendations.length).toBeGreaterThan(0);
      expect(result.body.inputs.historyCount).toBe(1);
    }
    expect(sourceCalls).toBe(1);
    expect(await prisma.nasaCache.findUnique({ where: { key: cacheKey } })).not.toBeNull();
  }, 30000);
  it('borra parcela en cascada y rechaza al dueño ajeno antes de borrar', async () => {
    await request(app.getHttpServer()).delete(`/parcels/${parcelId}`).auth(tokens[1], { type: 'bearer' }).expect(403);
    await request(app.getHttpServer()).delete(`/parcels/${parcelId}`).auth(tokens[2], { type: 'bearer' }).expect(204);
    expect(await prisma.zone.count({ where: { parcelId } })).toBe(0);
    expect(await prisma.cropHistory.count({ where: { zoneId } })).toBe(0);
  }, 30000);
});

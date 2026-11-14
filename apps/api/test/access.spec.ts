import { INestApplication, Controller, Get, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { AuthGuard, IdentityModule, IdentityService, Roles } from '../src/modules/identity/identity.js';
import { historyData } from '../src/modules/farm-context/validation.js';
import { NasaService } from '../src/modules/nasa-data/nasa.service.js';
import { indicators } from './fixtures.js';

const ownerId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const adminId = '00000000-0000-4000-8000-000000000003';
const parcelId = '00000000-0000-4000-8000-000000000004';
const zoneId = '00000000-0000-4000-8000-000000000005';
const secret = 'test-only-secret-at-least-thirty-two-bytes';

@Controller('admin-test') @UseGuards(AuthGuard)
class AdminController {
  @Get() @Roles('ADMIN') index() { return { ok: true }; }
}

describe('B2–B5/B17 HTTP real de Nest, persistencia simulada', () => {
  let app: INestApplication, identity: IdentityService;
  const users = [
    { id: ownerId, email: 'owner@test.invalid', name: 'Owner', role: 'FARMER', passwordHash: '' },
    { id: otherId, email: 'other@test.invalid', name: 'Other', role: 'FARMER', passwordHash: '' },
    { id: adminId, email: 'admin@test.invalid', name: 'Admin', role: 'ADMIN', passwordHash: '' },
  ];
  const parcel = { id: parcelId, ownerId, name: 'Parcela', lat: 0, lon: 0, zones: [{ id: zoneId }] };
  const zone = { id: zoneId, parcelId, name: 'Zona', lat: null, lon: null, currentCropId: 'maize', irrigated: true, parcel, history: [] };
  const priorities = { water: 100, soil: 0, income: 0, risk: 0 };
  const createCalls: unknown[][] = [], deleteCalls: unknown[][] = [], priorityCalls: unknown[][] = [];
  const prisma = {
    user: { findUnique: async ({ where }: { where: { email?: string; id?: string } }) => users.find(u => where.email ? u.email === where.email : u.id === where.id) ?? null },
    parcel: {
      findUnique: async ({ where }: { where: { id: string } }) => where.id === parcelId ? parcel : null,
      findMany: async ({ where }: { where: { ownerId?: string } }) => !where.ownerId || where.ownerId === ownerId ? [parcel] : [],
      create: async (data: unknown) => { createCalls.push([data]); return data; },
      delete: async (...args: unknown[]) => { deleteCalls.push(args); return parcel; },
    },
    zone: { findUnique: async ({ where }: { where: { id: string } }) => where.id === zoneId ? zone : null },
    priorities: { findUnique: async (...args: unknown[]) => { priorityCalls.push(args); return priorities; }, upsert: async () => priorities },
  };
  const token = (id: string, expiresIn = 3600) => new JwtService({ secret }).sign({ sub: id }, { expiresIn });
  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    const hash = await bcrypt.hash('testing-password', 4);
    users.forEach(user => { user.passwordHash = hash; });
    const module = await Test.createTestingModule({ imports: [AppModule, IdentityModule], controllers: [AdminController] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(NasaService).useValue({ get: async () => indicators() }).compile();
    app = module.createNestApplication(); await app.init(); identity = module.get(IdentityService);
  });
  afterAll(async () => { await app?.close(); });
  it('login devuelve JWT y datos públicos, bcrypt verifica el hash', async () => {
    const result = await request(app.getHttpServer()).post('/auth/login').send({ email: 'OWNER@test.invalid', password: 'testing-password' }).expect(200);
    expect(result.body.user.id).toBe(ownerId); expect(result.body.user.passwordHash).toBeUndefined();
    expect(new JwtService({ secret }).verify(result.body.accessToken).sub).toBe(ownerId);
  });
  it('servicio identity verifica credenciales y rechaza usuario inexistente o firma incorrecta', async () => {
    const login = await identity.login({ email: users[0].email, password: 'testing-password' });
    expect((await identity.authenticate(login.accessToken)).id).toBe(ownerId);
    await expect(identity.authenticate(token('00000000-0000-4000-8000-999999999999'))).rejects.toThrow('Sesión');
    await expect(identity.authenticate(new JwtService({ secret: 'wrong' }).sign({ sub: ownerId }))).rejects.toThrow('Sesión');
    await expect(identity.login({ email: users[0].email, password: 'bad' })).rejects.toThrow('Credenciales');
  });
  it('credenciales malas dan el mismo 401 genérico', async () => {
    const bad = await request(app.getHttpServer()).post('/auth/login').send({ email: users[0].email, password: 'wrong' }).expect(401);
    const unknown = await request(app.getHttpServer()).post('/auth/login').send({ email: 'none@test.invalid', password: 'wrong' }).expect(401);
    expect(bad.body).toEqual(unknown.body);
  });
  it('token ausente, malformado o expirado devuelve 401', async () => {
    for (const value of ['', 'Bearer invalid', `Bearer ${token(ownerId, -1)}`]) await request(app.getHttpServer()).get('/parcels').set('Authorization', value).expect(401);
  });
  it('cada agricultor lista solo lo suyo y el admin ve todas', async () => {
    for (const [id, count] of [[ownerId, 1], [otherId, 0], [adminId, 1]] as const) {
      const result = await request(app.getHttpServer()).get('/parcels').auth(token(id), { type: 'bearer' }).expect(200);
      expect(result.body).toHaveLength(count);
    }
  });
  it.each(['/parcels/'+parcelId, '/zones/'+zoneId, '/zones/'+zoneId+'/history', '/zones/'+zoneId+'/recommendations', '/zones/'+zoneId+'/indicators'])('ownership protege %s', async path => {
    await request(app.getHttpServer()).get(path).auth(token(otherId), { type: 'bearer' }).expect(403);
    await request(app.getHttpServer()).get(path).auth(token(ownerId), { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).get(path).auth(token(adminId), { type: 'bearer' }).expect(200);
  });
  it('decorador de rol restringe acceso a admin', async () => {
    await request(app.getHttpServer()).get('/admin-test').auth(token(ownerId), { type: 'bearer' }).expect(403);
    await request(app.getHttpServer()).get('/admin-test').auth(token(adminId), { type: 'bearer' }).expect(200);
  });
  it('rechaza coordenadas fuera de rango, tipos y cultivos desconocidos', async () => {
    for (const change of [{ lat: 91 }, { lon: -181 }, { lat: '20' }, { lat: null }, { currentCropId: 'unknown' }, { ownerId: otherId }]) {
      await request(app.getHttpServer()).post('/parcels').auth(token(ownerId), { type: 'bearer' }).send({ name: 'Test', lat: 0, lon: 0, currentCropId: 'maize', ...change }).expect(400);
    }
  });
  it('crea parcela con dueño y zona por defecto sin limitar región', async () => {
    await request(app.getHttpServer()).post('/parcels').auth(token(ownerId), { type: 'bearer' }).send({ name: 'Sur', lat: -33, lon: 140, currentCropId: 'maize' }).expect(201);
    const args = createCalls.at(-1)![0] as { data: { ownerId: string; zones: { create: unknown } } };
    expect(args.data.ownerId).toBe(ownerId); expect(args.data.zones.create).toBeDefined();
  });
  it('expone fuentes de cada cultivo y normaliza prioridades por HTTP', async () => {
    const result = await request(app.getHttpServer()).get('/crops').auth(token(ownerId), { type: 'bearer' }).expect(200);
    expect(result.body).toHaveLength(18); expect(result.body[0].sourceLinks[0].url).toMatch(/^https:/);
    await request(app.getHttpServer()).put('/me/priorities').auth(token(ownerId), { type: 'bearer' }).send({ water: 1, soil: 1, income: 1, risk: 0 }).expect(200).expect({ water: 34, soil: 33, income: 33, risk: 0 });
  });
  it('admin recomienda con prioridades del dueño y tres insumos', async () => {
    priorityCalls.length = 0;
    const result = await request(app.getHttpServer()).get(`/zones/${zoneId}/recommendations`).auth(token(adminId), { type: 'bearer' }).expect(200);
    expect(priorityCalls).toEqual([[{ where: { userId: ownerId } }]]);
    expect(result.body.inputs.currentCropId).toBe('maize'); expect(result.body.inputs.indicators.origin).toBe('live');
    expect(result.body.recommendations.length).toBeGreaterThan(0); expect(result.body.priorities).toEqual(priorities);
  });
  it('mutaciones ajenas se rechazan antes de escribir', async () => {
    await request(app.getHttpServer()).delete(`/parcels/${parcelId}`).auth(token(otherId), { type: 'bearer' }).expect(403);
    await request(app.getHttpServer()).patch(`/zones/${zoneId}`).auth(token(otherId), { type: 'bearer' }).send({ name: 'Hacked' }).expect(403);
    await request(app.getHttpServer()).post(`/zones/${zoneId}/history`).auth(token(otherId), { type: 'bearer' }).send({}).expect(403);
    expect(deleteCalls).toHaveLength(0);
  });
  it('fechas reales, orden de cosecha y catálogo válidos', () => {
    expect(() => historyData({ cropId: 'maize', plantedAt: '2024-02-30', harvestedAt: '2024-05-01' })).toThrow('Fecha');
    expect(() => historyData({ cropId: 'maize', plantedAt: '2024-06-01', harvestedAt: '2024-05-01' })).toThrow('Cosecha');
    expect(() => historyData({ cropId: 'unknown', plantedAt: '2024-01-01', harvestedAt: '2024-05-01' })).toThrow('Cultivo');
  });
});

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { NasaService } from '../src/modules/nasa-data/nasa.service.js';
import { recommend } from '../src/modules/rotation-engine/engine/sequences.js';
import { defaultWeights } from '../src/modules/farm-context/priorities/normalize.js';
import { crops, findCrop } from '../src/modules/crop-knowledge/crop-catalog.js';
import { indicators } from './fixtures.js';

const secret = 'qa-audit-test-secret-at-least-32-bytes';

describe('QA Audit — Contratos, Seguridad, Edge Cases y Motor', () => {
  let app: INestApplication;
  const userId = '00000000-0000-4000-8000-000000000101';
  const parcelId = '00000000-0000-4000-8000-000000000102';
  const zoneId = '00000000-0000-4000-8000-000000000103';
  const nasaCalls: unknown[][] = [];

  const user = { id: userId, email: 'qa@test.invalid', name: 'QA Farmer', role: 'FARMER', passwordHash: '' };
  const parcel = { id: parcelId, ownerId: userId, name: 'QA Parcel', lat: 19.17, lon: -96.13, zones: [{ id: zoneId }] };
  const zone = { id: zoneId, parcelId, name: 'Zona principal', lat: null, lon: null, currentCropId: 'maize', irrigated: false, parcel, history: [] };

  const prisma = {
    user: { findUnique: async ({ where }: { where: { email?: string; id?: string } }) => (where.email === user.email || where.id === user.id ? user : null) },
    parcel: {
      findUnique: async ({ where }: { where: { id: string } }) => (where.id === parcelId ? parcel : null),
      findMany: async () => [parcel],
    },
    zone: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === zoneId ? zone : null) },
    cropHistory: { create: async (args: unknown) => args },
    priorities: { findUnique: async () => null },
  };

  const token = (sub = userId, options?: { expiresIn?: number; customSecret?: string }) =>
    new JwtService({ secret: options?.customSecret ?? secret }).sign({ sub }, { expiresIn: options?.expiresIn ?? 3600 });

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    user.passwordHash = await bcrypt.hash('ValidPassword123', 4);
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(NasaService).useValue({
        get: async (...args: unknown[]) => {
          nasaCalls.push(args);
          return indicators();
        },
      })
      .compile();
    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('QA: rechaza password > 72 bytes, body no-objeto y JWT alg=none con 401', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({ email: user.email, password: 'a'.repeat(73) }).expect(401);
    await request(app.getHttpServer()).post('/auth/login').send(['bad']).expect(401);
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId })).toString('base64url')}.`;
    await request(app.getHttpServer()).get('/parcels').set('Authorization', `Bearer ${unsigned}`).expect(401);
  });

  it('QA: ParseUUIDPipe devuelve 400 para IDs no UUID y 404 para UUID inexistente', async () => {
    await request(app.getHttpServer()).get('/parcels/not-a-uuid').auth(token(), { type: 'bearer' }).expect(400);
    await request(app.getHttpServer()).get('/zones/not-a-uuid/recommendations').auth(token(), { type: 'bearer' }).expect(400);
    await request(app.getHttpServer()).get(`/parcels/${randomUUID()}`).auth(token(), { type: 'bearer' }).expect(404);
    await request(app.getHttpServer()).get(`/zones/${randomUUID()}/recommendations`).auth(token(), { type: 'bearer' }).expect(404);
  });

  it('QA: rechaza coordenadas parciales (solo lat sin lon) y fechas inexistentes en historial', async () => {
    await request(app.getHttpServer()).post(`/parcels/${parcelId}/zones`).auth(token(), { type: 'bearer' })
      .send({ name: 'Z2', currentCropId: 'maize', lat: 19.2 }).expect(400);
    await request(app.getHttpServer()).post(`/parcels/${parcelId}/zones`).auth(token(), { type: 'bearer' })
      .send({ name: 'Z2', currentCropId: 'maize', lat: null }).expect(400);
    await request(app.getHttpServer()).post(`/zones/${zoneId}/history`).auth(token(), { type: 'bearer' })
      .send({ cropId: 'maize', plantedAt: '2025-02-29', harvestedAt: '2025-05-01' }).expect(400);
    await request(app.getHttpServer()).post(`/zones/${zoneId}/history`).auth(token(), { type: 'bearer' })
      .send({ cropId: 'maize', plantedAt: '2024-02-29', harvestedAt: '2024-06-01', yieldTonHa: -1 }).expect(400);
  });

  it('QA: GET /zones/:id/indicators?start=&end= (query vacío según docs/contracts.md) debe usar periodo por defecto', async () => {
    const mockPrisma = { nasaCache: { findUnique: async () => ({ payload: indicators(), expiresAt: new Date(Date.now() + 60_000) }) } } as unknown as PrismaService;
    const realNasa = new NasaService(mockPrisma);
    // Simula lo que hace NasaController pasando @Query('start')='' y @Query('end')=''
    await expect(realNasa.get(19.17, -96.13, false, '', '')).resolves.toMatchObject({ version: 1 });
  });

  it('QA: Geo timeout vacío en env (GEO_TIMEOUT_MS="") no debe abortar instantáneamente con timeout=0', async () => {
    const prev = process.env.GEO_TIMEOUT_MS;
    const prevGeo = process.env.GEO_URL;
    process.env.GEO_TIMEOUT_MS = '';
    let receivedSignalAborted = false;
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      receivedSignalAborted = Boolean(init?.signal?.aborted);
      await new Promise(r => setTimeout(r, 20));
      if (init?.signal?.aborted) throw new Error('Aborted immediately');
      return new Response(JSON.stringify(indicators()));
    };
    try {
      const mockPrisma = {
        nasaCache: { findUnique: async () => null, upsert: async () => null },
      } as unknown as PrismaService;
      const service = new NasaService(mockPrisma);
      const data = await service.get(0, 0, false, '2024-01-01', '2024-12-31');
      expect(receivedSignalAborted).toBe(false);
      expect(data.version).toBe(1);
    } finally {
      globalThis.fetch = realFetch;
      if (prev === undefined) delete process.env.GEO_TIMEOUT_MS; else process.env.GEO_TIMEOUT_MS = prev;
      if (prevGeo === undefined) delete process.env.GEO_URL; else process.env.GEO_URL = prevGeo;
    }
  });

  it('QA Motor (Spec-005 RF-1): zona tropical/continua (1 ventana de 730 días) debería recomendar secuencia de 2–3 ciclos, no 1 solo cultivo', () => {
    const data = indicators();
    data.windows = [{
      id: 'window-1',
      start: '2025-01-01',
      end: '2026-12-31',
      months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      durationDays: 730,
      temperatureMin: 18,
      temperatureMax: 31,
      meanTemperature: 25,
      precipitationMm: 2800,
      irrigated: false,
    }];
    data.climatology = Array.from({ length: 12 }, (_, i) => [
      { variable: 'T2M', month: i + 1, value: 25, samples: 10, unit: 'C' },
      { variable: 'T2M_MIN', month: i + 1, value: 19, samples: 10, unit: 'C' },
      { variable: 'T2M_MAX', month: i + 1, value: 30, samples: 10, unit: 'C' },
      { variable: 'PRECTOTCORR', month: i + 1, value: 120, samples: 10, unit: 'mm/month' },
    ]).flat();

    const result = recommend({ currentCropId: 'maize', history: [], priorities: defaultWeights, indicators: data });
    expect(result.status).toBe('ok');
    expect(result.recommendations[0].sequence.length).toBeGreaterThanOrEqual(2);
  });

  it('QA Motor (Spec-005 RF-4): riesgo alto por sequía debe sugerir cultivo más tolerante a sequía como primera opción', () => {
    const data = indicators();
    data.windows.forEach(w => { w.irrigated = true; });
    data.trends = [
      { type: 'drought', active: true, evidence: ['Lluvia >=25% bajo la normal; -45.00'] },
      { type: 'heat', active: true, evidence: ['Temperatura >=2 C sobre la normal; 2.80'] },
    ];
    const current = findCrop('maize')!;
    const result = recommend({
      currentCropId: current.id,
      history: [],
      priorities: { water: 25, soil: 25, income: 25, risk: 25 },
      indicators: data,
    });
    expect(result.currentCropRisk.level).toBe('high');
    expect(result.currentCropRisk.changeAt).not.toBeNull();
    const firstRecommended = findCrop(result.recommendations[0].sequence[0].cropId)!;
    expect(firstRecommended.droughtTolerance).toBeGreaterThan(current.droughtTolerance);
  });

  it('QA Motor (deduplicación): si una secuencia de cropIds aparece dos veces en el haz, debe conservar el mayor puntaje', () => {
    const data = indicators();
    // Ventana 1 muy húmeda (buena), Ventana 2 imposible (3 días), Ventana 3 menos favorable pero viable.
    // Ambos caminos producen secuencias cortas; si algún id colisiona en unique Map, nunca debe bajar el puntaje.
    data.windows = [
      { ...data.windows[0], id: 'w1', start: '2025-02-01', end: '2025-07-31', durationDays: 181, precipitationMm: 700, meanTemperature: 22 },
      { ...data.windows[0], id: 'w2', start: '2025-08-01', end: '2025-08-03', durationDays: 3, precipitationMm: 50, meanTemperature: 22 },
      { ...data.windows[0], id: 'w3', start: '2026-02-01', end: '2026-07-31', durationDays: 181, precipitationMm: 700, meanTemperature: 22 },
    ];
    const smallCatalog = [findCrop('cowpea')!, findCrop('sorghum')!];
    const result = recommend({ currentCropId: 'maize', history: [], priorities: defaultWeights, indicators: data }, smallCatalog);
    for (let i = 1; i < result.recommendations.length; i++) {
      expect(result.recommendations[i - 1].score).toBeGreaterThanOrEqual(result.recommendations[i].score);
    }
    expect(crops.length).toBe(18);
  });
});

const liveApi = process.env.QA_API_URL ? describe : describe.skip;

liveApi('QA E2E Live — Stack Real (PostgreSQL + Geo + API)', () => {
  const apiUrl = process.env.QA_API_URL!;
  const password = process.env.SEED_DEMO_PASSWORD!;
  const createdParcelIds: string[] = [];

  async function api(path: string, init?: RequestInit & { token?: string }) {
    const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
    if (init?.token) headers.Authorization = `Bearer ${init.token}`;
    if (init?.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${apiUrl}${path}`, { ...init, headers });
    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, body: json as any, headers: res.headers };
  }

  async function login(email: string, pwd = password) {
    const res = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: pwd }) });
    return res;
  }

  afterAll(async () => {
    try {
      const admin = await login('admin@demo.ehecatl');
      const token = admin.body?.accessToken;
      if (token) {
        for (const id of createdParcelIds) {
          await api(`/parcels/${id}`, { method: 'DELETE', token });
        }
      }
      // Restaurar prioridades originales de coahuila
      const coahuila = await login('coahuila@demo.ehecatl');
      if (coahuila.body?.accessToken) {
        await api('/me/priorities', {
          method: 'PUT',
          token: coahuila.body.accessToken,
          body: JSON.stringify({ water: 60, soil: 20, income: 10, risk: 10 }),
        });
      }
    } catch {
      // No ocultar resultados de tests por cleanup
    }
  });

  it('E2E Health & Auth: login de los 4 usuarios seeded (case-insensitive), 401 genérico y rutas protegidas', async () => {
    const health = await api('/health');
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok' });

    for (const email of ['ADMIN@demo.ehecatl', 'coahuila@demo.ehecatl', 'nevada@demo.ehecatl', 'mendoza@demo.ehecatl']) {
      const res = await login(email);
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.tokenType).toBe('Bearer');
      expect(res.body.expiresIn).toBe(3600);
      expect(res.body.user.passwordHash).toBeUndefined();
    }

    const wrongPwd = await login('coahuila@demo.ehecatl', 'WrongPassword123');
    const unknownEmail = await login('nobody@demo.ehecatl', 'WrongPassword123');
    expect(wrongPwd.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPwd.body).toEqual(unknownEmail.body);

    expect((await api('/parcels')).status).toBe(401);
    expect((await api('/crops')).status).toBe(401);
    expect((await api('/me/priorities')).status).toBe(401);
  });

  it('E2E Catálogo: GET /crops devuelve 18 cultivos con fuentes válidas', async () => {
    const { body: auth } = await login('coahuila@demo.ehecatl');
    const res = await api('/crops', { token: auth.accessToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(18);
    for (const crop of res.body) {
      expect(crop.sourceLinks.length).toBeGreaterThan(0);
      expect(crop.sourceLinks.every((s: { url: string }) => s.url.startsWith('https://'))).toBe(true);
    }
  });

  it('E2E Ownership (Spec-001 RF-4/5): aislamiento estricto entre agricultores y lectura/uso de prioridades del dueño por admin', async () => {
    const coahuilaToken = (await login('coahuila@demo.ehecatl')).body.accessToken;
    const nevadaToken = (await login('nevada@demo.ehecatl')).body.accessToken;
    const adminToken = (await login('admin@demo.ehecatl')).body.accessToken;

    const nevadaParcels = (await api('/parcels', { token: nevadaToken })).body;
    expect(nevadaParcels).toHaveLength(1);
    const nevadaParcelId = nevadaParcels[0].id;
    const nevadaZoneId = nevadaParcels[0].zones[0].id;

    // Coahuila no ve parcelas de Nevada y recibe 403 en cada recurso ajeno
    const coahuilaParcels = (await api('/parcels', { token: coahuilaToken })).body;
    expect(coahuilaParcels.some((p: { id: string }) => p.id === nevadaParcelId)).toBe(false);

    for (const [method, path, body] of [
      ['GET', `/parcels/${nevadaParcelId}`, undefined],
      ['PATCH', `/parcels/${nevadaParcelId}`, { name: 'Hack' }],
      ['DELETE', `/parcels/${nevadaParcelId}`, undefined],
      ['GET', `/parcels/${nevadaParcelId}/zones`, undefined],
      ['POST', `/parcels/${nevadaParcelId}/zones`, { name: 'HackZ', currentCropId: 'maize' }],
      ['GET', `/zones/${nevadaZoneId}`, undefined],
      ['PATCH', `/zones/${nevadaZoneId}`, { name: 'HackZ' }],
      ['DELETE', `/zones/${nevadaZoneId}`, undefined],
      ['GET', `/zones/${nevadaZoneId}/history`, undefined],
      ['POST', `/zones/${nevadaZoneId}/history`, { cropId: 'maize', plantedAt: '2025-01-01', harvestedAt: '2025-05-01' }],
      ['GET', `/zones/${nevadaZoneId}/indicators`, undefined],
      ['GET', `/zones/${nevadaZoneId}/recommendations`, undefined],
    ] as const) {
      const r = await api(path, {
        method,
        token: coahuilaToken,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      expect(r.status).toBe(403);
    }

    // Admin ve todas y usa prioridades de Nevada al recomendar
    const adminParcels = (await api('/parcels', { token: adminToken })).body;
    expect(adminParcels.length).toBeGreaterThanOrEqual(3);
    const adminRec = await api(`/zones/${nevadaZoneId}/recommendations`, { token: adminToken });
    expect(adminRec.status).toBe(200);
    expect(adminRec.body.priorities).toEqual({ water: 15, soil: 15, income: 50, risk: 20 });
  }, 60_000);

  it('E2E Demo Profiles (Constitución #28 / Spec-005): los 3 agricultores demo reciben recomendaciones viables y distintas', async () => {
    const profiles = ['coahuila@demo.ehecatl', 'nevada@demo.ehecatl', 'mendoza@demo.ehecatl'];
    const tops: string[] = [];

    for (const email of profiles) {
      const token = (await login(email)).body.accessToken;
      const parcels = (await api('/parcels', { token })).body;
      const zoneId = parcels[0].zones[0].id;
      const rec = await api(`/zones/${zoneId}/recommendations`, { token });
      expect(rec.status).toBe(200);
      expect(rec.body.version).toBe(1);
      expect(rec.body.inputs.indicators.sources.power.status).toBe('available');
      // Constitución #28: cada usuario demo recibe recomendaciones de transición distintas y explicadas
      expect(rec.body.status).toBe('ok');
      expect(rec.body.recommendations.length).toBeGreaterThan(0);
      tops.push(rec.body.recommendations[0].id);
    }

    expect(new Set(tops).size).toBe(3);
  }, 120_000);

  it('E2E Demo Profiles (Spec-003 RF-2): los 3 puntos demo obtienen cobertura MODIS NDVI real', async () => {
    for (const email of ['coahuila@demo.ehecatl', 'nevada@demo.ehecatl', 'mendoza@demo.ehecatl']) {
      const token = (await login(email)).body.accessToken;
      const parcels = (await api('/parcels', { token })).body;
      const zoneId = parcels[0].zones[0].id;
      const ind = await api(`/zones/${zoneId}/indicators`, { token });
      expect(ind.status).toBe(200);
      expect(ind.body.sources.modis.status).toBe('available');
    }
  }, 120_000);

  it('E2E Flujo Completo en Vivo (Constitución #29): punto nuevo global -> zonas -> historial -> NASA live/cache -> prioridades cambian ranking -> cascada', async () => {
    const token = (await login('coahuila@demo.ehecatl')).body.accessToken;

    // 1. Crear parcela nueva en Nairobi, Kenia (coordenada nueva por ejecución para verificar live -> cache real)
    const freshLat = Number((-1.29 + ((Date.now() % 500) + 1) * 0.0001).toFixed(4));
    const freshLon = Number((36.82 + ((Date.now() % 500) + 1) * 0.0001).toFixed(4));
    const created = await api('/parcels', {
      method: 'POST',
      token,
      body: JSON.stringify({ name: 'QA Nairobi', lat: freshLat, lon: freshLon, currentCropId: 'maize', irrigated: true }),
    });
    expect(created.status).toBe(201);
    const parcelId = created.body.id;
    createdParcelIds.push(parcelId);
    expect(created.body.zones).toHaveLength(1);
    const zone1Id = created.body.zones[0].id;

    // 2. No permite borrar última zona (409)
    expect((await api(`/zones/${zone1Id}`, { method: 'DELETE', token })).status).toBe(409);

    // 3. Agregar segunda zona con coordenadas propias y notas de suelo, luego heredar con null/null
    const zone2 = await api(`/parcels/${parcelId}/zones`, {
      method: 'POST',
      token,
      body: JSON.stringify({ name: 'Zona Sur', currentCropId: 'wheat', lat: -1.35, lon: 36.88, irrigated: false, soilNotes: 'Franco arcilloso' }),
    });
    expect(zone2.status).toBe(201);
    const zone2Id = zone2.body.id;
    const patchedZ2 = await api(`/zones/${zone2Id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ lat: null, lon: null, soilNotes: null }),
    });
    expect(patchedZ2.status).toBe(200);
    expect(patchedZ2.body.lat).toBeNull();
    expect(patchedZ2.body.soilNotes).toBeNull();

    // 4. CRUD de historial en zone1
    const histAdd = await api(`/zones/${zone1Id}/history`, {
      method: 'POST',
      token,
      body: JSON.stringify({ cropId: 'wheat', plantedAt: '2025-05-01', harvestedAt: '2025-09-25', yieldTonHa: 4.2 }),
    });
    expect(histAdd.status).toBe(201);
    const histId = histAdd.body.id;
    const histPatch = await api(`/zones/${zone1Id}/history/${histId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ yieldTonHa: 4.8 }),
    });
    expect(histPatch.status).toBe(200);
    expect(histPatch.body.yieldTonHa).toBe(4.8);
    const histList = await api(`/zones/${zone1Id}/history`, { token });
    expect(histList.status).toBe(200);
    expect(histList.body).toHaveLength(1);

    // 5. Indicadores NASA en vivo (1a vez live, 2a vez cache < 500 ms)
    const ind1 = await api(`/zones/${zone1Id}/indicators`, { token });
    expect(ind1.status).toBe(200);
    expect(ind1.body.origin).toBe('live');
    expect(ind1.body.sources.power.status).toBe('available');
    expect(ind1.body.monthly.length).toBeGreaterThan(0);
    expect(ind1.body.climatology.length).toBeGreaterThan(0);

    const t0 = Date.now();
    const ind2 = await api(`/zones/${zone1Id}/indicators`, { token });
    const elapsedMs = Date.now() - t0;
    expect(ind2.status).toBe(200);
    expect(ind2.body.origin).toBe('cache');
    expect(elapsedMs).toBeLessThan(500);

    // 6. Recomendaciones en Mendoza (múltiples ventanas) cambian ranking al cambiar prioridades agua vs ingreso
    const mendozaToken = (await login('mendoza@demo.ehecatl')).body.accessToken;
    const mendozaZoneId = (await api('/parcels', { token: mendozaToken })).body[0].zones[0].id;
    const origPrio = (await api('/me/priorities', { token: mendozaToken })).body;
    try {
      await api('/me/priorities', { method: 'PUT', token: mendozaToken, body: JSON.stringify({ water: 100, soil: 0, income: 0, risk: 0 }) });
      const recWater = await api(`/zones/${mendozaZoneId}/recommendations`, { token: mendozaToken });
      await api('/me/priorities', { method: 'PUT', token: mendozaToken, body: JSON.stringify({ water: 0, soil: 0, income: 100, risk: 0 }) });
      const recIncome = await api(`/zones/${mendozaZoneId}/recommendations`, { token: mendozaToken });
      expect(recWater.status).toBe(200);
      expect(recIncome.status).toBe(200);
      expect(recWater.body.recommendations[0].id).not.toBe(recIncome.body.recommendations[0].id);
    } finally {
      await api('/me/priorities', { method: 'PUT', token: mendozaToken, body: JSON.stringify(origPrio) });
    }

    // 7. Recomendaciones en el punto nuevo Nairobi
    const recNairobi = await api(`/zones/${zone1Id}/recommendations`, { token });
    expect(recNairobi.status).toBe(200);
    expect(recNairobi.body.origin).toBe('cache');
    expect(recNairobi.body.inputs.historyCount).toBe(1);
    expect(recNairobi.body.status).toBe('ok');
    expect(recNairobi.body.recommendations.length).toBeGreaterThan(0);
    for (const item of recNairobi.body.recommendations) {
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(100);
      expect(item.explanation.length).toBeGreaterThan(0);
      expect(item.sequence[0].start >= recNairobi.body.inputs.indicators.fetchedAt.slice(0, 10)).toBe(true);
    }

    // 8. Borrar zone2 y luego borrar parcela en cascada (zone1 + history desaparecen)
    expect((await api(`/zones/${zone2Id}`, { method: 'DELETE', token })).status).toBe(204);
    expect((await api(`/parcels/${parcelId}`, { method: 'DELETE', token })).status).toBe(204);
    expect((await api(`/zones/${zone1Id}`, { token })).status).toBe(404);
    expect((await api(`/zones/${zone1Id}/history`, { token })).status).toBe(404);
  }, 130_000);
});

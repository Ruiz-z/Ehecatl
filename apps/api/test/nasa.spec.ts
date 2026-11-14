import type { PrismaService } from '../src/common/prisma/prisma.service.js';
import { NasaService, defaultPeriod, validateIndicators } from '../src/modules/nasa-data/nasa.service.js';
import { indicators } from './fixtures.js';

describe('B16 caché persistida', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });
  it('miss consulta geo, persiste y hit vigente evita HTTP', async () => {
    let saved: Record<string, unknown> | null = null;
    const prisma = { nasaCache: {
      findUnique: async () => saved,
      upsert: async ({ create }: { create: Record<string, unknown> }) => { saved = create; },
    } } as unknown as PrismaService;
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response(JSON.stringify(indicators())); };
    const service = new NasaService(prisma);
    expect((await service.get(0, 0, false, '2024-01-01', '2024-12-31')).origin).toBe('live');
    expect((await service.get(0, 0, false, '2024-01-01', '2024-12-31')).origin).toBe('cache');
    expect(calls).toBe(1);
  });
  it('separa riego, coordenadas y rangos, y renueva expirado', async () => {
    const keys: string[] = [];
    const prisma = { nasaCache: {
      findUnique: async ({ where }: { where: { key: string } }) => { keys.push(where.key); return { payload: indicators(), expiresAt: new Date(0) }; },
      upsert: async () => null,
    } } as unknown as PrismaService;
    let calls = 0;
    globalThis.fetch = async url => {
      calls++;
      const data = indicators(), params = new URL(String(url)).searchParams;
      data.point = { lat: Number(params.get('lat')), lon: Number(params.get('lon')) };
      data.period = { start: params.get('start')!, end: params.get('end')! };
      return new Response(JSON.stringify(data));
    };
    const service = new NasaService(prisma);
    for (const [lat, irrigation] of [[0, false], [0, true], [1, false]] as const) await service.get(lat, 0, irrigation, '2024-01-01', '2024-12-31');
    expect(new Set(keys).size).toBe(3); expect(calls).toBe(3);
  });
  it('rechaza fechas y contrato externo roto', async () => {
    const service = new NasaService({} as PrismaService);
    await expect(service.get(0, 0, false, '2024-02-30', '2024-12-31')).rejects.toThrow('Rango');
    expect(() => validateIndicators({})).toThrow('Contrato');
    expect(defaultPeriod(new Date('2025-03-02T00:00:00Z'))).toEqual({ start: '2024-03-01', end: '2025-02-28' });
  });
  it('mantiene visible un origen mock al leer caché', async () => {
    const payload = { ...indicators(), origin: 'mock' };
    const prisma = { nasaCache: { findUnique: async () => ({ payload, expiresAt: new Date(Date.now()+60_000) }) } } as unknown as PrismaService;
    globalThis.fetch = async () => { throw new Error('Unexpected network'); };
    expect((await new NasaService(prisma).get(0, 0, false, '2024-01-01', '2024-12-31')).origin).toBe('mock');
  });
  it('fallo HTTP o contrato inválido no se guardan en caché', async () => {
    let saves = 0;
    const prisma = { nasaCache: { findUnique: async () => null, upsert: async () => { saves++; } } } as unknown as PrismaService;
    for (const response of [new Response('failed', { status: 503 }), new Response('{}')]) {
      globalThis.fetch = async () => response;
      await expect(new NasaService(prisma).get(0, 0, false, '2024-01-01', '2024-12-31')).rejects.toThrow('No fue posible');
    }
    expect(saves).toBe(0);
  });
  it('consultas simultáneas del mismo punto comparten la petición geo', async () => {
    let calls = 0;
    const prisma = { nasaCache: { findUnique: async () => null, upsert: async () => null } } as unknown as PrismaService;
    globalThis.fetch = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return new Response(JSON.stringify(indicators())); };
    const service = new NasaService(prisma);
    await Promise.all([service.get(0, 0, false, '2024-01-01', '2024-12-31'), service.get(0, 0, false, '2024-01-01', '2024-12-31')]);
    expect(calls).toBe(1);
  });
});

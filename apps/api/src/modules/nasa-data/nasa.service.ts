import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Indicators } from './contracts.js';

export function defaultPeriod(now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth()-11, 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
export function validatePeriod(start: string, end: string) {
  const a = Date.parse(start), b = Date.parse(end);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || !Number.isFinite(a) || !Number.isFinite(b) ||
      new Date(a).toISOString().slice(0, 10) !== start || new Date(b).toISOString().slice(0, 10) !== end || a > b || b > Date.now() || b-a > 3660*86_400_000) throw new BadRequestException('Rango de fechas inválido');
}

export function validateIndicators(payload: unknown): Indicators {
  if (!payload || typeof payload !== 'object') throw new BadGatewayException('Contrato geo inválido');
  const data = payload as Indicators;
  const validNumber = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  if (data.version !== 1 || !['live', 'cache', 'mock'].includes(data.origin) ||
      !data.point || !validNumber(data.point.lat) || !validNumber(data.point.lon) ||
      !data.period || typeof data.period.start !== 'string' || typeof data.period.end !== 'string' ||
      !data.sources || !['power', 'modis'].every(k => ['available', 'partial', 'unavailable'].includes(data.sources[k as 'power' | 'modis']?.status)) ||
      !Array.isArray(data.monthly) || !Array.isArray(data.climatology) || !Array.isArray(data.windows) || !Array.isArray(data.trends) ||
      !Array.isArray(data.anomalies) || !Array.isArray(data.warnings) || data.warnings.some(x => typeof x !== 'string') ||
      typeof data.fetchedAt !== 'string' || !Number.isFinite(Date.parse(data.fetchedAt))) throw new BadGatewayException('Contrato geo inválido');
  if (data.monthly.some(r => !r || typeof r.variable !== 'string' || !/^\d{4}-\d{2}-01$/.test(r.date) ||
      (r.value !== null && !validNumber(r.value)) || typeof r.unit !== 'string' || typeof r.source !== 'string' || typeof r.resolution !== 'string') ||
      data.climatology.some(r => !r || typeof r.variable !== 'string' || !Number.isInteger(r.month) || r.month < 1 || r.month > 12 || !validNumber(r.value) || !Number.isInteger(r.samples) || r.samples < 1) ||
      data.trends.some(t => !t || typeof t.type !== 'string' || typeof t.active !== 'boolean' || !Array.isArray(t.evidence)) ||
      data.windows.some(w => !w || typeof w.id !== 'string' || !Number.isFinite(Date.parse(w.start)) || !Number.isFinite(Date.parse(w.end)) ||
        w.start > w.end || !validNumber(w.durationDays) || w.durationDays <= 0 || typeof w.irrigated !== 'boolean' || !Array.isArray(w.months) ||
        [w.temperatureMin, w.temperatureMax, w.meanTemperature, w.precipitationMm].some(x => x !== null && !validNumber(x)))) throw new BadGatewayException('Contrato geo inválido');
  return data;
}

@Injectable()
export class NasaService {
  private readonly inFlight = new Map<string, Promise<Indicators>>();
  constructor(private readonly prisma: PrismaService) {}
  async get(lat: number, lon: number, irrigated: boolean, start?: string, end?: string): Promise<Indicators> {
    const period = defaultPeriod();
    start = start || period.start;
    end = end || period.end;
    validatePeriod(start, end);
    const query = new URLSearchParams({ lat: String(lat), lon: String(lon), irrigated: String(irrigated), start, end, baselineYears: '10' });
    const key = createHash('sha256').update(`indicators:v1:${query}`).digest('hex');
    const cached = await this.prisma.nasaCache.findUnique({ where: { key } });
    if (cached && cached.expiresAt > new Date()) {
      const payload = validateIndicators(cached.payload);
      return { ...payload, origin: payload.origin === 'mock' ? 'mock' : 'cache' };
    }
    const pending = this.inFlight.get(key);
    if (pending) return pending;
    const promise = this.load(query, key);
    this.inFlight.set(key, promise);
    try { return await promise; } finally { this.inFlight.delete(key); }
  }
  private async load(query: URLSearchParams, key: string): Promise<Indicators> {
    let payload: Indicators;
    try {
      const url = new URL('/indicators', process.env.GEO_URL ?? 'http://localhost:8000');
      url.search = query.toString();
      const response = await fetch(url, { signal: AbortSignal.timeout(Math.ceil(positiveNumber(process.env.GEO_TIMEOUT_MS, 130_000))) });
      if (!response.ok) throw new Error(`geo ${response.status}`);
      payload = validateIndicators(await response.json());
      if (payload.point.lat !== Number(query.get('lat')) || payload.point.lon !== Number(query.get('lon')) ||
          payload.period.start !== query.get('start') || payload.period.end !== query.get('end')) throw new Error('Geo response point/period mismatch');
    } catch { throw new BadGatewayException('No fue posible consultar los indicadores NASA'); }
    const now = new Date();
    const ttl = positiveNumber(process.env.NASA_CACHE_TTL_HOURS, 24);
    const partial = Object.values(payload.sources).some(s => s.status !== 'available');
    const expiresAt = new Date(now.getTime() + Math.min(partial ? .083333 : ttl, ttl)*3_600_000);
    const data = { payload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue, source: 'NASA POWER; MODIS MOD13Q1 / ORNL DAAC', fetchedAt: new Date(payload.fetchedAt), expiresAt };
    await this.prisma.nasaCache.upsert({ where: { key }, create: { key, ...data }, update: data });
    return payload;
  }
}

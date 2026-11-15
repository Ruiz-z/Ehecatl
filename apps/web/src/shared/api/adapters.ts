// Traducción pura de las respuestas de apps/api (contrato en docs/contracts.md)
// a los modelos de vista del front. Sin acceso a red ni a localStorage.
import type { DemoUser, Parcel, Priorities } from '@/features/parcels/types';
import type { CropFamily, RecommendationResult, Strategy, RotationStep, Rest } from '@/features/rotation/types';
import type { Observation, TimePoint } from '@/features/nasa/types';
import type { Crop, Indicators, MetricKey, MetricSummary, Session } from './types';

export interface ApiCrop { id: string; name: string; family: string }
export interface ApiZone { id: string; currentCropId: string; irrigated: boolean; lat: number | null; lon: number | null }
export interface ApiParcel { id: string; ownerId: string; name: string; lat: number; lon: number; zones: ApiZone[] }
export interface ApiLogin { accessToken: string; expiresIn: number; user: { id: string; email: string; name: string; role: string } }
export interface ApiMonthly { variable: string; date: string; value: number | null; unit: string; source: string }
export interface ApiIndicators {
  period: { start: string; end: string };
  origin: 'live' | 'cache' | 'mock';
  monthly: ApiMonthly[];
  climatology: { variable: string; month: number; value: number }[];
  sources: Record<string, { status: string; reason: string | null }>;
  warnings: string[];
}
export interface ApiRecommendation {
  irrigationNeedMm?: number;
  id: string; score: number;
  sequence: (RotationStep & { cropId: string })[];
  rests?: Rest[];
  components: Priorities; explanation: string[]; risks: string[];
}
export interface ApiBaseline {
  irrigationNeedMm?: number;
  id: string; viable: boolean; score: number | null; components: Priorities | null;
  sequence: ApiRecommendation['sequence']; rests?: Rest[]; explanation: string[]; risks: string[];
}
export interface ApiRecommendations {
  status: 'ok' | 'no_viable_options'; origin: 'live' | 'cache' | 'mock'; confidence: 'high' | 'medium' | 'low';
  warnings: string[]; currentCropRisk: { level: 'low' | 'high'; reasons: string[]; changeAt: string | null };
  inputs: { currentCropId?: string; indicators: { period: { end: string } } }; recommendations: ApiRecommendation[];
  baseline?: ApiBaseline;
}

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const longMonths = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]!.toUpperCase()).join('') || '?';
}
export function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return `${day} de ${longMonths[month! - 1]} de ${year}`;
}
export function formatMonth(iso: string): string {
  const [year, month] = iso.slice(0, 7).split('-').map(Number);
  return `${longMonths[month! - 1]} de ${year}`;
}
export function mapSession(login: ApiLogin, priorities: Priorities, now = Date.now()): Session {
  const user: DemoUser = {
    id: login.user.id, email: login.user.email, name: login.user.name,
    role: login.user.role.toLowerCase() === 'admin' ? 'admin' : 'farmer',
    initials: initials(login.user.name), region: '', description: '', priorities
  };
  return { user, accessToken: login.accessToken, expiresAt: now + login.expiresIn * 1000 };
}
export function mapCrops(crops: ApiCrop[]): Crop[] {
  return crops.map(({ id, name, family }) => ({ id, name, family }));
}
// Una parcela del front equivale a la primera zona de la parcela del API (spec 002 RF-5b).
export function mapParcel(parcel: ApiParcel, crops: Crop[]): Parcel | null {
  const zone = parcel.zones[0];
  if (!zone) return null;
  const latitude = zone.lat ?? parcel.lat;
  const longitude = zone.lon ?? parcel.lon;
  return {
    id: parcel.id, ownerId: parcel.ownerId, zoneId: zone.id, cropId: zone.currentCropId,
    name: parcel.name, place: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`, latitude, longitude,
    crop: crops.find(crop => crop.id === zone.currentCropId)?.name ?? zone.currentCropId,
    irrigation: zone.irrigated, area: null, risk: 'unknown', dataState: 'ready'
  };
}

function monthIndex(iso: string): number { const [year, month] = iso.split('-').map(Number); return year! * 12 + month! - 1; }
const familyOf = (family: string): CropFamily => family === 'Poaceae' ? 'grain' : family === 'Fabaceae' ? 'legume' : 'other';
const confidenceLabel = { high: 'Alta', medium: 'Media', low: 'Baja' } as const;

export function mapRecommendations(response: ApiRecommendations, crops: Crop[]): RecommendationResult {
  // El horizonte arranca el mes siguiente al fin del periodo observado (docs/contracts.md).
  const horizon = monthIndex(response.inputs.indicators.period.end) + 1;
  const horizonStart = `${Math.floor(horizon / 12)}-${String((horizon % 12) + 1).padStart(2, '0')}`;
  const reference = response.baseline;
  const candidates = [...response.recommendations.map(item => ({ ...item, baseline: false })),
    ...(reference?.viable && reference.components && reference.score !== null ? [{ ...reference, components: reference.components, score: reference.score, baseline: true }] : [])];
  const strategies: Strategy[] = candidates.map(item => ({
    id: item.id, baseline: item.baseline, irrigationNeedMm: item.irrigationNeedMm,
    name: item.baseline ? 'Mantener lo actual' : item.sequence.map(step => step.cropName).join(' → '),
    axes: item.components,
    steps: item.sequence.map((step, index) => ({ ...step, water: step.water, previousCropName: index ? item.sequence[index-1]!.cropName : crops.find(crop => crop.id === response.inputs.currentCropId)?.name })),
    rests: item.rests ?? [],
    windows: item.sequence.map(step => {
      const startMonth = Math.max(0, monthIndex(step.start) - horizon);
      return {
        start: step.start, end: step.end, crop: step.cropName, family: familyOf(crops.find(crop => crop.id === step.cropId)?.family ?? ''), current: item.baseline,
        startMonth, months: Math.max(1, monthIndex(step.end) - monthIndex(step.start) + 1)
      };
    }),
    changeAt: item.baseline ? 'Se conserva el cultivo actual' : item.sequence[0] ? formatDate(item.sequence[0].start) : 'Sin fecha',
    reasons: item.explanation.map(text => ({ text })),
    risks: [...new Set(item.risks)],
    confidence: confidenceLabel[response.confidence],
    confidenceReason: response.warnings.filter(text => text.length < 120).slice(0, 2).join(' · ') || 'Sin advertencias de datos.'
  }));
  return {
    status: response.status, origin: response.origin, confidence: confidenceLabel[response.confidence],
    warnings: response.warnings, risk: { level: response.currentCropRisk.level, reasons: response.currentCropRisk.reasons },
    horizonStart, strategies,
    baselineUnavailableReasons: reference && !reference.viable ? reference.explanation : undefined
  };
}

// --- Indicadores ---
function last(rows: ApiMonthly[], variable: string): ApiMonthly | undefined {
  return rows.filter(row => row.variable === variable && row.value !== null).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
}
const round = (value: number, digits = 1) => Number(value.toFixed(digits));
function normalOf(response: ApiIndicators, variable: string, date: string): number | null {
  return response.climatology.find(item => item.variable === variable && item.month === Number(date.slice(5, 7)))?.value ?? null;
}
function percentVs(value: number, normal: number | null): number | null {
  return normal ? Math.round(((value - normal) / normal) * 100) : null;
}

export function mapSeries(response: ApiIndicators): TimePoint[] {
  const dates = [...new Set(response.monthly.map(row => row.date))].sort();
  const at = (variable: string, date: string) => response.monthly.find(row => row.variable === variable && row.date === date)?.value ?? null;
  return dates.map(date => {
    const moisture = at('GWETROOT', date);
    const normalMoisture = normalOf(response, 'GWETROOT', date);
    return {
      month: monthNames[Number(date.slice(5, 7)) - 1]!,
      rainfall: at('PRECTOTCORR', date), rainfallNormal: normalOf(response, 'PRECTOTCORR', date),
      temperature: at('T2M', date), temperatureNormal: normalOf(response, 'T2M', date),
      moisture: moisture === null ? null : round(moisture * 100), moistureNormal: normalMoisture === null ? null : round(normalMoisture * 100),
      ndvi: at('NDVI', date), ndviNormal: normalOf(response, 'NDVI', date)
    };
  });
}

export function mapObservations(response: ApiIndicators): Observation[] {
  const origin = response.origin;
  const out: Observation[] = [];
  const rain = last(response.monthly, 'PRECTOTCORR');
  if (rain) {
    const delta = percentVs(rain.value!, normalOf(response, 'PRECTOTCORR', rain.date));
    const dry = delta !== null && delta <= -25;
    out.push({ label: 'Lluvia del mes', variable: 'PRECTOTCORR', value: `${Math.round(rain.value!)} mm`, status: dry ? 'Escasa' : delta !== null && delta >= 25 ? 'Abundante' : 'Normal',
      consequence: delta === null ? 'Sin promedio histórico para comparar.' : delta < 0 ? `${Math.abs(delta)} % menos que lo normal.${dry ? ' Cuida el agua del próximo ciclo.' : ''}` : `${delta} % más que lo normal.`,
      source: rain.source, date: formatMonth(rain.date), origin, tone: dry ? 'warning' : 'good' });
  }
  const heat = last(response.monthly, 'T2M_MAX');
  if (heat) {
    const normal = normalOf(response, 'T2M_MAX', heat.date);
    const diff = normal === null ? null : round(heat.value! - normal);
    const hot = diff !== null && diff >= 2;
    out.push({ label: 'Calor en el campo', variable: 'T2M_MAX', value: `${round(heat.value!)} °C`, status: hot ? 'Elevado' : 'Esperado',
      consequence: diff === null ? 'Sin promedio histórico para comparar.' : hot ? `${diff} °C más que lo normal. El cultivo pierde más agua.` : 'Dentro del rango habitual de la zona.',
      source: heat.source, date: formatMonth(heat.date), origin, tone: hot ? 'warning' : 'good' });
  }
  const root = last(response.monthly, 'GWETROOT');
  if (root) {
    const pct = Math.round(root.value! * 100);
    const low = pct < 30;
    out.push({ label: 'Humedad en raíz', variable: 'GWETROOT', value: `${pct} %`, status: low ? 'Baja' : pct < 50 ? 'Media' : 'Adecuada',
      consequence: low ? 'Riesgo de estrés por falta de agua.' : pct < 50 ? 'Reserva moderada; vigila el siguiente ciclo.' : 'El suelo mantiene una buena reserva.',
      source: root.source, date: formatMonth(root.date), origin, tone: low ? 'warning' : 'good' });
  }
  return out;
}

function summarize(points: TimePoint[], key: 'rainfall' | 'temperature' | 'moisture' | 'ndvi', normalKey: 'rainfallNormal' | 'temperatureNormal' | 'moistureNormal' | 'ndviNormal', unit: string): MetricSummary | undefined {
  const pairs = points.filter(point => point[key] !== null && point[normalKey] !== null);
  if (!pairs.length) return undefined;
  const mean = (items: number[]) => items.reduce((a, b) => a + b, 0) / items.length;
  const value = mean(pairs.map(point => point[key]!));
  const normal = mean(pairs.map(point => point[normalKey]!));
  if (unit === '°C') {
    const diff = round(value - normal);
    return Math.abs(diff) < 1 ? { text: 'Dentro del rango habitual', tone: 'good' } : { text: `${Math.abs(diff)} °C ${diff > 0 ? 'más' : 'menos'} que lo normal`, tone: diff >= 2 ? 'warning' : 'good' };
  }
  const delta = percentVs(value, normal);
  if (delta === null || Math.abs(delta) < 10) return { text: 'En línea con lo normal', tone: 'good' };
  return { text: `${Math.abs(delta)} % ${delta > 0 ? 'más' : 'menos'} que lo normal`, tone: delta <= -20 ? 'warning' : 'good' };
}

export function mapIndicators(response: ApiIndicators): Indicators {
  const series = mapSeries(response);
  const ndvi = last(response.monthly, 'NDVI');
  const lastRow = response.monthly.filter(row => row.value !== null).map(row => row.date).sort().at(-1);
  const summaries: Partial<Record<MetricKey, MetricSummary>> = {};
  for (const [key, normalKey, unit] of [['rainfall', 'rainfallNormal', 'mm'], ['temperature', 'temperatureNormal', '°C'], ['moisture', 'moistureNormal', '%'], ['ndvi', 'ndviNormal', 'ndvi']] as const) {
    const summary = summarize(series, key, normalKey, unit);
    if (summary) summaries[key] = summary;
  }
  return {
    observations: mapObservations(response), series, summaries,
    ndvi: { value: ndvi?.value ?? null, label: ndvi ? (ndvi.value! >= 0.5 ? 'Vegetación activa' : ndvi.value! >= 0.3 ? 'Actividad moderada' : 'Poca vegetación') : 'Sin dato de vegetación' },
    lastObservation: lastRow ? formatMonth(lastRow) : '',
    periodLabel: `${formatDate(response.period.start)} — ${formatDate(response.period.end)}`,
    origin: response.origin,
    warnings: response.warnings
  };
}

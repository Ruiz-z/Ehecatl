import { copy, moistureZone, vegetationZone } from '../../features/nasa/copy.ts';
// Traducción pura de las respuestas de apps/api (contrato en docs/contracts.md)
// a los modelos de vista del front. Sin acceso a red ni a localStorage.
import type { DemoUser, Parcel, Priorities } from '@/features/parcels/types';
import type { CropFamily, RecommendationResult, Strategy, RotationStep, Rest } from '@/features/rotation/types';
import type { Observation, TimePoint, SowingWindow } from '@/features/nasa/types';
import type { Crop, Indicators, MetricKey, MetricSummary, Session } from './types';

export interface ApiCrop { id: string; name: string; family: string }
export interface ApiZone { id: string; currentCropId: string; irrigated: boolean; lat: number | null; lon: number | null }
export interface ApiParcel { id: string; ownerId: string; name: string; lat: number; lon: number; zones: ApiZone[] }
export interface ApiLogin { accessToken: string; expiresIn: number; user: { id: string; email: string; name: string; role: string } }
export interface ApiMonthly { variable: string; date: string; value: number | null; unit: string; source: string }
export interface ApiIndicators {
  windows?: SowingWindow[];
  period: { start: string; end: string };
  origin: 'live' | 'cache' | 'mock';
  monthly: ApiMonthly[];
  climatology: { variable: string; month: number; value: number; samples?: number }[];
  trends: { type: 'drought' | 'heat' | 'vegetation_stress' | 'erratic_rain'; active: boolean; evidence: string[] }[];
  anomalies: { variable: string; date: string; value: number; percent: number | null }[];
  sources: Record<string, { status: string; reason: string | null }>;
  warnings: string[];
}
export interface ApiRecommendation {
  riskGroups?: { type: string; text: string }[];
  irrigationNeedMm?: number;
  id: string; score: number;
  sequence: (RotationStep & { cropId: string })[];
  rests?: Rest[];
  components: Priorities; explanation: string[]; risks: string[];
}
export interface ApiBaseline {
  riskGroups?: { type: string; text: string }[];
  irrigationNeedMm?: number;
  id: string; viable: boolean; score: number | null; components: Priorities | null;
  sequence: ApiRecommendation['sequence']; rests?: Rest[]; explanation: string[]; risks: string[];
}
export interface ApiRecommendations {
  status: 'ok' | 'no_viable_options'; origin: 'live' | 'cache' | 'mock'; confidence: 'high' | 'medium' | 'low';
  warnings: string[]; currentCropRisk: { level: 'low' | 'high'; reasons: string[]; changeAt: string | null };
  inputs: { currentCropId?: string; indicators: { period: { end: string }; sources?: ApiIndicators['sources'] } }; recommendations: ApiRecommendation[];
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
    risks: [...new Set(item.riskGroups?.map(group => group.text) ?? item.risks)],
    known: Object.entries(response.inputs.indicators.sources ?? {}).filter(([,source]) => source.status === 'available').map(([name]) => name === 'power' ? 'POWER: clima disponible para estimar la demanda de agua.' : 'MODIS: observaciones de vegetación disponibles; revisa los avisos de cobertura.'),
    missing: [...new Set([...response.warnings, ...Object.entries(response.inputs.indicators.sources ?? {}).filter(([,source]) => source.status !== 'available').map(([name,source]) => `${name === 'power' ? 'POWER' : 'MODIS'}: ${source.status === 'partial' ? 'datos parciales' : 'sin datos'}${source.reason ? `; ${source.reason}` : ''}`)])],
    confidence: confidenceLabel[response.confidence],
    confidenceReason: response.warnings.join(' · ') || 'Sin advertencias de datos.'
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

export function mapSeries(response: ApiIndicators): TimePoint[] {
  const end = monthIndex(response.period.end);
  const dates = Array.from({ length: 12 }, (_, i) => {
    const index = end - 11 + i;
    return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}-01`;
  });
  const at = (variable: string, date: string) => response.monthly.find(row => row.variable === variable && row.date.slice(0, 7) === date.slice(0, 7))?.value ?? null;
  return dates.map(date => {
    const moisture = at('GWETROOT', date);
    const normalMoisture = normalOf(response, 'GWETROOT', date);
    return {
      date: date.slice(0, 7),
      month: monthNames[Number(date.slice(5, 7)) - 1]!,
      rainfall: at('PRECTOTCORR', date), rainfallNormal: normalOf(response, 'PRECTOTCORR', date),
      temperature: at('T2M', date), temperatureNormal: normalOf(response, 'T2M', date),
      moisture: moisture === null ? null : round(moisture * 100), moistureNormal: normalMoisture === null ? null : round(normalMoisture * 100),
      ndvi: at('NDVI', date), ndviNormal: normalOf(response, 'NDVI', date)
    };
  });
}

function anomalyOf(response: ApiIndicators, row: ApiMonthly) {
  return response.anomalies.find(item => item.variable === row.variable && item.date === row.date);
}
function trendOf(response: ApiIndicators, type: ApiIndicators['trends'][number]['type']) {
  return response.trends.find(item => item.type === type);
}
function rainYear(response: ApiIndicators, date: string): string {
  const end = monthIndex(date);
  const months = Array.from({length:12}, (_,i) => end-11+i);
  const rows = months.map(index => response.monthly.find(row => row.variable === 'PRECTOTCORR' && monthIndex(row.date) === index && row.value !== null));
  const count = rows.filter(Boolean).length;
  if (count !== 12) return copy.rain.incomplete;
  const total = rows.reduce((sum,row) => sum+row!.value!,0);
  const normals = rows.map(row => normalOf(response, 'PRECTOTCORR', row!.date));
  if (normals.some(value => value === null)) return copy.insufficient;
  const normal = normals.reduce<number>((sum,value) => sum+value!,0);
  return copy.rain.year(Math.round(total), Math.round(normal));
}
export function mapObservations(response: ApiIndicators): Observation[] {
  const out: Observation[] = [];
  for (const variable of ['PRECTOTCORR', 'T2M_MAX', 'GWETROOT']) {
    const row = last(response.monthly, variable);
    if (!row) continue;
    const month = longMonths[Number(row.date.slice(5,7))-1]!;
    const trend = trendOf(response, variable === 'PRECTOTCORR' ? 'drought' : 'heat');
    const delta = anomalyOf(response, row);
    const root = variable === 'GWETROOT';
    const rain = variable === 'PRECTOTCORR';
    const zone = root ? moistureZone(row.value!*100) : undefined;
    const comparable = rain ? delta?.percent != null : delta?.value != null;
    const status = root ? copy.moisture.zones[zone!]! : !comparable || !trend ? copy.insufficient
      : rain ? trend.active && delta!.percent! < 0 ? copy.rain.low(Math.abs(Math.round(delta!.percent!)))
        : delta!.percent! > 0 ? copy.rain.high(Math.round(delta!.percent!)) : copy.rain.normal
      : trend.active && delta!.value > 0 ? copy.heat.high(round(delta!.value)) : copy.heat.normal;
    const consequence = root ? `${copy.moisture.descriptions[zone!]} ${copy.moisture.note}`
      : rain ? `${trend?.active ? copy.rain.advice + ' ' : ''}${rainYear(response, response.period.end)}`
      : trend?.active ? copy.heat.advice : '';
    out.push({ label: root ? copy.moisture.title : rain ? copy.rain.title(month) : copy.heat.title(month), variable,
      value: root ? `${Math.round(row.value!*100)} %` : rain ? `${Math.round(row.value!)} mm` : `${row.value!.toFixed(1)} °C`,
      rawValue: `${row.value} ${row.unit}`, status, consequence, source: row.source, date: formatMonth(row.date), origin: response.origin,
      zone, alertActive: root ? undefined : trend?.active,
      tone: root ? 'neutral' : trend?.active || rain && trendOf(response, 'erratic_rain')?.active ? 'warning' : !trend || !comparable ? 'neutral' : 'good' });
  }
  return out;
}

function summarize(response: ApiIndicators, key: MetricKey, active: boolean | undefined): MetricSummary | undefined {
  const variable = { rainfall: 'PRECTOTCORR', temperature: 'T2M', moisture: 'GWETROOT', ndvi: 'NDVI' }[key];
  const row = key === 'ndvi' ? response.monthly.filter(row => row.variable === variable).sort((a,b) => a.date.localeCompare(b.date)).at(-1) : last(response.monthly, variable);
  if (!row || row.value === null || normalOf(response, variable, row.date) === null) return undefined;
  const delta = anomalyOf(response, row);
  const tone = active ? 'warning' : active === false ? 'good' : 'neutral';
  const text = key === 'rainfall' ? active === undefined || delta?.percent == null ? copy.insufficient
    : active && delta.percent < 0 ? copy.rain.low(Math.abs(Math.round(delta.percent))) : delta.percent > 0 ? copy.rain.high(Math.round(delta.percent)) : copy.rain.normal
    : key === 'temperature' ? active === undefined || delta?.value == null ? copy.insufficient
    : active && delta.value > 0 ? copy.heat.high(round(delta.value)) : copy.heat.normal
    : key === 'moisture' ? copy.moisture.zones[moistureZone(row.value!*100)]!
    : ndviLabel(response, row);
  const comparable = key === 'rainfall' || key === 'ndvi' ? delta?.percent != null : key === 'temperature' ? delta?.value != null : true;
  return { text, tone: comparable ? tone : 'neutral' };
}

export function mapIndicators(response: ApiIndicators): Indicators {
  const series = mapSeries(response);
  const ndvi = response.monthly.filter(row => row.variable === 'NDVI').sort((a,b) => a.date.localeCompare(b.date)).at(-1);
  const lastDataMonth = [last(response.monthly, 'PRECTOTCORR')?.date, last(response.monthly, 'T2M_MAX')?.date, last(response.monthly, 'T2M')?.date].filter((date): date is string => Boolean(date)).sort().at(-1)?.slice(0,7);
  const summaries: Partial<Record<MetricKey, MetricSummary>> = {};
  for (const key of ['rainfall', 'temperature', 'moisture', 'ndvi'] as const) {
    const type = key === 'rainfall' ? 'drought' : key === 'temperature' ? 'heat' : key === 'ndvi' ? 'vegetation_stress' : undefined;
    const active = key === 'rainfall' && trendOf(response, 'erratic_rain')?.active ? true : type ? trendOf(response, type)?.active : undefined;
    const summary = summarize(response, key, active);
    if (summary) summaries[key] = summary;
  }
  return {
    observations: mapObservations(response), series, summaries,
    ndvi: { value: ndvi?.value ?? null,
      source: ndvi?.source, date: ndvi ? formatMonth(ndvi.date) : undefined,
      zone: ndvi?.value != null && anomalyOf(response, ndvi)?.percent != null ? vegetationZone(anomalyOf(response, ndvi)!.percent!) : undefined,
      label: ndvi?.value != null ? ndviLabel(response, ndvi) : copy.vegetation.missing },
    windows: response.windows, period: response.period,
    lastDataMonth,
    lastObservation: lastDataMonth ? formatMonth(lastDataMonth) : '',
    periodLabel: `${formatDate(response.period.start)} / ${formatDate(response.period.end)}`,
    origin: response.origin,
    warnings: response.warnings
  };
}

function ndviLabel(response: ApiIndicators, row: ApiMonthly): string {
  const percent = anomalyOf(response, row)?.percent;
  if (percent == null) return copy.insufficient;
  return copy.vegetation.descriptions[vegetationZone(percent)]!(longMonths[Number(row.date.slice(5,7))-1]!);
}

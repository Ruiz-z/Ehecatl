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

function anomalyOf(response: ApiIndicators, row: ApiMonthly) {
  return response.anomalies.find(item => item.variable === row.variable && item.date === row.date);
}
function trendOf(response: ApiIndicators, type: ApiIndicators['trends'][number]['type']) {
  return response.trends.find(item => item.type === type);
}
function relativeText(percent: number | null | undefined): string {
  return percent == null ? 'Sin normal histórica para comparar.'
    : `${Math.abs(Math.round(percent))} % ${percent < 0 ? 'menos' : 'más'} que lo normal.`;
}
function rainYear(response: ApiIndicators, date: string): string {
  const end = monthIndex(date);
  const months = Array.from({length:12}, (_,i) => end-11+i);
  const rows = months.map(index => response.monthly.find(row => row.variable === 'PRECTOTCORR' && monthIndex(row.date) === index && row.value !== null));
  const count = rows.filter(Boolean).length;
  if (count !== 12) return `Últimos 12 meses: acumulado incompleto (${count}/12 meses); no se extrapola.`;
  const total = rows.reduce((sum,row) => sum+row!.value!,0);
  const normals = rows.map(row => normalOf(response, 'PRECTOTCORR', row!.date));
  if (normals.some(value => value === null)) return `Últimos 12 meses: ${Math.round(total)} mm; sin normal completa para comparar.`;
  const normal = normals.reduce<number>((sum,value) => sum+value!,0);
  return `Últimos 12 meses: ${Math.round(total)} mm frente a ${Math.round(normal)} mm normales. ${relativeText(percentVs(total, normal))}`;
}
export function mapObservations(response: ApiIndicators): Observation[] {
  const origin = response.origin;
  const out: Observation[] = [];
  const rain = last(response.monthly, 'PRECTOTCORR');
  if (rain) {
    const drought = trendOf(response, 'drought');
    const erratic = trendOf(response, 'erratic_rain');
    const delta = anomalyOf(response, rain)?.percent;
    const warning = drought?.active || erratic?.active;
    out.push({ label: 'Lluvia del mes', variable: 'PRECTOTCORR', value: `${Math.round(rain.value!)} mm`, rawValue: `${rain.value} ${rain.unit}`,
      status: drought?.active ? 'Sequía observada' : erratic?.active ? 'Lluvia irregular' : delta == null || !drought ? 'Sin comparación suficiente' : 'Sin señal de sequía',
      consequence: `Este mes: ${relativeText(delta)} ${rainYear(response, response.period.end)}${drought?.active ? ' Cuida el agua del próximo ciclo.' : ''}${erratic?.active ? ' La lluvia reciente es irregular.' : ''}`,
      source: rain.source, date: formatMonth(rain.date), origin, tone: warning ? 'warning' : delta == null || !drought ? 'neutral' : 'good' });
  }
  const heat = last(response.monthly, 'T2M_MAX');
  if (heat) {
    const trend = trendOf(response, 'heat');
    const diff = anomalyOf(response, heat)?.value;
    out.push({ label: 'Calor en el campo', variable: 'T2M_MAX', value: `${round(heat.value!)} °C`, rawValue: `${heat.value} ${heat.unit}`,
      status: trend?.active ? 'Elevado' : diff == null || !trend ? 'Sin comparación suficiente' : 'Sin señal de calor inusual',
      consequence: `${diff == null ? 'Sin normal histórica de la máxima para comparar.' : `Máxima del mes: ${Math.abs(round(diff))} °C ${diff < 0 ? 'menos' : 'más'} que lo normal.`}${trend?.active ? ' La temperatura media reciente indica calor; el cultivo puede perder más agua.' : ''}`,
      source: heat.source, date: formatMonth(heat.date), origin, tone: trend?.active ? 'warning' : diff == null || !trend ? 'neutral' : 'good' });
  }
  const root = last(response.monthly, 'GWETROOT');
  if (root) {
    out.push({ label: 'Humedad en raíz', variable: 'GWETROOT', value: `${Math.round(root.value!*100)} %`, rawValue: `${root.value} ${root.unit}`,
      status: 'Reserva relativa del suelo', consequence: `${relativeText(anomalyOf(response, root)?.percent)} Este índice no mide el agua disponible para un cultivo específico.`,
      source: root.source, date: formatMonth(root.date), origin, tone: 'neutral' });
  }
  return out;
}

function summarize(points: TimePoint[], key: 'rainfall' | 'temperature' | 'moisture' | 'ndvi', normalKey: 'rainfallNormal' | 'temperatureNormal' | 'moistureNormal' | 'ndviNormal', unit: string, active: boolean | undefined): MetricSummary | undefined {
  const pairs = points.filter(point => point[key] !== null && point[normalKey] !== null);
  if (!pairs.length) return undefined;
  const mean = (items: number[]) => items.reduce((a, b) => a + b, 0) / items.length;
  const value = mean(pairs.map(point => point[key]!));
  const normal = mean(pairs.map(point => point[normalKey]!));
  const tone = active ? 'warning' : active === false ? 'good' : 'neutral';
  if (unit === '°C') {
    const diff = round(value-normal);
    return {text: `${Math.abs(diff)} °C ${diff < 0 ? 'menos' : 'más'} que lo normal`, tone};
  }
  const delta = percentVs(value, normal);
  return {text: relativeText(delta), tone: delta === null ? 'neutral' : tone};
}

export function mapIndicators(response: ApiIndicators): Indicators {
  const series = mapSeries(response);
  const ndvi = last(response.monthly, 'NDVI');
  const lastRow = response.monthly.filter(row => row.value !== null).map(row => row.date).sort().at(-1);
  const summaries: Partial<Record<MetricKey, MetricSummary>> = {};
  for (const [key, normalKey, unit] of [['rainfall', 'rainfallNormal', 'mm'], ['temperature', 'temperatureNormal', '°C'], ['moisture', 'moistureNormal', '%'], ['ndvi', 'ndviNormal', 'ndvi']] as const) {
    const type = key === 'rainfall' ? 'drought' : key === 'temperature' ? 'heat' : key === 'ndvi' ? 'vegetation_stress' : undefined;
    const active = key === 'rainfall' && trendOf(response, 'erratic_rain')?.active ? true : type ? trendOf(response, type)?.active : undefined;
    const summary = summarize(series, key, normalKey, unit, active);
    if (summary) summaries[key] = summary;
  }
  return {
    observations: mapObservations(response), series, summaries,
    ndvi: { value: ndvi?.value ?? null,
      source: ndvi?.source, date: ndvi ? formatMonth(ndvi.date) : undefined,
      label: ndvi ? ndviLabel(response, ndvi) : 'Sin dato de vegetación' },
    lastObservation: lastRow ? formatMonth(lastRow) : '',
    periodLabel: `${formatDate(response.period.start)} — ${formatDate(response.period.end)}`,
    origin: response.origin,
    warnings: response.warnings
  };
}

function ndviLabel(response: ApiIndicators, row: ApiMonthly): string {
  const percent = anomalyOf(response, row)?.percent;
  if (percent == null) return 'Sin normal histórica para comparar el verdor de este mes';
  return `${Math.abs(Math.round(percent))} % ${percent < 0 ? 'menos' : 'más'} verde que lo normal para ${longMonths[Number(row.date.slice(5,7))-1]}`;
}

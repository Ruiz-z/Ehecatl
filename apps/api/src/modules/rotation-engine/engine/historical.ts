import type { Crop } from '../../crop-knowledge/crop-catalog.js';
import type { HistoricalMonth } from '../../nasa-data/contracts.js';
import { cycleMonths, etoDaily, kcSeason } from './evapotranspiration.js';

export interface HistoricalRisk {
  okYears: number; totalYears: number;
  failures: { heat: number; frost: number; temperature: number; water: number };
}
export interface HistoricalResult extends HistoricalRisk { relativeYieldPct: number | null }
const dayMs = 86_400_000;
const variables = ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN'] as const;

export function simulateCycle(crop: Crop, start: string, end: string, history: HistoricalMonth[] = [], irrigated: boolean): HistoricalResult {
  const result: HistoricalResult = { okYears: 0, totalYears: 0, failures: { heat: 0, frost: 0, temperature: 0, water: 0 }, relativeYieldPct: null };
  const first = new Date(`${start}T00:00:00Z`), last = new Date(`${end}T00:00:00Z`);
  const offset = last.getUTCFullYear()-first.getUTCFullYear();
  // Un duplicado ambiguo es un hueco, nunca depende del orden recibido.
  const values = new Map<string, number | null>();
  for (const row of history) {
    const key = `${row.year}:${row.month}:${row.variable}`;
    values.set(key, values.has(key) ? null : row.value);
  }
  const years = [...new Set(history.map(row => row.year))].sort((a,b) => a-b);
  let yieldSum = 0;
  for (const year of years) {
    // El 29 de febrero se ajusta al último día de febrero en años no bisiestos.
    const atYear = (date: Date, y: number) => Date.UTC(y, date.getUTCMonth(), Math.min(date.getUTCDate(), new Date(Date.UTC(y,date.getUTCMonth()+1,0)).getUTCDate()));
    const a = atYear(first, year), b = atYear(last, year+offset);
    let rain = 0, demand = 0, temperature = 0, days = 0, complete = true, heat = false, frost = false;
    let cursor = a;
    for (const { month, count, daysInMonth } of cycleMonths(a, b)) {
      const y = new Date(cursor).getUTCFullYear();
      const data = variables.map(variable => values.get(`${y}:${month}:${variable}`));
      if (data.some(value => value == null || !Number.isFinite(value) || value === -999) || data[3]! < 0 || data[4]! < 0) { complete = false; break; }
      const [mean, , min, precipitation, radiation] = data as number[];
      // T2M_MAX mensual es el extremo de un solo día; la tolerancia de ECOCROP aplica a la temperatura media.
      heat ||= mean > crop.tempMax;
      frost ||= crop.frostSensitive && min <= 0;
      temperature += mean*count;
      days += count;
      rain += precipitation*count/daysInMonth;
      demand += etoDaily(mean,radiation)*kcSeason(crop.kc)*count;
      cursor += count*dayMs;
    }
    if (!complete || days === 0 || demand <= 0) continue;
    const failures = { heat, frost, temperature: temperature/days < crop.tempMin || temperature/days > crop.tempMax, water: !irrigated && rain < .65*demand };
    result.totalYears++;
    if (!Object.values(failures).some(Boolean)) result.okYears++;
    for (const key of Object.keys(failures) as (keyof typeof failures)[]) if (failures[key]) result.failures[key]++;
    yieldSum += irrigated ? 100 : 100*Math.max(0,Math.min(1,1-crop.ky*(1-Math.min(1,rain/demand))));
  }
  result.relativeYieldPct = result.totalYears ? yieldSum/result.totalYears : null;
  return result;
}

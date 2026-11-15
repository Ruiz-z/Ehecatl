import type { Crop } from '../../crop-knowledge/crop-catalog.js';
import type { Indicators, Window } from '../../nasa-data/contracts.js';
import { cycleDemand, cycleMonths } from './evapotranspiration.js';
import { simulateCycle } from './historical.js';
import { viability } from './viability.js';

export const minHistoricalSuccess = 0.7;

const dayMs = 86_400_000;
const timestamp = (date: string) => Date.parse(`${date}T00:00:00Z`);

// Compara los arranques viables; sin cinco años conserva la primera fecha.
export function schedule(crop: Crop, window: Window, indicators: Indicators, earliest: number, simulate: typeof simulateCycle = simulateCycle) {
  const horizonEnd = Math.max(...indicators.windows.map(w => timestamp(w.end)));
  const limit = crop.perennial ? horizonEnd : timestamp(window.end);
  const reasons = new Set<string>();
  let best: { start: number; end: number; effective: Window; result: ReturnType<typeof viability>;
    water: { etoMm: number | null; kc: number; demandMm: number; rainMm: number | null; coveragePct: number | null; method: 'radiation' | 'catalog' };
    occupiedWindowIds: string[] } | null = null;
  let bestSuccess = -1;
  let bestHistory: ReturnType<typeof simulateCycle> | null = null;
  let bestWater: number | null = null;
  let bestDemand: number | null = null;
  for (let start = earliest; start <= timestamp(window.end);) {
    const end = start+(crop.cycleDays-1)*dayMs;
    if (end > limit) { reasons.add(`Ciclo de ${crop.cycleDays} días excede el horizonte o ventana disponible`); break; }
    let temperature = 0, knownDays = 0, rain = 0, rainDays = 0;
    const minimums: number[] = [], maximums: number[] = [];
    let unsuitable = false;
    for (const {month, count, daysInMonth} of cycleMonths(start, end)) {
      const normal = (variable: string) => indicators.climatology.find(n => n.variable === variable && n.month === month)?.value;
      const t = normal('T2M'), p = normal('PRECTOTCORR'), lo = normal('T2M_MIN'), hi = normal('T2M_MAX');
      if (t !== undefined) { temperature += t*count; knownDays += count; if (t < crop.tempMin || t > crop.tempMax) unsuitable = true; }
      if (p !== undefined) { rain += p*count/daysInMonth; rainDays += count; }
      if (lo !== undefined) minimums.push(lo);
      if (hi !== undefined) maximums.push(hi);
    }
    const effective: Window = { ...window, durationDays: crop.cycleDays,
      meanTemperature: knownDays ? temperature/knownDays : window.meanTemperature,
      temperatureMin: minimums.length ? Math.min(...minimums) : window.temperatureMin,
      temperatureMax: maximums.length ? Math.max(...maximums) : window.temperatureMax,
      precipitationMm: rainDays === crop.cycleDays ? rain : window.precipitationMm === null ? null : window.precipitationMm*crop.cycleDays/window.durationDays };
    const demand = cycleDemand(crop, start, end, indicators.climatology);
    const result = viability(crop, effective, indicators, Math.floor((limit-start)/dayMs)+1, demand.demandMm);
    if (demand.warning) result.risks.push(demand.warning);
    const rainMm = result.waterMm;
    const water = { etoMm: demand.etoMm, kc: demand.kc, demandMm: demand.demandMm, rainMm,
      coveragePct: rainMm === null ? null : 100*Math.min(1, Math.max(0, rainMm)/demand.demandMm), method: demand.method };
    if (!unsuitable && result.viable) {
      if (knownDays < crop.cycleDays || rainDays < crop.cycleDays) result.risks.push('Climatología mensual incompleta: se usó el resumen de la ventana');
      const candidate = { start, end, effective, result, water,
        occupiedWindowIds: indicators.windows.filter(w => timestamp(w.start) <= end && timestamp(w.end) >= start).map(w => w.id) };
      const simulation = simulate(crop, new Date(start).toISOString().slice(0,10), new Date(end).toISOString().slice(0,10), indicators.history, window.irrigated);
      if (simulation.totalYears < 5) return { scheduled: candidate, reasons: [] as string[] };
      const success = simulation.okYears/simulation.totalYears;
      if (!bestHistory || success > bestHistory.okYears/bestHistory.totalYears) bestHistory = simulation;
      if (success >= minHistoricalSuccess && success > bestSuccess) { best = candidate; bestSuccess = success; }
    }
    if (unsuitable) reasons.add('Meses del ciclo fuera del rango térmico del cultivo');
    if (result.waterMm !== null && (bestWater === null || result.waterMm > bestWater)) {
      bestWater = result.waterMm; bestDemand = demand.demandMm;
    }
    result.reasons.forEach(reason => reasons.add(reason.startsWith('Agua estimada') ? 'Agua insuficiente para la demanda del ciclo' :
      reason.startsWith('Temperatura ') ? `Temperatura del ciclo fuera de ${crop.tempMin}–${crop.tempMax} C` : reason));
    const first = new Date(start);
    start = Date.UTC(first.getUTCFullYear(), first.getUTCMonth()+1, 1);
  }
  if (best) return { scheduled: best, reasons: [] as string[] };
  if (bestHistory) reasons.add(`Solo ${bestHistory.okYears} de ${bestHistory.totalYears} años dentro de lo que aguanta el cultivo`);
  if (bestWater !== null && !window.irrigated) reasons.add(`Mejor lluvia disponible ${bestWater.toFixed(0)} mm frente a demanda de ${bestDemand?.toFixed(0)} mm/ciclo`);
  return { scheduled: null, reasons: [...reasons] };
}

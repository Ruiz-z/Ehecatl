import type { Crop } from '../../crop-knowledge/crop-catalog.js';
import type { Indicators, Window } from '../../nasa-data/contracts.js';
import { viability } from './viability.js';

const dayMs = 86_400_000;
const timestamp = (date: string) => Date.parse(`${date}T00:00:00Z`);

// Busca la primera siembra factible dentro de la ventana, usando solamente
// los meses ocupados por el cultivo. Una helada de enero no veta todo el verano.
export function schedule(crop: Crop, window: Window, indicators: Indicators, earliest: number) {
  const horizonEnd = Math.max(...indicators.windows.map(w => timestamp(w.end)));
  const limit = crop.perennial ? horizonEnd : timestamp(window.end);
  const reasons = new Set<string>();
  let bestWater: number | null = null;
  for (let start = earliest; start <= timestamp(window.end);) {
    const end = start+(crop.cycleDays-1)*dayMs;
    if (end > limit) { reasons.add(`Ciclo de ${crop.cycleDays} días excede el horizonte o ventana disponible`); break; }
    let temperature = 0, knownDays = 0, rain = 0, rainDays = 0;
    const minimums: number[] = [], maximums: number[] = [];
    let unsuitable = false;
    for (let cursor = start; cursor <= end;) {
      const current = new Date(cursor);
      const nextMonth = Date.UTC(current.getUTCFullYear(), current.getUTCMonth()+1, 1);
      const coveredDays = Math.min(nextMonth, end+dayMs)-cursor;
      const count = coveredDays/dayMs;
      const daysInMonth = new Date(nextMonth-dayMs).getUTCDate();
      const normal = (variable: string) => indicators.climatology.find(n => n.variable === variable && n.month === current.getUTCMonth()+1)?.value;
      const t = normal('T2M'), p = normal('PRECTOTCORR'), lo = normal('T2M_MIN'), hi = normal('T2M_MAX');
      if (t !== undefined) { temperature += t*count; knownDays += count; if (t < crop.tempMin || t > crop.tempMax) unsuitable = true; }
      if (p !== undefined) { rain += p*count/daysInMonth; rainDays += count; }
      if (lo !== undefined) minimums.push(lo);
      if (hi !== undefined) maximums.push(hi);
      cursor = nextMonth;
    }
    const effective: Window = { ...window, durationDays: crop.cycleDays,
      meanTemperature: knownDays ? temperature/knownDays : window.meanTemperature,
      temperatureMin: minimums.length ? Math.min(...minimums) : window.temperatureMin,
      temperatureMax: maximums.length ? Math.max(...maximums) : window.temperatureMax,
      precipitationMm: rainDays === crop.cycleDays ? rain : window.precipitationMm === null ? null : window.precipitationMm*crop.cycleDays/window.durationDays };
    const result = viability(crop, effective, indicators, Math.floor((limit-start)/dayMs)+1);
    if (!unsuitable && result.viable) {
      if (knownDays < crop.cycleDays || rainDays < crop.cycleDays) result.risks.push('Climatología mensual incompleta: se usó el resumen de la ventana');
      return { scheduled: { start, end, effective, result,
        occupiedWindowIds: indicators.windows.filter(w => timestamp(w.start) <= end && timestamp(w.end) >= start).map(w => w.id) }, reasons: [] as string[] };
    }
    if (unsuitable) reasons.add('Meses del ciclo fuera del rango térmico del cultivo');
    if (result.waterMm !== null) bestWater = Math.max(bestWater ?? 0, result.waterMm);
    result.reasons.forEach(reason => reasons.add(reason.startsWith('Agua estimada') ? 'Agua insuficiente para la demanda del ciclo' :
      reason.startsWith('Temperatura ') ? `Temperatura del ciclo fuera de ${crop.tempMin}–${crop.tempMax} C` : reason));
    const first = new Date(start);
    start = Date.UTC(first.getUTCFullYear(), first.getUTCMonth()+1, 1);
  }
  if (bestWater !== null && !window.irrigated) reasons.add(`Mejor lluvia disponible ${bestWater.toFixed(0)} mm frente a demanda de ${crop.waterMm} mm/ciclo`);
  return { scheduled: null, reasons: [...reasons] };
}

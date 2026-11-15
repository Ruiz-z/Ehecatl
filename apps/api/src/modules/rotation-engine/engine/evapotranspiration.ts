import type { Crop } from '../../crop-knowledge/crop-catalog.js';
import type { Indicators } from '../../nasa-data/contracts.js';

const dayMs = 86_400_000;

// Aproximación por radiación; Rs en MJ/m²/día. Constantes pendientes H4.
export function etoDaily(tMean: number, rs: number): number {
  return 0.0135 * (tMean + 17.8) * rs * 0.408;
}
export function kcSeason(kc: Crop['kc']): number {
  return .2*kc.ini + .25*(kc.ini+kc.mid)/2 + .35*kc.mid + .2*(kc.mid+kc.end)/2;
}
// Comparte el recorrido inclusivo del calendario para lluvia, temperatura y ETo.
export function* cycleMonths(start: number, end: number) {
  for (let cursor = start; cursor <= end;) {
    const current = new Date(cursor);
    const nextMonth = Date.UTC(current.getUTCFullYear(), current.getUTCMonth()+1, 1);
    yield { month: current.getUTCMonth()+1, count: (Math.min(nextMonth, end+dayMs)-cursor)/dayMs,
      daysInMonth: new Date(nextMonth-dayMs).getUTCDate() };
    cursor = nextMonth;
  }
}
export function cycleDemand(crop: Crop, start: number, end: number, climatology: Indicators['climatology']) {
  const kc = kcSeason(crop.kc);
  let etoMm = 0;
  for (const {month, count} of cycleMonths(start, end)) {
    const t = climatology.find(n => n.month === month && n.variable === 'T2M')?.value;
    const rs = climatology.find(n => n.month === month && n.variable === 'ALLSKY_SFC_SW_DWN')?.value;
    if (!Number.isFinite(t) || !Number.isFinite(rs) || rs! < 0) {
      return { etoMm: null, kc, demandMm: crop.waterMm, method: 'catalog' as const,
        warning: 'Demanda estimada del catálogo: falta temperatura o radiación mensual válida para ETo' };
    }
    etoMm += etoDaily(t!, rs!)*count;
  }
  // Una demanda nula no permite calcular cobertura; se explicita el respaldo.
  if (etoMm <= 0) return { etoMm: null, kc, demandMm: crop.waterMm, method: 'catalog' as const,
    warning: 'Demanda estimada del catálogo: ETo del ciclo no positiva' };
  return { etoMm, kc, demandMm: etoMm*kc, method: 'radiation' as const, warning: null };
}

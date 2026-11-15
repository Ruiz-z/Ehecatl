import type { CycleWater, Reason } from './types';

export interface StepSummary { shown: Reason[]; hidden: Reason[] }
// A la vista queda un motivo a favor y todo lo que va en contra; el resto se abre bajo demanda.
export function summarizeStep(reasons: Reason[] = []): StepSummary {
  const firstFavor = reasons.find(reason => reason.effect === 'favor');
  const shown = reasons.filter(reason => reason === firstFavor || reason.effect === 'contra');
  if (!shown.length && reasons[0]) shown.push(reasons[0]);
  return { shown, hidden: reasons.filter(reason => !shown.includes(reason)) };
}
export function waterSentence(water: CycleWater | undefined, irrigated: boolean): string {
  if (!water) return 'No se pudo calcular el agua de este ciclo.';
  if (water.coveragePct === null) return 'No hay dato de lluvia para este ciclo.';
  if (water.coveragePct >= 100) return 'La lluvia alcanza para este ciclo.';
  const share = `La lluvia da ${Math.round(water.coveragePct)} % del agua que necesita`;
  return irrigated ? `${share}. El resto sale del riego.` : `${share} y no tienes riego.`;
}

import type { CycleWater, Reason, RotationStep } from './types';

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

export function historicalSentence(step: RotationStep): string {
  if (!step.risk) return 'Sin historia suficiente: riesgo estimado con el promedio.';
  const { okYears, totalYears, failures } = step.risk;
  const labels = { heat: 'calor de más', frost: 'helada', temperature: 'temperatura fuera de tolerancia', water: 'lluvia insuficiente' };
  const cause = (Object.keys(labels) as (keyof typeof labels)[]).sort((a,b) => failures[b]-failures[a])[0]!;
  const count = failures[cause];
  return `En ${okYears} de los ${totalYears} años con datos completos el clima de esos meses quedó dentro de lo que aguanta el cultivo de ${step.cropName.toLowerCase()}.` +
    (count ? ` ${count} ${count === 1 ? 'año' : 'años'} con ${labels[cause]}.` : '');
}
export function yieldSentence(value: RotationStep['yield']): string {
  if (!value) return 'Cosecha usa el indicador previo del catálogo por falta de historia suficiente. No es rendimiento calculado.';
  return `Cosecha: ${Math.round(value.relativePct)} % del potencial según el agua disponible.` +
    (value.irrigatedAssumed ? ' Con tu riego se asume demanda cubierta. Este eje da 100 y no distingue cultivos.' : '') +
    (value.kyEstimated ? ' Ky estimado con un cultivo afín.' : '');
}

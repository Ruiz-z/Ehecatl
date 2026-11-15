import type { Observation } from './types.ts';
import { copy } from './copy.ts';
function monthLabel(month: string): string {
  return /^\d{4}-\d{2}$/.test(month) ? new Intl.DateTimeFormat('es-MX', { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)) : month;
}
export function buildVerdict(observations: Observation[], cropName: string, lastDataMonth: string, expectedMonth: string, vegetationLow = false) {
  const drought = observations.find(row => row.variable === 'PRECTOTCORR')?.alertActive;
  const heat = observations.find(row => row.variable === 'T2M_MAX')?.alertActive;
  const known = drought !== undefined && heat !== undefined;
  const plantsOnly = known && !drought && !heat && vegetationLow;
  return {
    title: drought ? copy.verdict.water : heat ? copy.verdict.heat : plantsOnly ? copy.verdict.plants : known ? copy.verdict.clear : copy.insufficient,
    text: drought && heat ? copy.verdict.both(cropName) : drought ? copy.verdict.drought(cropName) : heat ? copy.verdict.hot(cropName) : plantsOnly ? copy.verdict.plantsText : known ? copy.verdict.calm : '',
    tone: drought || heat || plantsOnly ? 'warning' as const : known ? 'good' as const : 'neutral' as const,
    showButton: Boolean(drought || heat),
    ...(lastDataMonth && expectedMonth && (/^\d{4}-\d{2}$/.test(lastDataMonth) ? lastDataMonth < expectedMonth : lastDataMonth !== expectedMonth) ? { note: copy.verdict.pending(monthLabel(expectedMonth), monthLabel(lastDataMonth)) } : {})
  };
}

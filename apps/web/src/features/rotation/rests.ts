import type { Rest } from './types';
const clearer: Record<string, string> = {
  'ningún cultivo completa su ciclo en este tramo': 'el periodo es demasiado corto para completar un ciclo'
};
export interface RestSummary { items: { start: string; end: string; reason: string }[]; suggestion: string | null }
// La sugerencia se dice una sola vez cuando todos los descansos coinciden.
export function summarizeRests(rests: Rest[]): RestSummary {
  const suggestions = new Set(rests.map(rest => rest.suggestion.toLowerCase()));
  const shared = suggestions.size === 1 ? [...suggestions][0] ?? null : null;
  return {
    items: rests.map(rest => {
      const reason = rest.reason.toLowerCase();
      return { start: rest.start, end: rest.end, reason: clearer[reason] ?? reason + (shared ? '' : ` · ${rest.suggestion.toLowerCase()}`) };
    }),
    suggestion: shared
  };
}

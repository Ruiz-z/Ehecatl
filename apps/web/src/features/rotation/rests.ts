import type { Rest } from './types';
export interface RestSummary { items: { start: string; end: string; reason: string }[]; suggestion: string | null }
// La sugerencia se dice una sola vez cuando todos los descansos coinciden.
export function summarizeRests(rests: Rest[]): RestSummary {
  const suggestions = new Set(rests.map(rest => rest.suggestion.toLowerCase()));
  const shared = suggestions.size === 1 ? [...suggestions][0] ?? null : null;
  return {
    items: rests.map(rest => {
      const reason = rest.reason.charAt(0).toLowerCase() + rest.reason.slice(1);
      return { start: rest.start, end: rest.end, reason: reason + (shared ? '' : ` · ${rest.suggestion.toLowerCase()}`) };
    }),
    suggestion: shared
  };
}

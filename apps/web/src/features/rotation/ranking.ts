import type { Priorities } from '@/features/parcels/types';
import type { RankedStrategy, Strategy } from './types.ts';
export const axes: {
  key: keyof Priorities;
  label: string;
  description: string;
}[] = [{
  key: 'water',
  label: 'Agua',
  description: 'Usar menos agua'
}, {
  key: 'soil',
  label: 'Suelo',
  description: 'Recuperar la tierra'
}, {
  key: 'income',
  label: 'Cosecha',
  description: 'Rendimiento esperado frente al potencial'
}, {
  key: 'risk',
  label: 'Riesgo',
  description: 'Buscar más seguridad'
}];
export function normalizedWeights(weights: Priorities): Priorities {
  const total = Object.values(weights).reduce((a, b) => a + Math.max(0, b), 0);
  return Object.fromEntries(axes.map(({
    key
  }) => [key, total ? Math.max(0, weights[key]) / total : 0.25])) as Priorities;
}
export function rankStrategies(strategies: Strategy[], weights: Priorities): RankedStrategy[] {
  const normalized = normalizedWeights(weights);
  const scored = strategies.map(strategy => ({
    ...strategy,
    score: Math.round(axes.reduce((sum, {
      key
    }) => sum + strategy.axes[key] * normalized[key], 0))
  }));
  const baseline = scored.find(strategy => strategy.baseline)?.score;
  return scored.map(strategy => ({
    ...strategy,
    delta: baseline === undefined ? null : strategy.score - baseline
  })).sort((a, b) => b.score - a.score || b.axes.risk - a.axes.risk || a.name.localeCompare(b.name));
}

export function scoreLevel(score: number): 'alto' | 'medio' | 'bajo' {
  return score >= 70 ? 'alto' : score >= 50 ? 'medio' : 'bajo';
}
export function scoreContributions(values: Priorities, weights: Priorities) {
  const normalized = normalizedWeights(weights);
  return axes.map(({key, label}) => ({key, label, value: values[key]*normalized[key]}));
}

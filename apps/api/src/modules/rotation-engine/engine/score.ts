import type { Weights } from '../../nasa-data/contracts.js';

export function weightedScore(components: Weights, priorities: Weights): number {
  const value = (components.water*priorities.water + components.soil*priorities.soil + components.income*priorities.income + components.risk*priorities.risk)/100;
  return Math.round(Math.max(0, Math.min(100, value))*100)/100;
}

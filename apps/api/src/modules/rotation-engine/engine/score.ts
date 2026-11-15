import type { HistoricalRisk } from './historical.js';
import type { Crop } from '../../crop-knowledge/crop-catalog.js';
import type { Indicators, Window } from '../../nasa-data/contracts.js';
import type { Weights } from '../../nasa-data/contracts.js';

export function weightedScore(components: Weights, priorities: Weights): number {
  const value = (components.water*priorities.water + components.soil*priorities.soil + components.income*priorities.income + components.risk*priorities.risk)/100;
  return Math.round(Math.max(0, Math.min(100, value))*100)/100;
}

export function riskScore(result: HistoricalRisk): number {
  return result.totalYears > 0 ? 100*result.okYears/result.totalYears : 0;
}

// Respaldo compatible sin cinco años completos. No representa frecuencia histórica; pendiente de H4.
export function estimatedRiskScore(crop: Crop, climate: Window, indicators: Indicators, coverage: number, repeatedFamily: boolean): number {
  const heat = climate.temperatureMax === null ? 0 : Math.min(30, Math.max(0, climate.temperatureMax-crop.tempMax)*4);
  const t = climate.meanTemperature;
  const optimal = t === null ? 0 : Math.min(20, Math.max(0, crop.tempOptMin-t, t-crop.tempOptMax)*3);
  const frost = crop.frostSensitive && climate.temperatureMin !== null && climate.temperatureMin < 2 ? 20 : 0;
  const drought = indicators.trends.some(t => t.active && t.type === 'drought') && crop.droughtTolerance < 60 ? 15 : 0;
  const trendHeat = indicators.trends.some(t => t.active && t.type === 'heat') ? 10 : 0;
  return Math.max(0, Math.min(100, 100-heat-optimal-frost-(climate.irrigated ? 15 : 30)*(1-coverage)-drought-trendHeat-(repeatedFamily ? 20 : 0)));
}

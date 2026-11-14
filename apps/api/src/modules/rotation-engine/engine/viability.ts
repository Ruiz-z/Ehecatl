import type { Crop } from '../../crop-knowledge/crop-catalog.js';
import type { Indicators, Window } from '../../nasa-data/contracts.js';

export function viability(crop: Crop, window: Window, indicators: Indicators, availableDays = window.durationDays) {
  const reasons: string[] = [], risks: string[] = [];
  if (window.meanTemperature === null) risks.push('Falta temperatura media: viabilidad provisional');
  else if (window.meanTemperature < crop.tempMin || window.meanTemperature > crop.tempMax) reasons.push(`Temperatura ${window.meanTemperature.toFixed(1)} C fuera de ${crop.tempMin}–${crop.tempMax} C`);
  if (crop.frostSensitive && window.temperatureMin !== null && window.temperatureMin <= 0) reasons.push('Riesgo de helada en cultivo sensible');
  if (window.temperatureMax !== null && window.temperatureMax > crop.tempMax) risks.push(`Máxima mensual ${window.temperatureMax.toFixed(1)} C supera tolerancia ${crop.tempMax} C`);
  if (crop.cycleDays > availableDays) reasons.push(`Ciclo de ${crop.cycleDays} días excede ${availableDays} días disponibles`);
  // Lluvia proporcional a la duración del cultivo, no toda la lluvia de una ventana de 24 meses.
  const water = window.precipitationMm === null ? null : window.precipitationMm * Math.min(1, crop.cycleDays / window.durationDays);
  if (!window.irrigated) {
    if (water === null) risks.push('Falta precipitación: disponibilidad de agua incierta');
    else if (water < crop.waterMm * .65) reasons.push(`Agua estimada ${water.toFixed(0)} mm insuficiente para ${crop.waterMm} mm/ciclo`);
    else if (water < crop.waterMm) risks.push(`Déficit hídrico potencial: ${water.toFixed(0)}/${crop.waterMm} mm`);
  } else risks.push('Viabilidad hídrica depende de disponibilidad efectiva de riego');
  if (indicators.trends.some(t => t.active && t.type === 'drought') && crop.droughtTolerance < 60) risks.push('Sequía observada y baja tolerancia del cultivo');
  if (indicators.trends.some(t => t.active && t.type === 'heat') && (crop.tempMax < 35 || crop.droughtTolerance < 60)) risks.push('Calor observado: posible estrés térmico');
  return { viable: reasons.length === 0, reasons, risks, waterMm: water };
}

export function currentRisk(crop: Crop, indicators: Indicators) {
  const reasons: string[] = [];
  if (indicators.trends.some(t => t.active && t.type === 'drought') && crop.droughtTolerance < 60) reasons.push('Sequía NASA y baja tolerancia del cultivo actual');
  if (indicators.trends.some(t => t.active && t.type === 'heat') && (crop.tempMax < 35 || crop.droughtTolerance < 60)) reasons.push('Calor NASA y sensibilidad del cultivo actual');
  return { level: reasons.length ? 'high' as const : 'low' as const, reasons };
}

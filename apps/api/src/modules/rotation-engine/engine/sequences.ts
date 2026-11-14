import { crops, findCrop, type Crop } from '../../crop-knowledge/crop-catalog.js';
import type { History, Indicators, Weights } from '../../nasa-data/contracts.js';
import { normalizeWeights } from '../../farm-context/priorities/normalize.js';
import { transition } from './transitions.js';
import { currentRisk } from './viability.js';
import { weightedScore } from './score.js';
import { schedule } from './schedule.js';

interface Step { cropId: string; cropName: string; windowId: string; start: string; end: string; occupiedWindowIds: string[] }
interface Candidate { id: string; score: number; sequence: Step[]; components: Weights; explanation: string[]; risks: string[] }
const dayMs = 86_400_000;
const day = (value: string) => Date.parse(`${value}T00:00:00Z`);
const iso = (value: number) => new Date(value).toISOString().slice(0, 10);

export function recommend(input: { currentCropId: string; history: History[]; priorities: Weights; indicators: Indicators }, catalog: Crop[] = crops) {
  const current = findCrop(input.currentCropId);
  if (!current) throw new Error('Current crop not in catalog');
  const { indicators, history } = input;
  const decisionDay = day(indicators.fetchedAt.slice(0, 10));
  const priorities = normalizeWeights(input.priorities);
  const windows = indicators.windows.slice().sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
  const warnings = [...indicators.warnings];
  const missing = Object.values(indicators.sources).some(s => s.status !== 'available') ||
    indicators.monthly.some(m => m.value === null) || !indicators.monthly.length ||
    windows.some(w => w.meanTemperature === null || w.precipitationMm === null || w.temperatureMin === null);
  if (!history.length) warnings.push('Sin historial: menor confianza en la rotación');
  if (missing) warnings.push('Datos NASA incompletos: confianza reducida');
  const failures = new Set<string>();
  const schedules = new Map<string, ReturnType<typeof schedule>>();
  let beam: Candidate[] = [{ id: '', score: 0, sequence: [], components: { water: 0, soil: 0, income: 0, risk: 0 }, explanation: [], risks: [] }];
  for (let cycle = 0; cycle < 3; cycle++) {
    const next: Candidate[] = [];
    for (const partial of beam) {
      const previousStep = partial.sequence.at(-1);
      const previous = previousStep ? catalog.find(c => c.id === previousStep.cropId) ?? findCrop(previousStep.cropId)! : current;
      let expanded = false;
      const continuationRisks = [...partial.risks];
      for (const window of windows) {
        const start = Math.max(decisionDay, previousStep ? day(previousStep.end) + dayMs : -Infinity, day(window.start));
        if (start > day(window.end)) continue;
        // Reutiliza el tiempo restante de una ventana continua, sin solapar ciclos.
        for (const crop of catalog) {
          const key = `${crop.id}:${window.id}:${start}`;
          let plan = schedules.get(key);
          if (!plan) { plan = schedule(crop, window, indicators, start); schedules.set(key, plan); }
          if (!plan.scheduled) { failures.add(`${crop.name}: ${plan.reasons.join('; ')}`); continue; }
          const { result, effective, start: planted, end, occupiedWindowIds } = plan.scheduled;
          const tr = transition(previous, crop, [...history, ...partial.sequence.map(s => ({ cropId: s.cropId, plantedAt: s.start, harvestedAt: s.end }))]);
          const components: Weights = {
            water: Math.max(0, Math.min(100, (1-crop.waterMm/1300)*70 + crop.droughtTolerance*.3)),
            soil: tr.score, income: crop.incomeOpportunity,
            risk: Math.max(0, 100-result.risks.length*18-(previous.family === crop.family ? 20 : 0)),
          };
          const count = partial.sequence.length;
          const combined = Object.fromEntries((Object.keys(components) as (keyof Weights)[]).map(key => [key, (partial.components[key]*count+components[key])/(count+1)])) as unknown as Weights;
          const sequence = [...partial.sequence, { cropId: crop.id, cropName: crop.name, windowId: window.id, start: iso(planted), end: iso(end), occupiedWindowIds }];
          next.push({ id: sequence.map(s => s.cropId).join('>'), sequence, components: combined, score: weightedScore(combined, priorities),
            explanation: [...partial.explanation, ...tr.reasons.map(r => `${previous.name} → ${crop.name}: ${r}`),
              `${crop.name}: NASA T2M=${effective.meanTemperature ?? 'faltante'} C; lluvia=${result.waterMm?.toFixed(0) ?? 'faltante'} mm/ciclo; ciclo=${crop.cycleDays} días`,
              `Pesos agua=${priorities.water}, suelo=${priorities.soil}, ingreso=${priorities.income}, riesgo=${priorities.risk}; ingreso es una heurística, no precio`],
            risks: [...continuationRisks, ...result.risks] });
          expanded = true;
        }
        if (expanded) break;
        continuationRisks.push(`Sin continuación viable en ${window.id}; considerar barbecho`);
      }
      if (!expanded) next.push({ ...partial, risks: continuationRisks });
    }
    beam = next.sort(compare).slice(0, 60);
  }
  const unique = new Map<string, Candidate>();
  for (const candidate of beam.filter(c => c.sequence.length).sort(compare)) {
    if (!unique.has(candidate.id)) unique.set(candidate.id, candidate);
  }
  const recommendations = [...unique.values()].sort(compare).slice(0, 3);
  if (!recommendations.some(c => c.sequence.length >= 2)) warnings.push('Menos de dos ciclos viables en 24 meses: secuencia reducida; considerar cobertura o barbecho');
  if (!recommendations.length) warnings.push('Ninguna opción viable; considerar cobertura o barbecho', ...[...failures].sort());
  const confidence = missing ? 'low' as const : !history.length || warnings.length ? 'medium' as const : 'high' as const;
  const risk = currentRisk(current, indicators);
  return { status: recommendations.length ? 'ok' as const : 'no_viable_options' as const, confidence,
    warnings: [...new Set(warnings)], priorities, currentCropRisk: { ...risk, changeAt: recommendations[0]?.sequence[0].start ?? null }, recommendations };
}

function compare(a: Candidate, b: Candidate): number {
  return b.score-a.score || b.components.risk-a.components.risk ||
    a.sequence.map(s => s.cropName).join('>').localeCompare(b.sequence.map(s => s.cropName).join('>'), 'en') || a.id.localeCompare(b.id, 'en');
}

import { groupRisks, type RiskGroup } from './risk-groups.js';
import { crops, findCrop, type Crop } from '../../crop-knowledge/crop-catalog.js';
import type { History, Indicators, Weights } from '../../nasa-data/contracts.js';
import { normalizeWeights } from '../../farm-context/priorities/normalize.js';
import { transition, type TransitionReason } from './transitions.js';
import { currentRisk } from './viability.js';
import { weightedScore, riskScore, estimatedRiskScore } from './score.js';
import { simulateCycle, type HistoricalRisk } from './historical.js';
import { horizonEto } from './evapotranspiration.js';
import { schedule } from './schedule.js';

interface Step {
  cropId: string; cropName: string; windowId: string; start: string; end: string;
  occupiedWindowIds: string[];
  water: { etoMm: number | null; kc: number; demandMm: number; rainMm: number | null; coveragePct: number | null; method: 'radiation' | 'catalog' };
  risk: HistoricalRisk | null;
  yield: { relativePct: number; ky: number; irrigatedAssumed: boolean; kyEstimated: boolean; kySource: string } | null;
  reasons: TransitionReason[];
  climate: { meanTemperature: number | null; rainMm: number | null; cycleDays: number };
}
interface Candidate { cycleRisks: string[][]; irrigationNeedMm: number; id: string; score: number; sequence: Step[]; components: Weights; explanation: string[]; risks: string[] }
const dayMs = 86_400_000;
const day = (value: string) => Date.parse(`${value}T00:00:00Z`);
const iso = (value: number) => new Date(value).toISOString().slice(0, 10);
interface Input { currentCropId: string; history: History[]; priorities: Weights; indicators: Indicators }

export function recommend(input: Input, catalog: Crop[] = crops) {
  const current = findCrop(input.currentCropId);
  if (!current) throw new Error('Current crop not in catalog');
  const { indicators, history } = input;
  const priorities = normalizeWeights(input.priorities);
  const windows = indicators.windows.slice().sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
  const warnings = [...indicators.warnings];
  // Los meses más recientes de POWER tardan en publicarse: un hueco ahí baja la confianza a media, no a baja.
  const powerMissing = indicators.sources.power.status !== 'available' || !indicators.monthly.some(m => m.variable !== 'NDVI' && m.value !== null);
  const powerGaps = !powerMissing && indicators.monthly.some(m => m.variable !== 'NDVI' && m.value === null);
  const observedMonths = (date: string) => Number(date.slice(0,4))*12+Number(date.slice(5,7));
  const expectedMonths = observedMonths(indicators.period.end)-observedMonths(indicators.period.start)+1;
  const ndviMonths = new Set(indicators.monthly.filter(m => m.variable === 'NDVI' && m.value !== null).map(m => m.date.slice(0,7))).size;
  const modisMissing = indicators.sources.modis.status !== 'available' || ndviMonths < expectedMonths ||
    indicators.monthly.some(m => m.variable === 'NDVI' && m.value === null);
  const shortHistory = indicators.climatology.some(n => n.samples < 10);
  const incompleteClimate = windows.some(w => w.meanTemperature === null || w.precipitationMm === null || w.temperatureMin === null || w.temperatureMax === null);
  if (!history.length) warnings.push('Sin historial: menor confianza en la rotación');
  if (powerMissing) warnings.push('POWER incompleto o no disponible: faltan datos climáticos para la demanda');
  if (powerGaps) warnings.push('POWER aún no publica los meses más recientes: la demanda usa la normal histórica');
  if (modisMissing) warnings.push('MODIS incompleto o no disponible: faltan observaciones de vegetación');
  if (shortHistory) warnings.push('Normal histórica con años faltantes: interpretar con menor confianza');
  if (incompleteClimate) warnings.push('Clima de las ventanas incompleto: faltan márgenes de viabilidad');

  const horizonStart = new Date(day(indicators.period.end));
  horizonStart.setUTCMonth(horizonStart.getUTCMonth() + 1, 1);
  const horizonEnd = new Date(horizonStart);
  horizonEnd.setUTCMonth(horizonEnd.getUTCMonth() + 24);
  const horizon = { start: iso(horizonStart.getTime()), end: iso(horizonEnd.getTime() - dayMs) };
  const etoMm = horizonEto(day(indicators.fetchedAt.slice(0, 10)), day(horizon.end), indicators.climatology);
  if (etoMm === null) {
    warnings.push('ETo del horizonte no disponible: se usa la suma de demandas de la secuencia');
  }
  const generated = generate(input, catalog, etoMm);
  const currentResult = generate(input, [current], etoMm);
  const complete = ({ cycleRisks, ...candidate }: Candidate) => ({ ...candidate,
    riskGroups: groupRisks(cycleRisks, candidate.risks, candidate.irrigationNeedMm, indicators.windows.some(w => w.irrigated)),
    irrigationNeedMm: Math.round(candidate.irrigationNeedMm),
    sequence: candidate.sequence.map(step => ({...step, water: {...step.water,
      coveragePct: step.water.coveragePct === null ? null : Number(step.water.coveragePct.toFixed(1))}})),
    rests: rests(candidate.sequence, indicators.windows, horizon),
    risks: [...new Set([...candidate.risks, `Agua faltante en 24 meses: ~${Math.round(candidate.irrigationNeedMm)} mm${indicators.windows.some(w => w.irrigated) ? '; con riego depende de su disponibilidad efectiva' : ': la lluvia no cubre la demanda'}`])],
    explanation: [...candidate.explanation, `Pesos agua=${priorities.water}, suelo=${priorities.soil}, cosecha=${priorities.income}, riesgo=${priorities.risk}; ${candidate.sequence.some(step => step.yield === null) ? 'cosecha usa el indicador previo del catálogo en ciclos sin historia suficiente' : 'cosecha es rendimiento relativo frente al potencial'}`] });
  const currentPlan = currentResult.candidates[0] ? complete(currentResult.candidates[0]) : undefined;
  const baselineReasons = !windows.length ? ['Sin ventanas de cultivo disponibles']
    : currentResult.failures.length ? currentResult.failures : ['No cabe un ciclo del cultivo actual en las ventanas disponibles'];
  const baseline = currentPlan
    ? { ...currentPlan, id: 'baseline', viable: true as const }
    : { id: 'baseline', irrigationNeedMm: 0, viable: false as const, score: null, components: null, sequence: [] as Step[],
      explanation: baselineReasons, riskGroups: [] as RiskGroup[], risks: [] as string[], rests: rests([], indicators.windows, horizon) };
  const recommendations = generated.candidates.filter(candidate => candidate.sequence.some(step => step.cropId !== current.id)).slice(0, 2)
    .map(candidate => ({ ...complete(candidate), delta: baseline.score === null ? null : Number((candidate.score-baseline.score).toFixed(2)) }));
  if (![...recommendations, ...(currentPlan ? [currentPlan] : [])].some(c => c.sequence.length >= 2)) warnings.push('Menos de dos ciclos viables en 24 meses: secuencia reducida; considerar cobertura o barbecho');
  const viable = recommendations.length > 0 || baseline.viable;
  if (!viable) warnings.push('Ninguna opción viable; considerar cobertura o barbecho', ...generated.failures);
  const steps = [...baseline.sequence, ...recommendations.flatMap(r => r.sequence)];
  if (steps.some(step => step.water.method === 'catalog' || step.water.rainMm === null)) {
    warnings.push('Balance hídrico incompleto: demanda del catálogo o lluvia desconocida');
  }
  const historicalFallback = steps.some(step => step.risk === null);
  if (historicalFallback) warnings.push('Sin historia suficiente: riesgo estimado con el promedio');
  if (steps.some(step => step.yield?.irrigatedAssumed)) warnings.push('Con riego se asume demanda cubierta: Cosecha da 100 y no distingue cultivos. Ahí deciden agua, suelo y riesgo');
  if (steps.some(step => step.yield?.kyEstimated)) warnings.push('Ky estimado por cultivo afín de la tabla FAO: revisa la fuente en cada paso');
  const catalogDemand = steps.some(step => step.water.method === 'catalog');
  const confidence = powerMissing || catalogDemand ? 'low' as const
    : historicalFallback || powerGaps || modisMissing || shortHistory || incompleteClimate || !history.length || etoMm === null || indicators.warnings.length
      ? 'medium' as const : 'high' as const;
  const risk = currentRisk(current, indicators);
  return { status: viable ? 'ok' as const : 'no_viable_options' as const, confidence,
    warnings: [...new Set(warnings)], priorities, baseline, currentCropRisk: { ...risk, changeAt: recommendations[0]?.sequence[0].start ?? null }, recommendations };
}

// La referencia y las alternativas pasan por la misma búsqueda y puntuación.
function generate(input: Input, catalog: Crop[], etoMm: number | null) {
  const current = findCrop(input.currentCropId)!;
  const { indicators, history } = input;
  const decisionDay = day(indicators.fetchedAt.slice(0, 10));
  const priorities = normalizeWeights(input.priorities);
  const windows = indicators.windows.slice().sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
  const failures = new Set<string>();
  const simulations = new Map<string, ReturnType<typeof simulateCycle>>();
  const schedules = new Map<string, ReturnType<typeof schedule>>();
  let beam: Candidate[] = [{ cycleRisks: [], irrigationNeedMm: 0, id: '', score: 0, sequence: [], components: { water: 0, soil: 0, income: 0, risk: 0 }, explanation: [], risks: [] }];
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
          const { result, effective, water, start: planted, end, occupiedWindowIds } = plan.scheduled;
          const tr = transition(previous, crop, [...history, ...partial.sequence.map(s => ({ cropId: s.cropId, plantedAt: s.start, harvestedAt: s.end }))]);
          const coverage = (water.coveragePct ?? 0)/100;
          const simulationKey = `${crop.id}:${planted}:${end}:${effective.irrigated}`;
          let simulation = simulations.get(simulationKey);
          if (!simulation) {
            simulation = simulateCycle(crop, iso(planted), iso(end), indicators.history, effective.irrigated);
            simulations.set(simulationKey, simulation);
          }
          const measured = simulation.totalYears >= 5;
          const components: Weights = {
            water: 0,
            soil: tr.score, income: measured ? simulation.relativeYieldPct! : crop.incomeOpportunity,
            risk: measured ? riskScore(simulation) : estimatedRiskScore(crop, effective, indicators, coverage, previous.family === crop.family),
          };
          const count = partial.sequence.length;
          const combined = Object.fromEntries((Object.keys(components) as (keyof Weights)[]).map(key => [key, (partial.components[key]*count+components[key])/(count+1)])) as unknown as Weights;
          const sequence = [...partial.sequence, {
            cropId: crop.id, cropName: crop.name, windowId: window.id,
            start: iso(planted), end: iso(end), occupiedWindowIds, water, reasons: tr.reasons,
            risk: measured ? { okYears: simulation.okYears, totalYears: simulation.totalYears, failures: simulation.failures } : null,
            yield: measured ? { relativePct: simulation.relativeYieldPct!, ky: crop.ky, irrigatedAssumed: effective.irrigated, kyEstimated: crop.kyEstimated, kySource: crop.kySource } : null,
            climate: {
              meanTemperature: effective.meanTemperature === null ? null : Number(effective.meanTemperature.toFixed(1)),
              rainMm: result.waterMm === null ? null : Math.round(result.waterMm),
              cycleDays: crop.cycleDays,
            },
          }];
          const irrigationNeedMm = partial.irrigationNeedMm + Math.max(0, water.demandMm-(water.rainMm ?? 0));
          const referenceMm = etoMm ?? sequence.reduce((sum, step) => sum+step.water.demandMm, 0);
          combined.water = Math.max(0, Math.min(100, 100*(1-irrigationNeedMm/referenceMm)));
          next.push({ cycleRisks: [...partial.cycleRisks, result.risks], irrigationNeedMm, id: sequence.map(s => s.cropId).join('>'), sequence, components: combined, score: weightedScore(combined, priorities),
            explanation: [...partial.explanation, ...tr.reasons.map(r => `${previous.name} → ${crop.name}: ${r.text}`),
              `${crop.name}: NASA T2M=${effective.meanTemperature?.toFixed(1) ?? 'faltante'} C; lluvia=${result.waterMm?.toFixed(0) ?? 'faltante'} mm/ciclo; ciclo=${crop.cycleDays} días`],
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
  return { candidates: [...unique.values()].sort(compare), failures: [...failures].sort() };
}

function compare(a: Candidate, b: Candidate): number {
  return b.score-a.score || b.components.risk-a.components.risk ||
    a.sequence.map(s => s.cropName).join('>').localeCompare(b.sequence.map(s => s.cropName).join('>'), 'en') || a.id.localeCompare(b.id, 'en');
}

export interface Rest { start: string; end: string; months: number; reason: string; suggestion: string }

// Fechas inclusivas: se usan límites exclusivos internamente para no perder días.
export function rests(sequence: { start: string; end: string }[], windows: { start: string; end: string }[], horizon: { start: string; end: string }): Rest[] {
  const start = day(horizon.start), end = day(horizon.end) + dayMs;
  const boundaries = new Set([start, end]);
  for (const interval of [...sequence, ...windows]) {
    for (const value of [day(interval.start), day(interval.end) + dayMs]) {
      if (value > start && value < end) boundaries.add(value);
    }
  }
  const points = [...boundaries].sort((a, b) => a-b);
  const segments: { start: number; end: number; inWindow: boolean }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i+1];
    if (sequence.some(step => day(step.start) <= a && day(step.end) + dayMs > a)) continue;
    const inWindow = windows.some(window => day(window.start) <= a && day(window.end) + dayMs > a);
    const previous = segments.at(-1);
    if (previous && previous.end === a && previous.inWindow === inWindow) previous.end = b;
    else segments.push({ start: a, end: b, inWindow });
  }
  return segments.filter(segment => {
    const date = new Date(segment.start);
    const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth()+1, 1));
    // Cumple si contiene un mes calendario completo o un mes de fecha a fecha.
    const fullMonthEnd = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth()+1, 1));
    const anniversary = new Date(date);
    anniversary.setUTCMonth(date.getUTCMonth()+1);
    return segment.end >= anniversary.getTime() || segment.end >= fullMonthEnd.getTime();
  }).map(segment => {
    const a = new Date(segment.start), b = new Date(segment.end-dayMs);
    return { start: iso(segment.start), end: iso(segment.end-dayMs),
      months: (b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth()+1,
      reason: segment.inWindow ? 'Ningún cultivo completa su ciclo en este tramo' : 'Fuera de temporada: frío o falta de agua',
      suggestion: 'Mantener cobertura o rastrojo para proteger el suelo' };
  });
}

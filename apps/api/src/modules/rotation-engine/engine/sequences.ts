import { crops, findCrop, type Crop } from '../../crop-knowledge/crop-catalog.js';
import type { History, Indicators, Weights, Window } from '../../nasa-data/contracts.js';
import { normalizeWeights } from '../../farm-context/priorities/normalize.js';
import { transition } from './transitions.js';
import { currentRisk, viability } from './viability.js';
import { weightedScore } from './score.js';

interface Step { cropId: string; cropName: string; windowId: string; start: string; end: string; occupiedWindowIds: string[] }
interface Candidate { id: string; score: number; sequence: Step[]; components: Weights; explanation: string[]; risks: string[] }
const dayMs = 86_400_000;
const day = (value: string) => Date.parse(`${value}T00:00:00Z`);
const iso = (value: number) => new Date(value).toISOString().slice(0, 10);

export function recommend(input: { currentCropId: string; history: History[]; priorities: Weights; indicators: Indicators }, catalog: Crop[] = crops) {
  const current = findCrop(input.currentCropId);
  if (!current) throw new Error('Current crop not in catalog');
  const { indicators, history } = input;
  const priorities = normalizeWeights(input.priorities);
  const windows = indicators.windows.slice().sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
  const warnings = [...indicators.warnings];
  const missing = Object.values(indicators.sources).some(s => s.status !== 'available') ||
    indicators.monthly.some(m => m.value === null) || !indicators.monthly.length ||
    windows.some(w => w.meanTemperature === null || w.precipitationMm === null || w.temperatureMin === null);
  if (!history.length) warnings.push('Sin historial: menor confianza en la rotación');
  if (missing) warnings.push('Datos NASA incompletos: confianza reducida');
  if (windows.length < 2) warnings.push('Menos de dos ventanas en 24 meses: secuencia reducida; considerar cobertura o barbecho');
  const confidence = missing ? 'low' as const : !history.length || warnings.length ? 'medium' as const : 'high' as const;
  const failures = new Set<string>();
  let beam: Candidate[] = [{ id: '', score: 0, sequence: [], components: { water: 0, soil: 0, income: 0, risk: 0 }, explanation: [], risks: [] }];
  for (let index = 0; index < windows.length; index++) {
    const window = windows[index];
    const next: Candidate[] = [];
    for (const partial of beam) {
      const previousStep = partial.sequence.at(-1);
      // Una perenne ya ocupa esta ventana; no se superpone otro cultivo.
      if (previousStep && day(previousStep.end) >= day(window.end)) { next.push(partial); continue; }
      const start = previousStep && day(previousStep.end) >= day(window.start) ? day(previousStep.end) + dayMs : day(window.start);
      const previous = previousStep ? findCrop(previousStep.cropId)! : current;
      let expanded = false;
      for (const crop of catalog) {
        const end = start + (crop.cycleDays-1)*dayMs;
        let occupied = [window];
        let effective: Window = window;
        if (crop.perennial) {
          occupied = indicators.windows.filter(w => day(w.start) >= day(window.start) && day(w.start) <= end);
          // La perenne se evalúa durante toda la ocupación, incluyendo meses fríos entre ventanas.
          const horizonEnd = Math.max(...indicators.windows.map(w => day(w.end)));
          if (end > horizonEnd) { failures.add(`${crop.name}: perenne excede el horizonte disponible`); continue; }
          const normals = indicators.climatology;
          let unsafe = false;
          for (let time = new Date(start); time.getTime() <= end; time = new Date(Date.UTC(time.getUTCFullYear(), time.getUTCMonth()+1, 1))) {
            const t = normals.find(n => n.variable === 'T2M' && n.month === time.getUTCMonth()+1)?.value;
            if (t !== undefined && (t < crop.tempMin || t > crop.tempMax)) unsafe = true;
          }
          if (unsafe) { failures.add(`${crop.name}: meses intermedios fuera del rango térmico de la perenne`); continue; }
          const duration = occupied.reduce((sum, w) => sum+w.durationDays, 0);
          effective = { ...window, durationDays: duration, precipitationMm: occupied.some(w => w.precipitationMm === null) ? null : occupied.reduce((sum, w) => sum+w.precipitationMm!, 0) };
        }
        const available = crop.perennial ? Math.floor((Math.max(...indicators.windows.map(w => day(w.end)))-start)/dayMs)+1 : Math.floor((day(window.end)-start)/dayMs)+1;
        const result = viability(crop, effective, indicators, available);
        if (!result.viable) { failures.add(`${crop.name}: ${result.reasons.join('; ')}`); continue; }
        const tr = transition(previous, crop, history);
        const components: Weights = {
          water: Math.max(0, Math.min(100, (1-crop.waterMm/1300)*70 + crop.droughtTolerance*.3)),
          soil: tr.score, income: crop.incomeOpportunity,
          risk: Math.max(0, 100-result.risks.length*18-(previous.family === crop.family ? 20 : 0)),
        };
        const count = partial.sequence.length;
        const combined = Object.fromEntries((Object.keys(components) as (keyof Weights)[]).map(key => [key, (partial.components[key]*count+components[key])/(count+1)])) as unknown as Weights;
        const sequence = [...partial.sequence, { cropId: crop.id, cropName: crop.name, windowId: window.id, start: iso(start), end: iso(end), occupiedWindowIds: occupied.map(w => w.id) }];
        next.push({ id: sequence.map(s => s.cropId).join('>'), sequence, components: combined, score: weightedScore(combined, priorities),
          explanation: [...partial.explanation, ...tr.reasons.map(r => `${previous.name} → ${crop.name}: ${r}`),
            `${crop.name}: NASA T2M=${window.meanTemperature ?? 'faltante'} C; lluvia=${result.waterMm?.toFixed(0) ?? 'faltante'} mm/ciclo; ciclo=${crop.cycleDays} días`,
            `Pesos agua=${priorities.water}, suelo=${priorities.soil}, ingreso=${priorities.income}, riesgo=${priorities.risk}; ingreso es una heurística, no precio`],
          risks: [...partial.risks, ...result.risks] });
        expanded = true;
      }
      if (!expanded && partial.sequence.length) {
        next.push({ ...partial, risks: [...partial.risks, `Sin continuación viable en ${window.id}; considerar barbecho`] });
      }
    }
    beam = next.sort(compare).slice(0, 60);
  }
  const unique = new Map(beam.filter(c => c.sequence.length).sort(compare).map(c => [c.id, c]));
  const recommendations = [...unique.values()].sort(compare).slice(0, 3);
  if (!recommendations.length) warnings.push('Ninguna opción viable; considerar cobertura o barbecho', ...[...failures].sort());
  const risk = currentRisk(current, indicators);
  return { status: recommendations.length ? 'ok' as const : 'no_viable_options' as const, confidence,
    warnings: [...new Set(warnings)], priorities, currentCropRisk: { ...risk, changeAt: recommendations[0]?.sequence[0].start ?? null }, recommendations };
}

function compare(a: Candidate, b: Candidate): number {
  return b.score-a.score || b.components.risk-a.components.risk ||
    a.sequence.map(s => s.cropName).join('>').localeCompare(b.sequence.map(s => s.cropName).join('>'), 'en') || a.id.localeCompare(b.id, 'en');
}

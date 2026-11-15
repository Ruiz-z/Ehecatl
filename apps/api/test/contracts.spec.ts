import { readFileSync } from 'node:fs';
import { validateIndicators } from '../src/modules/nasa-data/nasa.service.js';
import { recommend } from '../src/modules/rotation-engine/engine/sequences.js';
import type { Indicators } from '../src/modules/nasa-data/contracts.js';

describe('B1 fixtures de contratos entre apps', () => {
  const read = (file: string) => JSON.parse(readFileSync(new URL(`../../../docs/fixtures/${file}`, import.meta.url), 'utf8'));
  it('el ejemplo geo cumple el contrato que consume API y ejecuta el motor', () => {
    const data: Indicators = validateIndicators(read('indicators.json'));
    const result = recommend({ currentCropId: 'maize', history: [], priorities: { water: 25, soil: 25, income: 25, risk: 25 }, indicators: data });
    expect(data.origin).toBe('mock');
    expect(result.status).toBe('ok');
    expect(result.recommendations[0].explanation.join()).toContain('NASA');
  });
  it('el ejemplo recommendations contiene sus tres insumos y secuencias trazables', () => {
    const data = read('recommendations.json');
    expect(data.version).toBe(1);
    expect(validateIndicators(data.inputs.indicators).origin).toBe('mock');
    expect(data.inputs.currentCropId).toBe('maize');
    expect(data.baseline.id).toBe('baseline');
    if (data.baseline.viable) {
      expect(data.baseline.sequence.every((step: { cropId: string }) => step.cropId === 'maize')).toBe(true);
    } else {
      expect(data.baseline.score).toBeNull();
      expect(data.baseline.components).toBeNull();
      expect(data.baseline.explanation.length).toBeGreaterThan(0);
    }
    for (const item of data.recommendations) {
      expect(item.score).toBeGreaterThanOrEqual(0); expect(item.score).toBeLessThanOrEqual(100);
      expect(item.rests).toBeInstanceOf(Array);
      for (const step of item.sequence) {
        expect(step.reasons.every((r: {effect: string}) => ['favor','contra','neutral'].includes(r.effect))).toBe(true);
        expect(step.climate).toHaveProperty('meanTemperature');
        expect(Number.isInteger(step.climate.rainMm)).toBe(true);
        expect(Number.isInteger(step.climate.cycleDays)).toBe(true);
      }
      expect(item.sequence[0].cropId).toBeDefined(); expect(item.explanation.length).toBeGreaterThan(0);
      expect(item.delta).toBe(data.baseline.viable ? Number((item.score - data.baseline.score).toFixed(2)) : null);
    }
  });
});

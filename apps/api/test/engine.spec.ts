import { crops, findCrop } from '../src/modules/crop-knowledge/crop-catalog.js';
import { transition } from '../src/modules/rotation-engine/engine/transitions.js';
import { viability, currentRisk } from '../src/modules/rotation-engine/engine/viability.js';
import { recommend } from '../src/modules/rotation-engine/engine/sequences.js';
import { defaultWeights, normalizeWeights } from '../src/modules/farm-context/priorities/normalize.js';
import { indicators } from './fixtures.js';

const input = () => ({ currentCropId: 'maize', history: [{ cropId: 'maize', plantedAt: '2023-01-01', harvestedAt: '2023-05-01' }], priorities: defaultWeights, indicators: indicators() });

describe('B12–B15 motor determinista y explicable', () => {
  it('prefiere cereal → leguminosa frente a repetir familia', () => {
    expect(transition(findCrop('maize')!, findCrop('cowpea')!).score).toBeGreaterThan(transition(findCrop('maize')!, findCrop('sorghum')!).score);
    expect(transition(findCrop('maize')!, findCrop('cowpea')!).reasons.join()).toContain('nitrógeno');
  });
  it('rechaza temperatura, agua, helada y duración insuficientes', () => {
    const data = indicators();
    const crop = findCrop('maize')!;
    for (const change of [{ meanTemperature: 2 }, { precipitationMm: 1 }, { temperatureMin: -2 }, { durationDays: 10 }]) {
      expect(viability(crop, { ...data.windows[0], ...change }, data).viable).toBe(false);
    }
  });
  it('no asigna toda la lluvia de una ventana larga a un ciclo corto', () => {
    const data = indicators();
    expect(viability(findCrop('maize')!, { ...data.windows[0], durationDays: 730, precipitationMm: 700 }, data).viable).toBe(false);
  });
  it('marca riesgo alto de maíz ante sequía o calor', () => {
    for (const type of ['drought', 'heat']) {
      const data = indicators(); data.trends = [{ type, active: true, evidence: ['NASA'] }];
      expect(currentRisk(findCrop('maize')!, data).level).toBe('high');
    }
  });
  it('genera 2–3 opciones de tres ventanas, scores acotados y explicación', () => {
    const result = recommend(input());
    expect(result.recommendations).toHaveLength(3);
    for (const item of result.recommendations) {
      expect(item.score).toBeGreaterThanOrEqual(0); expect(item.score).toBeLessThanOrEqual(100);
      expect(item.sequence.length).toBeGreaterThanOrEqual(2);
      expect(item.explanation.join()).toContain('NASA'); expect(item.explanation.join()).toContain('Pesos');
    }
    expect(recommend(input())).toEqual(result);
  });
  it('cambia ranking al cambiar agua por ingreso', () => {
    const data = input();
    const water = recommend({ ...data, priorities: { water: 100, soil: 0, income: 0, risk: 0 } });
    const income = recommend({ ...data, priorities: { water: 0, soil: 0, income: 100, risk: 0 } });
    expect(water.recommendations[0].id).not.toBe(income.recommendations[0].id);
  });
  it('reduce secuencia si hay una ventana y confianza si falta historial o NASA', () => {
    const data = input(); data.indicators.windows = data.indicators.windows.slice(0, 1);
    const result = recommend({ ...data, history: [] });
    expect(result.recommendations[0].sequence).toHaveLength(1);
    expect(result.confidence).toBe('medium'); expect(result.warnings.join()).toContain('Menos de dos');
    data.indicators.sources.modis.status = 'unavailable';
    expect(recommend(data).confidence).toBe('low');
  });
  it('devuelve ninguna viable con razones y barbecho', () => {
    const data = input(); data.indicators.windows.forEach(w => { w.meanTemperature = -20; });
    data.indicators.climatology.forEach(n => { n.value = -20; });
    const result = recommend(data);
    expect(result.status).toBe('no_viable_options'); expect(result.recommendations).toEqual([]);
    expect(result.warnings.join()).toContain('térmico'); expect(result.warnings.join()).toContain('barbecho');
    data.indicators.windows = [];
    expect(recommend(data).status).toBe('no_viable_options');
  });
  it('espera una ventana posterior cuando la primera no tiene cultivos viables', () => {
    const data = input(); data.indicators.windows[0].end = '2025-01-03'; data.indicators.windows[0].durationDays = 3;
    const result = recommend(data);
    expect(result.status).toBe('ok');
    expect(result.recommendations[0].sequence[0].windowId).toBe('w2');
    expect(result.recommendations[0].risks.join()).toContain('barbecho');
  });
  it('una perenne ocupa varias ventanas y no se solapa con el siguiente cultivo', () => {
    const data = input();
    data.indicators.windows.forEach(w => { w.irrigated = true; });
    data.indicators.windows.push({ ...data.indicators.windows[0], id: 'w4', start: '2026-07-01', end: '2026-12-31', durationDays: 184 });
    const result = recommend(data, [findCrop('alfalfa')!]);
    expect(result.recommendations[0].sequence[0].occupiedWindowIds.length).toBeGreaterThan(1);
    expect(result.recommendations[0].sequence).toHaveLength(1);
  });
  it('detecta meses fríos intermedios para una perenne', () => {
    const data = input(); data.indicators.windows.forEach(w => { w.irrigated = true; });
    data.indicators.climatology[5].value = -10;
    expect(recommend(data, [findCrop('alfalfa')!]).recommendations).toHaveLength(0);
  });
  it('desempata de forma estable aunque cambie el orden del catálogo', () => {
    expect(recommend(input(), crops)).toEqual(recommend(input(), [...crops].reverse()));
  });
  it('no propone sembrar antes de obtener los indicadores', () => {
    const data = input(); data.indicators.fetchedAt = '2025-02-14T10:00:00Z';
    const result = recommend(data);
    for (const item of result.recommendations) expect(item.sequence[0].start >= '2025-02-14').toBe(true);
  });
  it('encadena tres ciclos en una ventana continua sin solapar ni inventar ventanas', () => {
    const data = input();
    data.indicators.windows = [{ ...data.indicators.windows[0], end: '2026-12-31', durationDays: 730, irrigated: true }];
    data.indicators.fetchedAt = '2025-02-14T12:00:00Z';
    const result = recommend(data, [findCrop('cowpea')!, findCrop('sorghum')!]);
    expect(result.warnings.join()).not.toContain('Menos de dos');
    for (const item of result.recommendations) {
      expect(item.sequence).toHaveLength(3);
      for (let index = 0; index < item.sequence.length; index++) {
        const step = item.sequence[index];
        expect(step.windowId).toBe('w1');
        expect(step.occupiedWindowIds).toEqual(['w1']);
        expect(step.start >= (index ? item.sequence[index - 1].end : '2025-02-14')).toBe(true);
        if (index) expect(step.start > item.sequence[index - 1].end).toBe(true);
        expect(step.end <= '2026-12-31').toBe(true);
      }
    }
  });
});

describe('B4 prioridades', () => {
  it('usa defaults para suma cero y redondea manteniendo suma 100', () => {
    expect(normalizeWeights({ water: 0, soil: 0, income: 0, risk: 0 })).toEqual(defaultWeights);
    const result = normalizeWeights({ water: 1, soil: 1, income: 1, risk: 0 });
    expect(result).toEqual({ water: 34, soil: 33, income: 33, risk: 0 });
  });
  it.each([{}, { ...defaultWeights, water: -1 }, { ...defaultWeights, water: '20' }, { ...defaultWeights, water: NaN }])('rechaza pesos inválidos', value => {
    expect(() => normalizeWeights(value)).toThrow();
  });
});

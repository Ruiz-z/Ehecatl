import { crops, findCrop } from '../src/modules/crop-knowledge/crop-catalog.js';
import { transition } from '../src/modules/rotation-engine/engine/transitions.js';
import { viability, currentRisk } from '../src/modules/rotation-engine/engine/viability.js';
import { recommend, rests } from '../src/modules/rotation-engine/engine/sequences.js';
import { defaultWeights, normalizeWeights } from '../src/modules/farm-context/priorities/normalize.js';
import { indicators } from './fixtures.js';

const input = () => ({ currentCropId: 'maize', history: [{ cropId: 'maize', plantedAt: '2023-01-01', harvestedAt: '2023-05-01' }], priorities: defaultWeights, indicators: indicators() });

describe('B12–B15 motor determinista y explicable', () => {
  it('prefiere cereal → leguminosa frente a repetir familia', () => {
    expect(transition(findCrop('maize')!, findCrop('cowpea')!).score).toBeGreaterThan(transition(findCrop('maize')!, findCrop('sorghum')!).score);
    expect(transition(findCrop('maize')!, findCrop('cowpea')!).reasons.map(reason => reason.text).join()).toContain('nitrógeno');
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
    expect(result.recommendations).toHaveLength(2);
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

describe('Spec 005 RF-1c: referencia mantener lo actual', () => {
  it('conserva la referencia fuera del haz y calcula diferencias con los mismos pesos', () => {
    const data = input();
    const result = recommend(data);
    expect(result.baseline.viable).toBe(true);
    expect(result.baseline.sequence.every(step => step.cropId === data.currentCropId)).toBe(true);
    expect(result.baseline.sequence).toHaveLength(3);
    expect(result.baseline.explanation.join()).toContain('Repetir familia');
    for (const item of result.recommendations) {
      expect(item.sequence.some(step => step.cropId !== data.currentCropId)).toBe(true);
      expect(item.delta).toBe(Number((item.score - result.baseline.score!).toFixed(2)));
    }
    const onlyCurrent = recommend(data, [findCrop(data.currentCropId)!]);
    expect(onlyCurrent.baseline).toEqual(result.baseline);
    expect(onlyCurrent.recommendations).toEqual([]);
    expect(onlyCurrent.status).toBe('ok');
  });

  it('repondera la referencia al cambiar las prioridades y mantiene el determinismo', () => {
    const data = input();
    const water = recommend({ ...data, priorities: { water: 100, soil: 0, income: 0, risk: 0 } });
    const soil = recommend({ ...data, priorities: { water: 0, soil: 100, income: 0, risk: 0 } });
    expect(water.baseline.score).toBeCloseTo(water.baseline.components!.water, 2);
    expect(soil.baseline.score).toBeCloseTo(soil.baseline.components!.soil, 2);
    expect(water.baseline.score).not.toBe(soil.baseline.score);
    expect(recommend(data, [...crops].reverse())).toEqual(recommend(data));
  });

  it('explica una referencia inviable y deja diferencias nulas con alternativas viables', () => {
    const data = input();
    data.indicators.windows.forEach(window => { window.temperatureMin = -1; });
    const result = recommend(data);
    expect(result.status).toBe('ok');
    expect(result.baseline).toMatchObject({ viable: false, score: null, components: null, sequence: [] });
    expect(result.baseline.explanation.join()).toContain('helada');
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.every(item => item.delta === null)).toBe(true);
  });

  it('devuelve referencia explícita incluso sin ventanas', () => {
    const data = input(); data.indicators.windows = [];
    const result = recommend(data);
    expect(result.status).toBe('no_viable_options');
    expect(result.baseline).toMatchObject({ viable: false, score: null, sequence: [] });
    expect(result.baseline.explanation.join()).toContain('ventanas');
    expect(result.recommendations).toEqual([]);
    expect(result.currentCropRisk.changeAt).toBeNull();
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

describe('explicación y descansos', () => {
  it('publica efectos, clima redondeado, pesos únicos y riesgos sin duplicados', () => {
    const data = input();
    data.indicators.climatology.filter(n => n.variable === 'T2M').forEach(n => { n.value = 24.123456; });
    const result = recommend(data);
    for (const item of [...result.recommendations, result.baseline]) {
      expect(item.explanation.filter(text => text.startsWith('Pesos'))).toHaveLength(item.sequence.length ? 1 : 0);
      expect(new Set(item.risks).size).toBe(item.risks.length);
      for (const step of item.sequence) {
        expect(step.reasons.some(reason => reason.effect === 'neutral')).toBe(true);
        expect(step.climate.meanTemperature).toBe(24.1);
        expect(Number.isInteger(step.climate.rainMm)).toBe(true);
      }
    }
    const tr = transition(findCrop('maize')!, findCrop('cowpea')!, [{cropId:'cowpea', plantedAt:'2024-01-01', harvestedAt:'2024-04-01'}]);
    expect(tr.reasons.find(r => r.text.includes('nitrógeno'))?.effect).toBe('favor');
    expect(tr.reasons.find(r => r.text.includes('retorno'))?.effect).toBe('contra');
    expect(transition(findCrop('maize')!, findCrop('maize')!).reasons[0].effect).toBe('contra');
  });

  it('deduplica el aviso de riego repetido y conserva desconocidos como null', () => {
    const data = input();
    data.indicators.windows.forEach(window => { window.irrigated = true; window.meanTemperature = null; window.precipitationMm = null; });
    data.indicators.climatology = data.indicators.climatology.filter(n => !['T2M','PRECTOTCORR'].includes(n.variable));
    const result = recommend(data);
    for (const item of [...result.recommendations, result.baseline]) {
      expect(item.risks.filter(r => r === 'Viabilidad hídrica depende de disponibilidad efectiva de riego')).toHaveLength(1);
      expect(item.sequence.length).toBeGreaterThan(1);
      expect(item.sequence.every(step => step.climate.meanTemperature === null && step.climate.rainMm === null)).toBe(true);
    }
    expect(transition(findCrop('sunflower')!, crops.find(crop => crop.family === 'Brassicaceae')!).reasons[0].effect).toBe('neutral');
  });
  const horizon = {start:'2025-01-01',end:'2025-12-31'};
  it('detecta huecos al inicio, entre ciclos y al final', () => {
    const gaps = rests([{start:'2025-03-01',end:'2025-04-30'},{start:'2025-07-01',end:'2025-08-31'}], [{start:'2025-01-01',end:'2025-12-31'}], horizon);
    expect(gaps.map(r => [r.start,r.end,r.months])).toEqual([['2025-01-01','2025-02-28',2],['2025-05-01','2025-06-30',2],['2025-09-01','2025-12-31',4]]);
    expect(gaps.every(r => r.reason.includes('Ningún cultivo'))).toBe(true);
  });
  it('no crea descansos sin huecos ni por compartir mes', () => {
    expect(rests([{start:'2025-01-01',end:'2025-06-15'},{start:'2025-06-16',end:'2025-12-31'}], [], horizon)).toEqual([]);
  });
  it('sin ventanas explica todo el horizonte como fuera de temporada', () => {
    expect(rests([], [], horizon)).toEqual([{...horizon,months:12,reason:'Fuera de temporada: frío o falta de agua',suggestion:'Mantener cobertura o rastrojo para proteger el suelo'}]);
  });
  it('separa descansos por temporada y omite huecos menores de un mes', () => {
    const gaps = rests([], [{start:'2025-03-01',end:'2025-08-31'}], horizon);
    expect(gaps.map(r => r.months)).toEqual([2,6,4]);
    expect(gaps[0].reason).toContain('Fuera de temporada');
    expect(rests([{start:'2025-01-20',end:'2025-12-31'}], [], horizon)).toEqual([]);
  });
});

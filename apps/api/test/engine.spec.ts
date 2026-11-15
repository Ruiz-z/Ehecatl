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
    expect(result.confidence).toBe('low'); expect(result.warnings.join()).toContain('Menos de dos');
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

import { riskScore } from '../src/modules/rotation-engine/engine/score.js';

describe('balance de agua y márgenes medidos RF-10 a RF-13', () => {
  it('el mismo cultivo puntúa distinto según lluvia y riego', () => {
    const run = (rain: number, irrigated: boolean) => {
      const data = input();
      data.indicators.windows.forEach(w => {w.precipitationMm=rain;w.irrigated=irrigated;});
      return recommend(data,[findCrop('maize')!]).baseline;
    };
    const wet = run(1200,false), dry = run(500,false), irrigated = run(500,true);
    expect(wet.components!.water).toBe(100);
    expect(dry.components!.water).toBeLessThan(wet.components!.water);
    expect(irrigated.components!.water).toBeCloseTo(dry.components!.water,8);
    expect(dry.score).toBeLessThan(wet.score!);
  });
  it('mide calor, óptimo, helada cercana, déficit, tendencias y familia', () => {
    const data = indicators(), crop = findCrop('maize')!;
    const climate={...data.windows[0],meanTemperature:crop.tempOptMax+2,temperatureMax:crop.tempMax+3,temperatureMin:1};
    expect(riskScore(crop,climate,data,1,false)).toBe(62);
    expect(riskScore(crop,{...climate,irrigated:true},data,.5,false)).toBe(54.5);
    expect(riskScore(crop,climate,data,.5,true)).toBe(27);
    data.trends=[{type:'heat',active:true,evidence:[]},{type:'drought',active:true,evidence:[]}];
    expect(riskScore({...crop,droughtTolerance:59},climate,data,.5,true)).toBe(2);
    expect(riskScore(crop,{...climate,temperatureMax:100,meanTemperature:100},data,0,true)).toBe(0);
  });
});

it('la radiación de dos climas cambia agua para el mismo cultivo y fechas', () => {
  const run = (rs: number) => {
    const data = input();
    data.indicators.windows.forEach(w => {w.irrigated=true;});
    data.indicators.climatology.push(...Array.from({length:12},(_,i)=>({variable:'ALLSKY_SFC_SW_DWN',month:i+1,value:rs,samples:10,unit:'MJ/m²/day'})));
    return recommend(data,[findCrop('maize')!]).baseline;
  };
  const cool = run(15), sunny = run(30);
  expect(cool.sequence.map(s=>[s.start,s.end])).toEqual(sunny.sequence.map(s=>[s.start,s.end]));
  expect(sunny.sequence[0].water.method).toBe('radiation');
  expect(sunny.sequence[0].water.demandMm).toBeCloseTo(2*cool.sequence[0].water.demandMm,8);
  expect(sunny.components!.water).toBeLessThan(cool.components!.water);
});

describe('RF-11 déficit acumulado de la secuencia', () => {
  const arid = () => {
    const data = input();
    const values = {
      T2M: [11.7,14.6,17.3,20.7,23.7,24.3,23.9,23.6,21.5,18.9,16,13.3],
      ALLSKY_SFC_SW_DWN: [14.6,17.9,20.5,22.7,23.3,24.3,23.9,23.6,19.6,17.7,14.8,13.6],
      PRECTOTCORR: [15.7,13.3,23.4,14.8,29,43,47.8,39.5,68.1,27.3,17.8,9.3],
    };
    data.indicators.climatology = Object.entries(values).flatMap(([variable, months]) => months.map((value,i) => ({variable,month:i+1,value,samples:10,unit:''})));
    data.indicators.windows = [{...data.indicators.windows[0],start:'2025-01-01',end:'2026-12-31',durationDays:730,irrigated:true}];
    data.indicators.trends = [{type:'drought',active:true,evidence:['Fixture Coahuila']}];
    data.priorities = {water:60,soil:20,income:10,risk:10};
    return data;
  };
  it('penaliza el perenne de alta demanda frente a caupí→sorgo→caupí y es determinista', () => {
    const data = arid();
    const perennial = recommend(data, [findCrop('alfalfa')!]).recommendations[0];
    const short = recommend(data, [findCrop('cowpea')!,findCrop('sorghum')!]).recommendations.find(r => r.id === 'cowpea>sorghum>cowpea')!;
    expect(short).toBeDefined();
    expect(perennial.components.water).toBeLessThan(short.components.water);
    const eto = horizonEto(Date.parse('2025-01-01T00:00:00Z'),Date.parse('2026-12-31T00:00:00Z'),data.indicators.climatology)!;
    for (const plan of [perennial,short]) {
      const deficit = plan.sequence.reduce((sum,s) => sum+Math.max(0,s.water.demandMm-(s.water.rainMm ?? 0)),0);
      expect(plan.components.water).toBeCloseTo(100*(1-deficit/eto),8);
      expect(plan.sequence.every(s => s.water.coveragePct === null || Number(s.water.coveragePct.toFixed(1)) === s.water.coveragePct)).toBe(true);
    }
    expect(recommend(data)).toEqual(recommend(data));
  });
  it('suma déficits y resume riesgos una vez, también en baseline', () => {
    const result = recommend(arid());
    for (const plan of [...result.recommendations, result.baseline]) {
      const deficit = plan.sequence.reduce((sum,s) => sum+Math.max(0,s.water.demandMm-(s.water.rainMm ?? 0)),0);
      expect(plan).toHaveProperty('irrigationNeedMm',Math.round(deficit));
      expect(plan.risks.filter(r => r.startsWith('Agua faltante en 24 meses:'))).toHaveLength(plan.sequence.length ? 1 : 0);
      expect(plan.risks.join()).not.toContain('Déficit hídrico potencial');
    }
  });
  it('usa suma de demandas como respaldo sin radiación', () => {
    const data = arid();
    data.indicators.climatology = data.indicators.climatology.filter(n => n.variable !== 'ALLSKY_SFC_SW_DWN');
    const result = recommend(data);
    expect(result.confidence).toBe('low');
    expect(result.warnings.join()).toContain('ETo del horizonte');
    for (const plan of result.recommendations) {
      const demand = plan.sequence.reduce((sum,s) => sum+s.water.demandMm,0);
      const deficit = plan.sequence.reduce((sum,s) => sum+Math.max(0,s.water.demandMm-(s.water.rainMm ?? 0)),0);
      expect(plan.components.water).toBeCloseTo(Math.max(0,100*(1-deficit/demand)),8);
    }
  });
});

import { horizonEto, etoDaily } from '../src/modules/rotation-engine/engine/evapotranspiration.js';

it('ETo del horizonte incluye meses parciales, descansos y días bisiestos', () => {
  const normals = Array.from({length:12},(_,i) => [
    {variable:'T2M',month:i+1,value:20,samples:10,unit:'C'},
    {variable:'ALLSKY_SFC_SW_DWN',month:i+1,value:18,samples:10,unit:'MJ/m²/día'},
  ]).flat();
  const start = Date.parse('2024-02-15T00:00:00Z'), end = Date.parse('2026-01-31T00:00:00Z');
  expect(horizonEto(start,end,normals)).toBeCloseTo(((end-start)/86400000+1)*etoDaily(20,18),8);
  expect(horizonEto(start,end,normals.filter(n => n.month !== 12))).toBeNull();
  expect(horizonEto(start,end,normals.map(n => n.variable === 'ALLSKY_SFC_SW_DWN' ? {...n,value:0} : n))).toBeNull();
});

it('lluvia desconocida contabiliza toda la demanda y mantiene el aviso', () => {
  const data = input();
  data.indicators.windows.forEach(w => {w.irrigated=true;w.precipitationMm=null;});
  const result = recommend(data);
  for (const plan of [...result.recommendations,result.baseline]) {
    expect(plan.irrigationNeedMm).toBe(Math.round(plan.sequence.reduce((sum,s) => sum+s.water.demandMm,0)));
    if (plan.sequence.length) {
      expect(plan.risks.join()).toContain('Falta precipitación');
      expect(plan.components!.water).toBe(0);
      expect(plan.sequence.every(s => s.water.coveragePct === null)).toBe(true);
    }
  }
});

import { groupRisks } from '../src/modules/rotation-engine/engine/risk-groups.js';
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

import { estimatedRiskScore } from '../src/modules/rotation-engine/engine/score.js';

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
    expect(estimatedRiskScore(crop,climate,data,1,false)).toBe(62);
    expect(estimatedRiskScore(crop,{...climate,irrigated:true},data,.5,false)).toBe(54.5);
    expect(estimatedRiskScore(crop,climate,data,.5,true)).toBe(27);
    data.trends=[{type:'heat',active:true,evidence:[]},{type:'drought',active:true,evidence:[]}];
    expect(estimatedRiskScore({...crop,droughtTolerance:59},climate,data,.5,true)).toBe(2);
    expect(estimatedRiskScore(crop,{...climate,temperatureMax:100,meanTemperature:100},data,0,true)).toBe(0);
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


describe('Bloque A: confianza según insumos', () => {
  const complete = () => {
    const data = input();
    data.indicators.climatology.push(...Array.from({length:12}, (_,i) => ({variable:'ALLSKY_SFC_SW_DWN',month:i+1,value:18,samples:10,unit:'MJ/m²/day'})));
    data.indicators.history = historicalRows();
    data.indicators.monthly.push(...Array.from({length:12}, (_,i) => ({variable:'NDVI',date:`2024-${String(i+1).padStart(2,'0')}-01`,value:.5,unit:'index',source:'MODIS',resolution:'250m'})));
    return data;
  };
  it('reserva baja para POWER incompleto o demanda de catálogo', () => {
    expect(recommend(complete()).confidence).toBe('high');
    for (const status of ['partial','unavailable'] as const) {
      const data = complete(); data.indicators.sources.power.status = status;
      expect(recommend(data).confidence).toBe('low');
    }
    expect(recommend(input()).confidence).toBe('low');
  });
  it('un mes reciente de POWER sin publicar solo reduce a media y lo explica', () => {
    const data = complete();
    const row = data.indicators.monthly.find(m => m.variable === 'PRECTOTCORR')!;
    data.indicators.monthly.push({ ...row, date: '2026-10-01', value: null });
    const result = recommend(data);
    expect(result.confidence).toBe('medium');
    expect(result.warnings.join()).toContain('aún no publica');
  });
  it('MODIS parcial, meses NDVI faltantes e histórico corto solo reducen a media', () => {
    for (const status of ['partial','unavailable'] as const) {
      const data = complete(); data.indicators.sources.modis.status = status;
      expect(recommend(data).confidence).toBe('medium');
      expect(recommend(data).warnings.join()).toContain('MODIS');
    }
    const data = complete(); data.indicators.monthly = data.indicators.monthly.filter(row => row.date !== '2024-02-01' || row.variable !== 'NDVI');
    expect(recommend(data).confidence).toBe('medium');
    const historical = complete(); historical.indicators.climatology[0].samples = 8;
    expect(recommend(historical).confidence).toBe('medium');
    expect(recommend(historical).warnings.join()).toContain('histórica');
    expect(recommend({...complete(),history:[]}).confidence).toBe('medium');
  });
  it('secuencia corta no baja confianza y respaldo del horizonte solo baja a media', () => {
    const data = complete(); data.indicators.windows = data.indicators.windows.slice(0,1);
    expect(recommend(data).confidence).toBe('high');
    data.indicators.climatology = data.indicators.climatology.filter(n => n.variable !== 'ALLSKY_SFC_SW_DWN' || n.month !== 12);
    const result = recommend(data);
    expect(result.confidence).toBe('medium');
    expect(result.warnings.join()).toContain('ETo del horizonte');
    expect(result.recommendations.every(r => r.sequence.every(s => s.water.method === 'radiation'))).toBe(true);
  });
  it('agrupa calor con el peor margen y conserva riesgos originales', () => {
    const data = complete(); data.indicators.windows.forEach(w => { w.temperatureMax = 37.4; w.irrigated = true; });
    const result = recommend(data, [findCrop('common-bean')!]);
    const plan = result.recommendations[0];
    expect(plan.riskGroups.filter(g => g.type === 'heat')).toHaveLength(1);
    expect(plan.riskGroups.find(g => g.type === 'heat')?.text).toContain('37.4 °C');
    expect(plan.riskGroups.find(g => g.type === 'heat')?.text).toContain(`en ${plan.sequence.length} de ${plan.sequence.length} ciclos`);
    expect(plan.risks.join()).toContain('Máxima mensual');
    expect(result.baseline.riskGroups).toBeDefined();
  });
});

it('agrupa el peor margen térmico sin mezclar tolerancias ni contar ciclos sanos', () => {
  const risks = ['Máxima mensual 37.4 C supera tolerancia 32 C','Máxima mensual 39.0 C supera tolerancia 38 C'];
  const groups = groupRisks([[risks[0]],[risks[1]],[]],risks,100,true);
  expect(groups.find(g => g.type === 'heat')?.text).toBe('Calor: hasta 37.4 °C, tolerancia 32 °C, en 2 de 3 ciclos');
});

import { simulateCycle } from '../src/modules/rotation-engine/engine/historical.js';
import { kcSeason } from '../src/modules/rotation-engine/engine/evapotranspiration.js';
import type { HistoricalMonth } from '../src/modules/nasa-data/contracts.js';
const historicalRows = (): HistoricalMonth[] => Array.from({length:10}, (_,i) => Array.from({length:12}, (_,m) =>
  Object.entries({T2M:20,T2M_MAX:25,T2M_MIN:i < 2 ? 0 : 10,PRECTOTCORR:300,ALLSKY_SFC_SW_DWN:18})
    .map(([variable,value]) => ({variable,value,year:2010+i,month:m+1})))).flat(2);

describe('RF-5 y RF-12: frecuencia y cosecha históricas', () => {
  const crop = findCrop('maize')!;
  it('dos años con helada entre diez dan 80 y causas por año, no por mes', () => {
    const result = simulateCycle(crop,'2025-01-01','2025-04-30',historicalRows(),false);
    expect(result).toEqual({okYears:8,totalYears:10,failures:{heat:0,frost:2,temperature:0,water:0},relativeYieldPct:100});
  });
  it('calcula Ky contra lluvia mensual prorrateada y acota a cero y cien', () => {
    const rows = historicalRows().map(r => ({...r,value:r.variable === 'PRECTOTCORR' ? 10 : r.value}));
    const result = simulateCycle(crop,'2025-01-16','2025-01-31',rows,false);
    const demand = etoDaily(20,18)*kcSeason(crop.kc)*16;
    expect(result.relativeYieldPct).toBeCloseTo(100*Math.max(0,1-crop.ky*(1-(10*16/31)/demand)),8);
    expect(result.failures.water).toBe(10);
    expect(simulateCycle(crop,'2025-01-16','2025-01-31',rows,true).relativeYieldPct).toBe(100);
    expect(simulateCycle(crop,'2025-01-16','2025-01-31',rows,true).failures.water).toBe(0);
  });
  it('no rellena huecos ni enlaza el último año con el primero', () => {
    const rows = historicalRows();
    expect(simulateCycle(crop,'2025-12-15','2026-02-28',rows,true).totalYears).toBe(9);
    expect(simulateCycle(crop,'2025-01-01','2025-04-30',rows.filter(r => !(r.year === 2010 && r.month === 2 && r.variable === 'T2M')),true).totalYears).toBe(9);
    expect(simulateCycle(crop,'2025-01-01','2025-04-30',rows.map(r => r.variable === 'ALLSKY_SFC_SW_DWN' ? {...r,value:null} : r),true).totalYears).toBe(0);
  });
  it('pondera temperaturas por días, cuenta causas simultáneas y respeta límites', () => {
    const rows = historicalRows().map(r => ({...r,value: r.variable === 'T2M_MAX' ? crop.tempMax : r.variable === 'T2M_MIN' ? 0 : r.variable === 'T2M' ? crop.tempMin : r.value}));
    expect(simulateCycle(crop,'2025-01-01','2025-01-31',rows,true).failures).toEqual({heat:0,frost:10,temperature:0,water:0});
    const failed = rows.map(r => ({...r,value:r.variable === 'T2M_MAX' ? 50 : r.variable === 'T2M' ? 40 : r.variable === 'PRECTOTCORR' ? 0 : r.value}));
    expect(simulateCycle(crop,'2025-01-01','2025-01-31',failed,false).failures).toEqual({heat:10,frost:10,temperature:10,water:10});
  });
  it('mantiene días reales de febrero incluidos bisiestos', () => {
    const rows = historicalRows().map(r => ({...r,value:r.variable === 'PRECTOTCORR' ? 100 : r.value}));
    const result = simulateCycle(crop,'2024-02-15','2024-03-05',rows,false);
    const expected = Array.from({length:10},(_,i) => {
      const days = new Date(Date.UTC(2010+i,2,0)).getUTCDate();
      const rain = 100*(days-14)/days+100*5/31;
      const demand = etoDaily(20,18)*kcSeason(crop.kc)*(days-14+5);
      return 100*Math.max(0,Math.min(1,1-crop.ky*(1-Math.min(1,rain/demand))));
    }).reduce((a,b)=>a+b)/10;
    expect(result.relativeYieldPct).toBeCloseTo(expected,8);
  });
  const complete = () => {
    const data = input(); data.indicators.history = historicalRows();
    data.indicators.climatology.push(...Array.from({length:12},(_,i)=>({variable:'ALLSKY_SFC_SW_DWN',month:i+1,value:18,samples:10,unit:'MJ/m²/day'})));
    return data;
  };
  it('publica datos por paso y promedia ejes; tendencias y familia no restan riesgo', () => {
    const data = complete();
    const result = recommend(data);
    for (const plan of [...result.recommendations,result.baseline]) {
      expect(plan.sequence.every(s => s.risk && s.yield)).toBe(true);
      expect(plan.components!.risk).toBeCloseTo(plan.sequence.reduce((sum,s)=>sum+100*s.risk!.okYears/s.risk!.totalYears,0)/plan.sequence.length,8);
      expect(plan.components!.income).toBeCloseTo(plan.sequence.reduce((sum,s)=>sum+s.yield!.relativePct,0)/plan.sequence.length,8);
    }
    data.indicators.trends = [{type:'drought',active:true,evidence:[]},{type:'heat',active:true,evidence:[]}];
    expect(recommend(data).baseline.components!.risk).toBe(result.baseline.components!.risk);
    expect(result.baseline.components!.risk).toBe(80);
    expect(recommend(data,[...crops].reverse())).toEqual(recommend(data));
    data.indicators.history!.reverse();
    expect(recommend(data)).toEqual(recommend({...data,indicators:{...data.indicators,history:[...data.indicators.history!].reverse()}}));
  });
  it('sin historia o con cuatro años conserva puntajes anteriores y avisa', () => {
    const data = complete(); delete data.indicators.history;
    const result = recommend(data);
    expect(result.confidence).toBe('medium');
    expect(result.baseline.components!.risk).toBe(80);
    expect(result.warnings).toContain('Sin historia suficiente: riesgo estimado con el promedio');
    for (const plan of [...result.recommendations,result.baseline]) {
      expect(plan.sequence.every(s=>s.risk === null && s.yield === null)).toBe(true);
      expect(plan.components!.income).toBeCloseTo(plan.sequence.reduce((sum,s)=>sum+findCrop(s.cropId)!.incomeOpportunity,0)/plan.sequence.length,8);
    }
    data.indicators.history = historicalRows().filter(r=>r.year < 2014);
    expect(recommend(data)).toEqual(result);
    data.indicators.history = historicalRows().filter(r=>r.year < 2015);
    expect(recommend(data).baseline.sequence.every(s=>s.risk?.totalYears === 5)).toBe(true);
  });
});

import { schedule } from '../src/modules/rotation-engine/engine/schedule.js';

describe('RF-14: mejor fecha de siembra', () => {
  const setup = () => {
    const data = indicators();
    const window = {...data.windows[0], start:'2025-08-01', end:'2026-02-28', durationDays:212, irrigated:true};
    data.windows = [window];
    data.climatology = Array.from({length:12},(_,i) => Object.entries({T2M:20,T2M_MIN:10,T2M_MAX:25,PRECTOTCORR:300,ALLSKY_SFC_SW_DWN:18}).map(([variable,value])=>({variable,value,month:i+1,samples:10,unit:''}))).flat();
    data.history = historicalRows().map(r=>({...r,value:r.variable === 'T2M' && r.month >= 8 && r.month <= 10 && r.year < 2016 ? 35 : r.variable === 'T2M_MIN' ? 10 : r.value}));
    return {data,window,crop:{...findCrop('oats')!,cycleDays:30}};
  };
  it('prefiere noviembre a agosto y desempata con la fecha más temprana', () => {
    const {data,window,crop} = setup();
    const result = schedule(crop,window,data,Date.parse('2025-08-01T00:00:00Z'));
    expect(new Date(result.scheduled!.start).toISOString().slice(0,10)).toBe('2025-11-01');
    data.history!.reverse();
    expect(schedule(crop,window,data,Date.parse('2025-08-01T00:00:00Z'))).toEqual(result);
  });
  it('rechaza todas las fechas por debajo de 70 % y publica la razón', () => {
    const {data,window,crop} = setup();
    data.history = data.history!.map(r=>({...r,value:r.variable === 'T2M' && r.year < 2016 ? 35 : r.value}));
    const result = schedule(crop,window,data,Date.parse('2025-08-01T00:00:00Z'));
    expect(result.scheduled).toBeNull();
    expect(result.reasons.join()).toContain('Solo 4 de 10 años dentro de lo que aguanta el cultivo');
  });
  it('acepta exactamente siete de diez años', () => {
    const {data,window,crop} = setup();
    data.history = data.history!.map(r=>({...r,value:r.variable === 'T2M' ? r.year < 2013 ? 35 : 20 : r.value}));
    expect(schedule(crop,window,data,Date.parse('2025-08-01T00:00:00Z')).scheduled).not.toBeNull();
  });
  it('con cuatro años completos conserva toda la salida sin historia', () => {
    const {data,window,crop} = setup();
    const start = Date.parse('2025-08-17T00:00:00Z');
    const previous = schedule(crop,window,{...data,history:[]},start);
    data.history = data.history!.filter(r=>r.year < 2014);
    expect(schedule(crop,window,data,start)).toEqual(previous);
    expect(new Date(previous.scheduled!.start).toISOString().slice(0,10)).toBe('2025-08-17');
  });
});

describe('RF-14b: causa del descanso', () => {
  const horizon = {start:'2025-01-01',end:'2025-03-31'};
  const crop = {...findCrop('maize')!,frostSensitive:true};
  const reason = (temperature:number, rain:number, irrigated:boolean, catalog = [crop]) => {
    const data = indicators();
    data.windows = [{...data.windows[0],...horizon,irrigated}];
    data.climatology = [1,2,3].flatMap(month=>Object.entries({T2M:temperature,T2M_MIN:temperature-5,T2M_MAX:temperature+5,PRECTOTCORR:rain,ALLSKY_SFC_SW_DWN:18}).map(([variable,value])=>({variable,value,month,samples:10,unit:''})));
    return rests([],data.windows,horizon,data,catalog)[0].reason;
  };
  it('identifica calor, frío y agua, y respeta riego', () => {
    expect(reason(45,300,true)).toBe('Hace demasiado calor para los cultivos del catálogo en este tramo');
    expect(reason(-5,300,true)).toBe('Hace demasiado frío para los cultivos del catálogo en este tramo');
    expect(reason(24,0,false)).toBe('Falta lluvia y no hay riego declarado en este tramo');
    expect(reason(24,0,true)).toBe('Ningún cultivo completa su ciclo en este tramo');
  });
  it('sin causa dominante o sin catálogo conserva el respaldo', () => {
    expect(reason(45,300,true,[])).toBe('Ningún cultivo completa su ciclo en este tramo');
    expect(reason(24,300,true,[{...crop,tempMax:20},{...crop,tempMin:30}])).toBe('Ningún cultivo completa su ciclo en este tramo');
  });
  it('cuenta cada cultivo una vez por causa y no depende del orden', () => {
    const catalog = [{...crop,tempMax:20},{...crop,tempMax:22},{...crop,tempMin:30}];
    expect(reason(24,300,true,catalog)).toBe('Hace demasiado calor para los cultivos del catálogo en este tramo');
    expect(reason(24,300,true,[...catalog].reverse())).toBe(reason(24,300,true,catalog));
  });
});

it('RF-14b desempata cultivos afectados por cantidad de meses afectados', () => {
  const data = indicators();
  const horizon = {start:'2025-01-01',end:'2025-03-31'};
  data.windows = [{...data.windows[0],...horizon,irrigated:true}];
  data.climatology = [1,2,3].flatMap(month=>[
    {variable:'T2M',month,value:month === 1 ? 10 : 35,samples:10,unit:'C'},
    {variable:'T2M_MIN',month,value:5,samples:10,unit:'C'},
  ]);
  const catalog = [{...findCrop('oats')!,tempMin:0,tempMax:30,frostSensitive:false}, {...findCrop('maize')!,tempMin:15,tempMax:40,frostSensitive:false}];
  expect(rests([],data.windows,horizon,data,catalog)[0].reason).toBe('Hace demasiado calor para los cultivos del catálogo en este tramo');
});

it('RF-14 lleva el rechazo histórico a las razones públicas y no reutiliza historia de otra petición', () => {
  const data = input();
  data.indicators.history = historicalRows().map(row=>({...row,value:row.variable === 'T2M' ? 55 : row.variable === 'T2M_MIN' ? 10 : row.value}));
  const rejected = recommend(data);
  expect(rejected.status).toBe('no_viable_options');
  expect(rejected.baseline.explanation.join()).toContain('Solo 0 de 10 años dentro de lo que aguanta el cultivo');
  expect(rejected.warnings.join()).toContain('Solo 0 de 10 años dentro de lo que aguanta el cultivo');
  data.indicators.history = historicalRows();
  expect(recommend(data).status).toBe('ok');
});

it('RF-14b reconoce frío histórico sin helada aunque el promedio pase', () => {
  const data = indicators();
  const horizon = {start:'2025-01-01',end:'2025-03-31'};
  data.windows = [{...data.windows[0],...horizon,irrigated:true}];
  data.history = historicalRows().map(row=>({...row,value:row.variable === 'T2M' && row.year < 2016 ? 5 : row.variable === 'T2M_MIN' ? 2 : row.value}));
  expect(rests([],data.windows,horizon,data,[findCrop('maize')!])[0].reason).toBe('Hace demasiado frío para los cultivos del catálogo en este tramo');
});

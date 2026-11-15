import { schedule } from '../src/modules/rotation-engine/engine/schedule.js';
import { findCrop } from '../src/modules/crop-knowledge/crop-catalog.js';
import { indicators } from './fixtures.js';

it('encuentra siembra de verano dentro de ventana anual con heladas de invierno', () => {
  const data = indicators();
  const window = { ...data.windows[0], start: '2025-01-01', end: '2025-12-31', durationDays: 365, temperatureMin: -5, irrigated: true };
  data.windows = [window];
  data.climatology = Array.from({ length: 12 }, (_, i) => [
    { variable: 'T2M', month: i+1, value: i >= 3 && i <= 8 ? 24 : 8, samples: 10, unit: 'C' },
    { variable: 'T2M_MIN', month: i+1, value: i >= 3 && i <= 8 ? 15 : -5, samples: 10, unit: 'C' },
    { variable: 'T2M_MAX', month: i+1, value: 30, samples: 10, unit: 'C' },
    { variable: 'PRECTOTCORR', month: i+1, value: 100, samples: 10, unit: 'mm/month' },
  ]).flat();
  const result = schedule(findCrop('maize')!, window, data, Date.parse('2025-01-01T00:00:00Z'));
  expect(new Date(result.scheduled!.start).toISOString().slice(0, 10)).toBe('2025-04-01');
  expect(result.scheduled!.effective.temperatureMin).toBe(15);
  expect(result.scheduled!.effective.precipitationMm).toBeLessThan(500);
});

import { cycleDemand, etoDaily, kcSeason } from '../src/modules/rotation-engine/engine/evapotranspiration.js';

it('calcula ETo de junio y Kc estacional con referencias aritméticas', () => {
  // 0.0135 × 42.1 × 24.3 × 0.408 = 5.63484924 mm/día.
  expect(etoDaily(24.3, 24.3)).toBeCloseTo(5.63484924, 8);
  expect(kcSeason({ini:.3,mid:1.2,end:.35})).toBeCloseTo(.8225, 8);
  const crop = findCrop('maize')!;
  const normals = [
    {variable:'T2M',month:6,value:24.3,samples:10,unit:'C'},
    {variable:'ALLSKY_SFC_SW_DWN',month:6,value:24.3,samples:10,unit:'MJ/m²/day'},
  ];
  const start = Date.parse('2028-06-01T00:00:00Z'), end = Date.parse('2028-06-30T00:00:00Z');
  expect(cycleDemand(crop,start,end,normals)).toMatchObject({method:'radiation', etoMm: expect.closeTo(169.0454772,6), demandMm:expect.closeTo(139.039904997,5)});
  expect(cycleDemand(crop,start,end,normals.slice(0,1))).toMatchObject({method:'catalog',etoMm:null,demandMm:crop.waterMm,warning:expect.any(String)});
});

it('suma días parciales e incluye el 29 de febrero', () => {
  const crop = findCrop('maize')!;
  const normals = [2,3].flatMap(month => [
    {variable:'T2M',month,value:20,samples:10,unit:'C'},
    {variable:'ALLSKY_SFC_SW_DWN',month,value:20,samples:10,unit:'MJ/m²/day'},
  ]);
  const demand = cycleDemand(crop,Date.parse('2028-02-28T00:00:00Z'),Date.parse('2028-03-02T00:00:00Z'),normals);
  expect(demand.etoMm).toBeCloseTo(16.656192,6);
});

it('ETc cambia la viabilidad sin riego y conserva respaldo sin radiación', () => {
  const data = indicators();
  const crop = {...findCrop('maize')!,cycleDays:30};
  const window = {...data.windows[0],start:'2025-06-01',end:'2025-06-30',durationDays:30,precipitationMm:100};
  data.windows=[window];
  data.climatology=[
    {variable:'T2M',month:6,value:24.3,samples:10,unit:'C'},
    {variable:'ALLSKY_SFC_SW_DWN',month:6,value:24.3,samples:10,unit:'MJ/m²/day'},
    {variable:'PRECTOTCORR',month:6,value:100,samples:10,unit:'mm/month'},
  ];
  const start = Date.parse('2025-06-01T00:00:00Z');
  expect(schedule(crop,window,data,start).scheduled?.water.method).toBe('radiation');
  data.climatology=data.climatology.filter(n => n.variable !== 'ALLSKY_SFC_SW_DWN');
  expect(schedule(crop,window,data,start).scheduled).toBeNull();
  expect(schedule(crop,{...window,irrigated:true},data,start).scheduled?.water.method).toBe('catalog');
});

it('usa catálogo para todo el ciclo si falta radiación en un solo mes', () => {
  const data = indicators();
  const start = Date.parse('2028-01-15T00:00:00Z'), end = Date.parse('2028-02-15T00:00:00Z');
  data.climatology.push({variable:'ALLSKY_SFC_SW_DWN',month:1,value:20,samples:10,unit:'MJ/m²/day'});
  const crop = findCrop('maize')!;
  expect(cycleDemand(crop,start,end,data.climatology)).toMatchObject({method:'catalog',etoMm:null,demandMm:crop.waterMm});
});

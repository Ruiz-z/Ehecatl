import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildYearCalendar } from './calendar.ts';
import type { TimePoint, SowingWindow } from './types.ts';
const point = (overrides: Partial<TimePoint> = {}): TimePoint => ({ date: '2026-03', month: 'Mar', rainfall: 10, rainfallNormal: 20, temperature: 22, temperatureNormal: 20, moisture: 29, moistureNormal: 40, ndvi: .4, ndviNormal: .5, ...overrides });
const labels = (data: TimePoint) => buildYearCalendar([data], []).map(row => row.cells[0]!.label);
const year = (overrides: Partial<TimePoint> = {}) => Array.from({length:12}, (_, i) => point({...overrides, date:`2026-${String(i+1).padStart(2,'0')}`}));
test('clasifica las cinco filas con límites inclusivos y zonas compartidas', () => {
  assert.deepEqual(labels(point({rainfall:15, ndvi:.25, ndviNormal:.5})), ['Poca','Más calor','Seca','Más secas','No']);
  assert.deepEqual(labels(point({rainfall:25, temperature:18, moisture:50, ndvi:.75, ndviNormal:.5})), ['Mucha','Más fresco','Buena','Más verdes','No']);
  assert.equal(labels(point({temperature:22.4,temperatureNormal:20.4}))[1], 'Más calor');
  assert.equal(labels(point({ndvi:.6}))[3], 'Más verdes');
  assert.equal(labels(point({ndvi:.4}))[3], 'Más secas');
  assert.deepEqual(labels(point({rainfall:20, temperature:20, moisture:30, ndvi:.5})), ['Normal','Normal','Regular','Normal','No']);
});
test('no inventa valores ni comparaciones con normal ausente o cero', () => {
  const rows = buildYearCalendar([point({rainfall:null, temperatureNormal:null, ndviNormal:0, moisture:null})], undefined);
  assert.equal(rows[0]!.cells[0]!.label, 'Sin dato');
  assert.equal(rows[1]!.cells[0]!.zone, null);
  assert.equal(rows[3]!.cells[0]!.zone, null);
  assert.equal(rows[4]!.cells[0]!.label, 'Sin dato');
  assert.equal(rows[4]!.summary, undefined);
});
test('usa months de ventanas incluso cuando cruzan el año, sin inferir meses desde fechas', () => {
  const windows: SowingWindow[] = [{id:'w', start:'2027-11-01',end:'2028-03-31',months:[11,12,1,2,3],irrigated:false}];
  const rows = buildYearCalendar([point(),point({date:'2026-04'})],windows);
  assert.deepEqual(rows[4]!.cells.map(cell => cell.label), ['Sí','No']);
  assert.equal(rows[4]!.summary, 'Meses en que el clima deja sembrar: marzo.');
  assert.equal(buildYearCalendar(year(),[])[4]!.summary,'Este año el clima no deja ningún mes para sembrar sin riego.');
});
test('resume doce meses, suma lluvia y compara temperatura promedio', () => {
  const rows = buildYearCalendar(year(), []);
  assert.equal(buildYearCalendar(year({rainfall:18,temperature:20.5}),[])[0]!.summary,'Llovió 10 % menos de lo normal en el año.');
  assert.equal(buildYearCalendar(year({temperature:20.5}),[])[1]!.summary,'La temperatura promedio estuvo 0.5 °C arriba de lo normal.');
  assert.equal(rows[0]!.total,'En 12 meses llovieron 120 mm; lo normal son 240 mm.');
  assert.equal(rows[0]!.summary,'Llovió 50 % menos de lo normal en el año.');
  assert.equal(rows[1]!.summary,'La temperatura promedio estuvo 2 °C arriba de lo normal.');
  assert.equal(rows[2]!.summary,'La tierra estuvo seca la mayor parte del año.');
  assert.equal(rows[0]!.cells[2]!.description, 'marzo: Poca, 10 mm; Lo normal: 20 mm');
  assert.equal(buildYearCalendar(year({rainfall:30,temperature:18}),[])[0]!.summary,'Llovió 50 % más de lo normal en el año.');
  assert.equal(buildYearCalendar(year({temperature:18}),[])[1]!.summary,'La temperatura promedio estuvo 2 °C abajo de lo normal.');
});
test('no extrapola años incompletos ni elige humedad mayoritaria si hay empate', () => {
  assert.equal(buildYearCalendar(year().slice(1),[])[0]!.total,undefined);
  assert.equal(buildYearCalendar(year({rainfall:null}),[])[0]!.summary,undefined);
  assert.equal(buildYearCalendar(year().map((p,i) => ({...p,moisture:i<6 ? 20 : 60})),[])[2]!.summary,undefined);
  assert.equal(buildYearCalendar(year({rainfall:20,temperature:20}),[])[0]!.summary,'Llovió lo normal en el año.');
});
test('Plantas conserva el texto aprobado de Estado para el último mes comparable', () => {
  const rows = buildYearCalendar([point({ndvi:.25}),point({date:'2026-04',ndvi:null})],[]);
  assert.equal(rows[3]!.summary,'Las plantas de la zona se ven mucho más secas que en marzo de otros años.');
});

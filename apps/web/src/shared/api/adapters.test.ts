import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatDate, formatMonth, initials, mapIndicators, mapParcel, mapRecommendations, mapSession, type ApiIndicators, type ApiRecommendations } from './adapters.ts';
const crops = [{ id: 'maize', name: 'Maíz', family: 'Poaceae' }, { id: 'soybean', name: 'Soya', family: 'Fabaceae' }, { id: 'potato', name: 'Papa', family: 'Solanaceae' }];
const priorities = { water: 60, soil: 20, income: 10, risk: 10 };

test('el login traduce el rol y calcula la expiración', () => {
  const session = mapSession({ accessToken: 't', expiresIn: 3600, user: { id: 'u1', email: 'a@b.c', name: 'Agricultora de Coahuila', role: 'FARMER' } }, priorities, 1000);
  assert.equal(session.user.role, 'farmer');
  assert.equal(session.user.initials, 'AD');
  assert.equal(session.expiresAt, 1000 + 3600000);
  assert.deepEqual(session.user.priorities, priorities);
  assert.equal(mapSession({ accessToken: 't', expiresIn: 1, user: { id: 'a', email: 'x@y.z', name: 'Admin', role: 'ADMIN' } }, priorities).user.role, 'admin');
});
test('una parcela del API usa su primera zona y el nombre del cultivo', () => {
  const parcel = mapParcel({ id: 'p1', ownerId: 'u1', name: 'Demo', lat: 25.4, lon: -101, zones: [{ id: 'z1', currentCropId: 'maize', irrigated: true, lat: null, lon: null }] }, crops);
  assert.equal(parcel?.zoneId, 'z1');
  assert.equal(parcel?.crop, 'Maíz');
  assert.equal(parcel?.irrigation, true);
  assert.equal(parcel?.latitude, 25.4);
  assert.equal(parcel?.risk, 'unknown');
  assert.equal(mapParcel({ id: 'p2', ownerId: 'u1', name: 'Sin zona', lat: 0, lon: 0, zones: [] }, crops), null);
});
test('las iniciales y fechas se formatean en español', () => {
  assert.equal(initials('Ana Martínez Ruiz'), 'AM');
  assert.equal(formatDate('2027-06-01'), '1 de junio de 2027');
  assert.equal(formatMonth('2026-09-01'), 'septiembre de 2026');
});

const recommendations: ApiRecommendations = {
  status: 'ok', origin: 'cache', confidence: 'low', warnings: ['modis: Fuente incompleta o sin cobertura', 'x'.repeat(200)],
  currentCropRisk: { level: 'high', reasons: ['Agua insuficiente'], changeAt: '2027-06-01' },
  inputs: { indicators: { period: { end: '2026-10-31' } } },
  recommendations: [{ id: 'potato>soybean', score: 77.87, components: { water: 51.6, soil: 90.5, income: 87.5, risk: 64 },
    sequence: [{ cropId: 'potato', cropName: 'Papa', start: '2027-06-01', end: '2027-09-28' }, { cropId: 'soybean', cropName: 'Soya', start: '2028-06-01', end: '2028-09-28' }],
    explanation: ['Cambio de familia: ruptura de hospederos de plagas'], risks: ['Validar semilla'] }]
};
test('las recomendaciones se ubican en el horizonte de 24 meses', () => {
  const result = mapRecommendations(recommendations, crops);
  assert.equal(result.horizonStart, '2026-11');
  assert.equal(result.confidence, 'Baja');
  const [strategy] = result.strategies;
  assert.equal(strategy?.name, 'Papa → Soya');
  assert.equal(strategy?.baseline, false);
  assert.deepEqual(strategy?.axes, { water: 51.6, soil: 90.5, income: 87.5, risk: 64 });
  assert.equal(strategy?.windows[0]?.startMonth, 7);
  assert.equal(strategy?.windows[0]?.months, 4);
  assert.equal(strategy?.windows[0]?.family, 'other');
  assert.equal(strategy?.windows[1]?.family, 'legume');
  assert.equal(strategy?.windows[1]?.startMonth, 19);
  assert.equal(strategy?.changeAt, '1 de junio de 2027');
  assert.equal(strategy?.reasons[0]?.origin, undefined);
  assert.equal(strategy?.confidenceReason, 'modis: Fuente incompleta o sin cobertura');
  assert.deepEqual(result.risk, { level: 'high', reasons: ['Agua insuficiente'] });
});
test('sin opciones viables no inventa estrategias', () => {
  const result = mapRecommendations({ ...recommendations, status: 'no_viable_options', recommendations: [] }, crops);
  assert.equal(result.status, 'no_viable_options');
  assert.deepEqual(result.strategies, []);
});

test('la referencia viable se muestra como mantener lo actual con sus valores reales', () => {
  const result = mapRecommendations({ ...recommendations, baseline: {
    ...recommendations.recommendations[0]!, id: 'baseline', viable: true,
    sequence: [{ cropId: 'maize', cropName: 'Maíz', start: '2027-06-01', end: '2027-09-28' }]
  } }, crops);
  const reference = result.strategies.find(strategy => strategy.baseline);
  assert.equal(reference?.name, 'Mantener lo actual');
  assert.equal(reference?.windows[0]?.current, true);
  assert.equal(reference?.axes.water, 51.6);
  assert.equal(reference?.changeAt, 'Se conserva el cultivo actual');
});

test('la referencia inviable conserva sus razones sin inventar ejes ni puntaje', () => {
  const result = mapRecommendations({ ...recommendations, baseline: {
    id: 'baseline', viable: false, score: null, components: null, sequence: [],
    explanation: ['Riesgo de helada'], risks: []
  } }, crops);
  assert.ok(result.strategies.every(strategy => !strategy.baseline));
  assert.deepEqual(result.baselineUnavailableReasons, ['Riesgo de helada']);
});

const indicators: ApiIndicators = {
  period: { start: '2025-11-01', end: '2026-10-31' }, origin: 'live', warnings: [], sources: {},
  monthly: [
    { variable: 'PRECTOTCORR', date: '2026-09-01', value: 30, unit: 'mm/month', source: 'NASA POWER' },
    { variable: 'PRECTOTCORR', date: '2026-10-01', value: 30, unit: 'mm/month', source: 'NASA POWER' },
    { variable: 'T2M_MAX', date: '2026-10-01', value: 30, unit: 'C', source: 'NASA POWER' },
    { variable: 'GWETROOT', date: '2026-10-01', value: 0.22, unit: 'fraction', source: 'NASA POWER' },
    { variable: 'T2M', date: '2026-10-01', value: null, unit: 'C', source: 'NASA POWER' }
  ],
  climatology: [{ variable: 'PRECTOTCORR', month: 10, value: 60 }, { variable: 'T2M_MAX', month: 10, value: 27.9 }, { variable: 'GWETROOT', month: 10, value: 0.4 }]
};
test('los indicadores se explican en lenguaje llano con su semáforo', () => {
  const result = mapIndicators(indicators);
  const [rain, heat, root] = result.observations;
  assert.equal(rain?.value, '30 mm');
  assert.equal(rain?.status, 'Escasa');
  assert.equal(rain?.tone, 'warning');
  assert.match(rain?.consequence ?? '', /50 % menos que lo normal/);
  assert.equal(heat?.status, 'Elevado');
  assert.equal(root?.value, '22 %');
  assert.equal(root?.tone, 'warning');
  assert.equal(result.origin, 'live');
  assert.equal(result.lastObservation, 'octubre de 2026');
});
test('los faltantes quedan nulos y NDVI sin cobertura no se inventa', () => {
  const result = mapIndicators(indicators);
  assert.equal(result.ndvi.value, null);
  const october = result.series.find(point => point.month === 'Oct');
  assert.equal(october?.rainfall, 30);
  assert.equal(october?.rainfallNormal, 60);
  assert.equal(october?.moisture, 22);
  assert.equal(october?.temperature, null);
  assert.equal(october?.ndvi, null);
  assert.equal(result.summaries.ndvi, undefined);
  assert.equal(result.summaries.rainfall?.text, '50 % menos que lo normal');
});

test('mapea pasos con efectos, clima y descansos sin duplicar riesgos', () => {
  const response = structuredClone(recommendations);
  const item = response.recommendations[0]!;
  item.sequence[0]!.reasons = [{ text: 'Cambio de familia', effect: 'favor' }];
  item.sequence[0]!.climate = { meanTemperature: 20.5, rainMm: 65, cycleDays: 90 };
  item.rests = [{ start: '2026-11-01', end: '2027-02-28', months: 4, reason: 'Fuera de temporada: frío o falta de agua', suggestion: 'Mantener cobertura o rastrojo para proteger el suelo' }];
  item.risks = ['Validar semilla', 'Validar semilla'];
  const strategy = mapRecommendations(response, crops).strategies[0]!;
  assert.equal(strategy.steps?.[0]?.reasons?.[0]?.effect, 'favor');
  assert.deepEqual(strategy.steps?.[0]?.climate, item.sequence[0]!.climate);
  assert.deepEqual(strategy.rests, item.rests);
  assert.deepEqual(strategy.risks, ['Validar semilla']);
  assert.equal(strategy.windows[0]?.start, '2027-06-01');
});
test('el fallback conserva la explicación plana y no inventa clima ni descansos', () => {
  const strategy = mapRecommendations(recommendations, crops).strategies[0]!;
  assert.deepEqual(strategy.reasons, recommendations.recommendations[0]!.explanation.map(text => ({text})));
  assert.equal(strategy.steps?.[0]?.climate, undefined);
  assert.deepEqual(strategy.rests, []);
});

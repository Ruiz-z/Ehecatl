import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatDate, formatMonth, initials, mapIndicators, mapParcel, mapRecommendations, mapSession, type ApiIndicators, type ApiRecommendations } from './adapters.ts';
import { selectZone } from '../../features/parcels/zones.ts';
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
  const parcel = mapParcel({ id: 'p1', ownerId: 'u1', name: 'Demo', lat: 25.76, lon: -102.98, zones: [{ id: 'z1', currentCropId: 'maize', irrigated: true, lat: null, lon: null }] }, crops);
  assert.equal(parcel?.zoneId, 'z1');
  assert.equal(parcel?.crop, 'Maíz');
  assert.equal(parcel?.irrigation, true);
  assert.equal(parcel?.latitude, 25.76);
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
  assert.equal(strategy?.confidenceReason, recommendations.warnings.join(' · '));
  assert.deepEqual(result.risk, { level: 'high', reasons: ['Agua insuficiente'] });
});
test('sin opciones viables no inventa estrategias', () => {
  const result = mapRecommendations({ ...recommendations, status: 'no_viable_options', recommendations: [] }, crops);
  assert.equal(result.status, 'no_viable_options');
  assert.deepEqual(result.strategies, []);
});

test('cada zona conserva cultivo, punto y riego y no se sustituye una zona inválida', () => {
  const parcel = mapParcel({ id: 'p1', ownerId: 'u1', name: 'Dos zonas', lat: 25, lon: -101, zones: [
    { id: 'z1', name: 'Principal', currentCropId: 'maize', irrigated: true, lat: null, lon: null },
    { id: 'z2', name: 'Sur', currentCropId: 'soybean', irrigated: false, lat: -33, lon: -68 }
  ] }, crops)!;
  const south = selectZone(parcel, 'z2')!;
  assert.equal(south.zoneId, 'z2'); assert.equal(south.crop, 'Soya'); assert.equal(south.latitude, -33); assert.equal(south.irrigation, false);
  assert.equal(parcel.zoneId, 'z1'); assert.equal(selectZone(parcel, 'ajena'), null);
});

test('se conservan el puntaje y los pesos calculados por el servidor', () => {
  const result = mapRecommendations({ ...recommendations, priorities }, crops);
  assert.equal(result.strategies[0]?.score, 77.87);
  assert.deepEqual(result.priorities, priorities);
});

test('NDVI conserva proveedor, producto, fecha y resolución reales', () => {
  const result = mapIndicators({ ...indicators, fetchedAt: '2026-11-15T10:00:00Z', monthly: [...indicators.monthly,
    { variable: 'NDVI', value: 0.4, unit: 'index', date: '2026-09-01', source: 'MODIS MYD13Q1 / Microsoft Planetary Computer', resolution: '250 m' }
  ] });
  assert.equal(result.ndvi.observedAt, '2026-09-01'); assert.equal(result.ndvi.date, 'septiembre de 2026');
  assert.equal(result.ndvi.resolution, '250 m');
  assert.match(result.ndvi.source!, /MYD13Q1/); assert.equal(result.fetchedAt, '2026-11-15T10:00:00Z');
  assert.deepEqual(result.metadata?.ndvi?.sources, ['MODIS MYD13Q1 / Microsoft Planetary Computer']);
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
  trends: [{type:'drought',active:true,evidence:['Lluvia bajo la normal']},{type:'heat',active:true,evidence:['Calor']}],
  anomalies: [{variable:'PRECTOTCORR',date:'2026-10-01',value:-30,percent:-50},{variable:'T2M_MAX',date:'2026-10-01',value:2.1,percent:7.5},{variable:'GWETROOT',date:'2026-10-01',value:-.18,percent:-45}],
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
  assert.equal(rain?.status, 'Llovió 50 % menos de lo normal.');
  assert.equal(rain?.tone, 'warning');
  assert.match(rain?.status ?? '', /50 % menos de lo normal/);
  assert.equal(heat?.status, 'Hizo 2.1 °C más de lo normal.');
  assert.equal(root?.value, '22 %');
  assert.equal(root?.tone, 'neutral');
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
  assert.equal(result.summaries.rainfall?.text, 'Llovió 50 % menos de lo normal.');
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

test('conserva balance ETc y fallback de catálogo sin inventarlo para respuestas antiguas', () => {
  const response = structuredClone(recommendations);
  const water = {etoMm:400,kc:.85,demandMm:340,rainMm:65,coveragePct:65/340*100,method:'radiation' as const};
  response.recommendations[0]!.sequence[0]!.water=water;
  assert.deepEqual(mapRecommendations(response,crops).strategies[0]!.steps![0]!.water,water);
  response.recommendations[0]!.sequence[0]!.water={...water,etoMm:null,method:'catalog'};
  assert.equal(mapRecommendations(response,crops).strategies[0]!.steps![0]!.water?.method,'catalog');
  assert.equal(mapRecommendations(recommendations,crops).strategies[0]!.steps![0]!.water,undefined);
});

test('mapea agua faltante aditiva y conserva compatibilidad sin el campo', () => {
  const response = structuredClone(recommendations);
  response.recommendations[0]!.irrigationNeedMm = 240;
  assert.equal(mapRecommendations(response,crops).strategies[0]!.irrigationNeedMm,240);
  assert.equal(mapRecommendations(recommendations,crops).strategies[0]!.irrigationNeedMm,undefined);
  response.baseline = { ...response.recommendations[0]!,id:'baseline',viable:true,irrigationNeedMm:1330 };
  assert.equal(mapRecommendations(response,crops).strategies.find(s => s.baseline)?.irrigationNeedMm,1330);
});


test('Bloque A: sequía del motor prevalece aunque el mes solo esté 23 % bajo la normal', () => {
  const data = { ...indicators, trends: [{type:'drought' as const,active:true,evidence:['-26.83']}],
    anomalies: [{variable:'PRECTOTCORR',date:'2026-10-01',value:-13.8,percent:-23}] };
  const result = mapIndicators(data);
  assert.equal(result.observations[0]?.status, 'Llovió 23 % menos de lo normal.');
  assert.equal(result.observations[0]?.tone, 'warning');
  assert.match(result.observations[0]?.status ?? '', /23 % menos/);
  assert.match(result.observations[0]?.consequence ?? '', /Faltan datos de algunos meses/);
});
test('Bloque A: NDVI bajo absoluto puede estar más verde que su normal', () => {
  const result = mapIndicators({...indicators,
    monthly:[...indicators.monthly,{variable:'NDVI',date:'2026-10-01',value:.2295,unit:'index',source:'MODIS'}],
    anomalies:[{variable:'NDVI',date:'2026-10-01',value:.0848,percent:58.6}],
    trends:[{type:'vegetation_stress',active:false,evidence:[]}]});
  assert.equal(result.ndvi.label, 'Las plantas de la zona se ven más verdes que en octubre de otros años.');
  assert.equal(result.ndvi.value, .2295);
});
test('Bloque A: no inventa normalidad ni interpreta índices absolutos sin normal', () => {
  const result = mapIndicators({...indicators,trends:[],anomalies:[],climatology:[],
    monthly:[...indicators.monthly,{variable:'NDVI',date:'2026-10-01',value:.23,unit:'index',source:'MODIS'}]});
  assert.match(result.ndvi.label, /Sin comparación suficiente/);
  assert.equal(result.observations[0]?.tone, 'neutral');
  assert.notEqual(result.observations[0]?.status, 'Normal');
});


test('Bloque A: acumula doce meses completos y sus normales sin duplicar ni extrapolar', () => {
  const monthly = Array.from({length:12},(_,i) => ({variable:'PRECTOTCORR',date:`${i<2 ? 2025 : 2026}-${String((i+10)%12+1).padStart(2,'0')}-01`,value:10,unit:'mm/month',source:'NASA POWER'}));
  const data = {...indicators,monthly,climatology:Array.from({length:12},(_,i) => ({variable:'PRECTOTCORR',month:i+1,value:20})),
    anomalies:[{variable:'PRECTOTCORR',date:'2026-10-01',value:-10,percent:-50}],trends:[{type:'drought' as const,active:true,evidence:[]}]};
  assert.match(mapIndicators(data).observations[0]!.consequence,/En 12 meses llovieron 120 mm; lo normal son 240 mm/);
  assert.match(mapIndicators({...data,climatology:[]}).observations[0]!.consequence,/Sin comparación suficiente/);
  assert.match(mapIndicators({...data,monthly:monthly.slice(1)}).observations[0]!.consequence,/Faltan datos de algunos meses/);
});
test('Bloque A: riesgos agrupados y todos los faltantes se conservan para la tarjeta', () => {
  const warning = 'Aviso largo: '+ 'faltante '.repeat(30);
  const response = {...recommendations,warnings:[warning],inputs:{indicators:{period:{end:'2026-10-31'},sources:{power:{status:'available',reason:null},modis:{status:'partial',reason:'Dos meses sin cobertura'}}}},
    recommendations:[{...recommendations.recommendations[0]!,riskGroups:[{type:'heat',text:'Calor: hasta 37.4 °C, tolerancia 32 °C, en 2 de 3 ciclos'}]}]};
  const strategy = mapRecommendations(response,crops).strategies[0]!;
  assert.deepEqual(strategy.risks,response.recommendations[0]!.riskGroups.map(g=>g.text));
  assert.match(strategy.known!.join(),/POWER/);
  assert.ok(strategy.missing!.includes(warning));
  assert.match(strategy.missing!.join(),/MODIS: datos parciales; Dos meses/);
});
test('sin señal activa conserva los tonos y clasifica la humedad con cortes orientativos', () => {
  const result = mapIndicators({...indicators,trends:[{type:'heat',active:false,evidence:[]},{type:'drought',active:false,evidence:[]}]});
  assert.equal(result.observations[0]!.status,'Llovió lo normal para esta época.');
  assert.equal(result.observations[1]!.status,'Hizo el calor de siempre para esta época.');
  assert.equal(result.observations[2]!.status,'Seca');
  assert.equal(result.observations[2]!.rawValue,'0.22 fraction');
});

test('humedad usa cortes orientativos de 30 y 50 sin cambiar el tono del API', () => {
  for (const [value, zone, status] of [[.299, 0, 'Seca'], [.30, 1, 'Regular'], [.499, 1, 'Regular'], [.50, 2, 'Buena']] as const) {
    const result = mapIndicators({ ...indicators, monthly: [{ variable: 'GWETROOT', date: '2026-10-01', value, unit: 'fraction', source: 'NASA POWER' }] });
    assert.equal(result.observations[0]?.zone, zone);
    assert.equal(result.observations[0]?.status, status);
    assert.equal(result.observations[0]?.tone, 'neutral');
    assert.match(result.observations[0]!.consequence, /Es una estimación del satélite/);
  }
});
test('verdor compara el mismo mes con límites inclusivos sin usar el valor absoluto', () => {
  for (const [percent, zone] of [[-20, 0], [-19.99, 1], [19.99, 1], [20, 2]] as const) {
    const result = mapIndicators({ ...indicators,
      monthly: [{variable:'NDVI',date:'2026-10-01',value:.38,unit:'index',source:'MODIS'}],
      anomalies: [{variable:'NDVI',date:'2026-10-01',value:0,percent}] });
    assert.equal(result.ndvi.zone, zone);
    assert.match(result.ndvi.label, /octubre de otros años\./);
  }
});
test('una lectura nula reciente no se rellena con el verdor de otro mes', () => {
  const result = mapIndicators({ ...indicators, monthly: [
    {variable:'NDVI',date:'2026-09-01',value:.38,unit:'index',source:'MODIS'},
    {variable:'NDVI',date:'2026-10-01',value:null,unit:'index',source:'MODIS'}
  ] });
  assert.equal(result.ndvi.value, null);
  assert.equal(result.summaries.ndvi, undefined);
  assert.equal(result.ndvi.zone, undefined);
  assert.equal(result.ndvi.label, 'El satélite no tiene una lectura clara este mes y no la inventamos.');
});

test('la comparación ausente no recibe tono bueno aunque la tendencia esté inactiva', () => {
  const result = mapIndicators({ ...indicators, anomalies: [], trends: [{type:'drought',active:false,evidence:[]}] });
  assert.equal(result.observations[0]?.tone, 'neutral');
  assert.equal(result.summaries.rainfall?.tone, 'neutral');
  assert.equal(result.summaries.rainfall?.text, 'Sin comparación suficiente');
});

test('calendario: completa doce meses del periodo y conserva las ventanas sin inventarlas', () => {
  const windows = [{id:'w',start:'2026-11-01',end:'2027-02-28',months:[11,12,1,2],irrigated:false}];
  const result = mapIndicators({...indicators,windows});
  assert.equal(result.series.length,12);
  assert.equal(result.series[0]!.date,'2025-11');
  assert.equal(result.series[0]!.rainfall,null);
  assert.equal(result.series[11]!.date,'2026-10');
  assert.deepEqual(result.windows,windows);
  assert.equal(mapIndicators(indicators).windows,undefined);
});
test('Estado fecha el encabezado con clima y no con una lectura MODIS posterior', () => {
  const result = mapIndicators({...indicators,monthly:[
    {variable:'PRECTOTCORR',date:'2026-09-01',value:4,unit:'mm',source:'NASA POWER'},
    {variable:'T2M_MAX',date:'2026-09-01',value:30,unit:'C',source:'NASA POWER'},
    {variable:'NDVI',date:'2026-10-01',value:.4,unit:'index',source:'MODIS'}]});
  assert.equal(result.lastDataMonth,'2026-09');
  assert.equal(result.lastObservation,'septiembre de 2026');
});

test('conserva los campos históricos por paso y tolera el respaldo nulo', () => {
  const risk = {okYears:8,totalYears:10,failures:{heat:0,frost:2,temperature:0,water:0}};
  const yieldData = {relativePct:100,ky:1.25,irrigatedAssumed:true,kyEstimated:false,kySource:'FAO-66 tabla 1, Maize'};
  const response = {...recommendations,recommendations:[{...recommendations.recommendations[0]!,sequence:[
    {...recommendations.recommendations[0]!.sequence[0]!,risk,yield:yieldData},
    {...recommendations.recommendations[0]!.sequence[1]!,risk:null,yield:null}
  ]}]};
  const steps = mapRecommendations(response,crops).strategies[0]!.steps!;
  assert.deepEqual(steps[0]!.risk,risk);
  assert.deepEqual(steps[0]!.yield,yieldData);
  assert.equal(steps[1]!.risk,null);
  assert.equal(steps[1]!.yield,null);
});

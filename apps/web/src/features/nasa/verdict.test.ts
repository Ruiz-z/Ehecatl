import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildVerdict } from './verdict.ts';
import type { Observation } from './types.ts';
const observations = (drought: boolean, heat: boolean): Observation[] => [
  { variable: 'PRECTOTCORR', alertActive: drought }, { variable: 'T2M_MAX', alertActive: heat }
].map(row => ({ label: '', value: '', status: '', consequence: '', source: '', date: '', origin: 'live', tone: 'neutral', ...row }));
for (const [drought, heat, title, text] of [
  [true, true, 'Hay que cuidar el agua', 'Llovió menos de lo normal y hace más calor. Tu maíz va a necesitar más riego este ciclo.'],
  [true, false, 'Hay que cuidar el agua', 'Llovió menos de lo normal. Tu maíz va a necesitar más riego este ciclo.'],
  [false, true, 'Hace más calor de lo normal', 'Con este calor tu maíz gasta más agua y va a necesitar más riego.'],
  [false, false, 'Sin alertas por ahora', 'La lluvia y el calor van como en otros años por esta fecha.']
] as const) {
  test(`resumen con sequía=${drought} y calor=${heat}`, () => {
    assert.deepEqual(buildVerdict(observations(drought, heat), 'maíz', 'octubre', 'octubre'), {
      title, text, tone: drought || heat ? 'warning' : 'good', showButton: drought || heat
    });
  });
}
test('avisa del mes pendiente sin mutar las observaciones', () => {
  const rows = observations(false, false);
  const before = structuredClone(rows);
  assert.equal(buildVerdict(rows, 'maíz', 'septiembre', 'octubre').note, 'Todavía no hay datos de octubre. Lo que ves llega hasta septiembre.');
  assert.deepEqual(rows, before);
});
test('no asegura ausencia de alertas si faltan tendencias', () => {
  assert.equal(buildVerdict([], 'maíz', '', 'octubre').tone, 'neutral');
  assert.equal(buildVerdict([], 'maíz', '', 'octubre').text, '');
});
test('compara meses completos con cambio de año y no anuncia faltantes si hay datos posteriores', () => {
  assert.equal(buildVerdict(observations(false, false), 'maíz', '2025-12', '2026-01').note,
    'Todavía no hay datos de enero. Lo que ves llega hasta diciembre.');
  assert.equal(buildVerdict(observations(false, false), 'maíz', '2026-11', '2026-10').note, undefined);
});
test('con lluvia y calor normales pero plantas más secas avisa sin botón', () => {
  const result = buildVerdict(observations(false, false), 'maíz', 'octubre', 'octubre', true);
  assert.equal(result.title, 'Revisa tus plantas');
  assert.equal(result.tone, 'warning');
  assert.equal(result.showButton, false);
});

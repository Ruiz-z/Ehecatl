import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { summarizeRests } from './rests.ts';
const base = { months: 3, start: '2026-11-01', end: '2027-02-28' };
test('la sugerencia se dice una sola vez si todos los descansos coinciden', () => {
  const result = summarizeRests([
    { ...base, reason: 'Fuera de temporada: frío o falta de agua', suggestion: 'Mantener cobertura' },
    { ...base, reason: 'Ningún cultivo completa su ciclo en este tramo', suggestion: 'Mantener cobertura' }
  ]);
  assert.equal(result.suggestion, 'mantener cobertura');
  assert.equal(result.items[0]?.reason, 'fuera de temporada: frío o falta de agua');
  assert.equal(result.items[1]?.reason, 'ningún cultivo completa su ciclo en este tramo');
});
test('si las sugerencias difieren, cada descanso conserva la suya', () => {
  const result = summarizeRests([
    { ...base, reason: 'Fuera de temporada', suggestion: 'Cobertura' },
    { ...base, reason: 'Otro motivo', suggestion: 'Barbecho' }
  ]);
  assert.equal(result.suggestion, null);
  assert.equal(result.items[1]?.reason, 'otro motivo · barbecho');
});

for (const reason of ['Hace demasiado calor para los cultivos del catálogo en este tramo', 'Hace demasiado frío para los cultivos del catálogo en este tramo', 'Falta lluvia y no hay riego declarado en este tramo', 'Falta lluvia NASA en este tramo']) {
  test(`conserva la causa: ${reason}`, () => {
    const result = summarizeRests([{...base, reason, suggestion:'Mantener cobertura'}]);
    assert.equal(result.items[0]?.reason, reason.charAt(0).toLowerCase()+reason.slice(1));
  });
}

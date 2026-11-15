import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pollingDelay, canPoll } from './live.ts';

test('espera normal y retroceso con límite de un minuto', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 20].map(errors => pollingDelay(5000, errors)), [5000, 5000, 10000, 20000, 40000, 60000, 60000]);
  assert.equal(pollingDelay(1000, 0), 1000);
  assert.equal(pollingDelay(1000, 1), 5000);
  assert.equal(pollingDelay(5000, 0), 5000);
});
test('pausa sin visibilidad o foco y evita solicitudes encimadas', () => {
  for (const visible of [false, true]) for (const focused of [false, true]) for (const busy of [false, true]) {
    assert.equal(canPoll(visible, focused, busy), visible && focused && !busy);
  }
});

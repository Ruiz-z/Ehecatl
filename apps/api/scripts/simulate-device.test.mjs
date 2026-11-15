import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from './simulate-device.mjs';

const options = { baseUrl: 'http://127.0.0.1:3001', apiKey: 'test-only-key', count: 1, intervalMs: 1000, sleep: async () => {} };
test('el simulador rechaza dispositivos reales antes de escribir', async () => {
  const calls = [];
  await assert.rejects(simulate({ ...options, fetcher: async (url, init) => {
    calls.push({ path: url.pathname, method: init.method }); return { ok: true, json: async () => ({ origin: 'REAL' }) };
  } }), /SIMULATED/);
  assert.equal(calls.length, 1); assert.equal(calls[0].path, '/device');
});
test('el reintento conserva identificador, medición y contenido', async () => {
  const bodies = []; let posts = 0;
  const receipts = await simulate({ ...options, fetcher: async (url, init) => {
    if (url.pathname === '/device') return { ok: true, json: async () => ({ origin: 'SIMULATED' }) };
    bodies.push(init.body); if (++posts === 1) throw new TypeError('network failure');
    const sample = JSON.parse(init.body);
    return { ok: true, json: async () => ({ accepted: true, readingId: sample.readingId, origin: 'SIMULATED' }) };
  } });
  assert.equal(bodies[0], bodies[1]); assert.equal(receipts.length, 1);
});
test('clave rechazada y exceso de tasa no se interpretan como éxito', async () => {
  await assert.rejects(simulate({ ...options, fetcher: async () => ({ ok: false, status: 401 }) }), /401/);
  let attempts = 0;
  await assert.rejects(simulate({ ...options, fetcher: async url => url.pathname === '/device'
    ? { ok: true, json: async () => ({ origin: 'SIMULATED' }) } : (attempts++, { ok: false, status: 429 }) }), /agotados/);
  assert.equal(attempts, 4);
});
test('no envía credenciales por HTTP a destinos remotos ni acepta cantidades ilimitadas', async () => {
  for (const change of [{ baseUrl: 'http://remote.invalid' }, { count: 0 }, { count: 10001 }, { intervalMs: 0 }, { soilRaw: 4096 }]) await assert.rejects(simulate({ ...options, ...change }), /HTTPS|inválidos/);
});

test('el simulador recoge, ejecuta y reporta una orden manual marcada', async () => {
  const { pollIrrigation } = await import('./simulate-device.mjs');
  let clock = 2000000000000, reported;
  const startedAt = clock - 1000;
  const result = await pollIrrigation({ ...options, startedAt, now: () => clock,
    sleep: async ms => { clock += ms; }, fetcher: async (url, init) => {
      if (url.pathname === '/device') return { ok: true, json: async () => ({ origin: 'SIMULATED' }) };
      if (url.pathname.endsWith('/next')) return { ok: true, status: 200, json: async () => ({ id: 'test-command', durationSeconds: 10, createdAt: new Date(clock).toISOString(), expiresAt: new Date(clock + 120000).toISOString() }) };
      reported = JSON.parse(init.body); return { ok: true };
    } });
  assert.equal(result.origin, 'SIMULATED'); assert.deepEqual(reported, { status: 'DONE', actualSeconds: 10 });
});

test('el simulador rechaza orden previa al arranque y no espera para regar', async () => {
  const { pollIrrigation } = await import('./simulate-device.mjs');
  const clock = 2000000000000; let slept = false, reported;
  await pollIrrigation({ ...options, startedAt: clock, now: () => clock, sleep: async () => { slept = true; }, fetcher: async (url, init) => {
    if (url.pathname === '/device') return { ok: true, json: async () => ({ origin: 'SIMULATED' }) };
    if (url.pathname.endsWith('/next')) return { ok: true, status: 200, json: async () => ({ id: 'old', durationSeconds: 10, createdAt: new Date(clock - 1).toISOString(), expiresAt: new Date(clock + 120000).toISOString() }) };
    reported = JSON.parse(init.body); return { ok: true };
  } });
  assert.equal(slept, false); assert.deepEqual(reported, { status: 'FAILED', actualSeconds: 0 });
});

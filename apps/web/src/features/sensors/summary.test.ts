import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshness, soilState, connectionSentence, lastIrrigation, primaryDevice } from './summary.ts';
import type { Device, IrrigationCommand } from './api.ts';
const now = Date.parse('2026-11-15T12:00:00Z');
test('fechas relativas y sin lecturas', () => {
  assert.equal(freshness('2026-11-15T11:55:00Z', now), 'hace 5 min');
  assert.equal(freshness('2026-11-15T09:00:00Z', now), 'hace 3 h');
  assert.equal(freshness(null, now), 'Sin lecturas');
});
test('umbrales de tierra', () => {
  assert.equal(soilState(null), 'Sin dato');
  assert.equal(soilState(0.29), 'Seca'); assert.equal(soilState(0.3), 'Bien');
  assert.equal(soilState(0.69), 'Bien'); assert.equal(soilState(0.7), 'Húmeda');
});
test('tres estados de conexión', () => {
  const device = { connection: 'online', expectedIntervalSeconds: 300, lastReceivedAt: '2026-11-15T11:55:00Z', lastMeasuredAt: '2026-11-15T11:55:00Z' } as Device;
  assert.match(connectionSentence(undefined, now), /Aún no hay sensor/);
  assert.match(connectionSentence(device, now), /en línea/);
  assert.match(connectionSentence(device, now + 3600000), /Sin señal/);
});
test('último riego completado sin mutar la lista', () => {
  const commands = [{ id: '1', status: 'DONE', createdAt: '2026-11-14' }, { id: '2', status: 'PENDING', createdAt: '2026-11-15' }] as IrrigationCommand[];
  assert.equal(lastIrrigation(commands)?.id, '1'); assert.equal(commands[0].id, '1');
  assert.equal(lastIrrigation([]), null);
});
test('lecturas inválidas y futuras', () => {
  assert.equal(freshness('inválida', now), 'Sin lecturas');
  assert.equal(freshness('2026-11-16T12:00:00Z', now), 'hace un momento');
  assert.equal(soilState(Number.NaN), 'Sin dato');
});
test('elige el activo más reciente sin cambiar el orden recibido', () => {
  const devices = [
    { id: 'empty', status: 'ACTIVE', lastReceivedAt: null },
    { id: 'old', status: 'ACTIVE', lastReceivedAt: '2026-11-14T12:00:00Z' },
    { id: 'revoked', status: 'REVOKED', lastReceivedAt: '2026-11-15T12:00:00Z' },
    { id: 'latest', status: 'ACTIVE', lastReceivedAt: '2026-11-15T11:00:00Z' },
  ] as Device[];
  assert.equal(primaryDevice(devices)?.id, 'latest');
  assert.equal(devices[0].id, 'empty');
  assert.equal(primaryDevice([]), undefined);
});

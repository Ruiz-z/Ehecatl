import { randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { calibrated, measurementDate, readingInput } from '../src/modules/field-sensors/validation.js';
import { deviceView } from '../src/modules/field-sensors/sensors.service.js';
import type { FieldDevice } from '../src/generated/prisma/client.js';

describe('Spec 007: normalización y frescura de mediciones', () => {
  const input = () => ({ readingId: randomUUID(), measuredAt: new Date().toISOString(), soilMoistureRaw: 1800, airTemperature: 24, airHumidity: 60, mq2Raw: 300 });
  it('normaliza muestras y calcula un hash estable independiente del orden JSON', () => {
    const data = input();
    expect(readingInput(data)).toEqual(readingInput(Object.fromEntries(Object.entries(data).reverse())));
    expect(readingInput({ readingId: data.readingId, measuredAt: data.measuredAt, soilMoistureRaw: 0 }).soilMoistureRaw).toBe(0);
  });
  it.each([{ airTemperature: NaN }, { airHumidity: 101 }, { soilMoistureRaw: 4096 }, { soilMoistureRaw: 1.5 }, { mq2Raw: -1 }, { airTemperature: Infinity }, { airHumidity: null }, { zoneId: randomUUID() }, { origin: 'REAL' }, { soilMoisture: 0.5 }, { humidity: 40 }, { readingId: 'no-uuid' }])('rechaza valores o campos inválidos %j', change => {
    expect(() => readingInput({ ...input(), ...change })).toThrow(BadRequestException);
  });
  it('requiere una variable y rechaza horas normalizadas o sin UTC', () => {
    expect(() => readingInput({ readingId: randomUUID(), measuredAt: new Date().toISOString() })).toThrow('variable');
    for (const time of ['2026-02-30T10:00:00Z', '2026-11-15T24:00:00Z', '2026-11-15T12:60:00Z', '2026-11-15', '2026-11-15T10:00:00-06:00']) expect(() => measurementDate(time)).toThrow();
  });
  it('calibra ambos sentidos y conserva ausencia de calibración sin recortar', () => {
    expect(calibrated(1800, 3000, 600)).toBe(0.5);
    expect(calibrated(1800, 600, 3000)).toBe(0.5);
    expect(calibrated(0, null, null)).toBeNull();
    expect(() => calibrated(3500, 3000, 600)).toThrow('calibrado');
  });
  it('estado depende de medición y no de una recepción reciente; no expone hash', () => {
    const now = Date.now();
    const base = { id: randomUUID(), keyHash: randomBytes(32).toString('hex'), status: 'ACTIVE', expectedIntervalSeconds: 300,
      lastMeasuredAt: new Date(now - 1000000), lastReceivedAt: new Date(now) } as FieldDevice;
    expect(deviceView(base, now)).toMatchObject({ connection: 'offline', ageSeconds: 1000 });
    expect(deviceView(base)).not.toHaveProperty('keyHash');
    expect(deviceView({ ...base, lastMeasuredAt: new Date(now - 900000) }, now).connection).toBe('online');
    expect(deviceView({ ...base, status: 'REVOKED', lastMeasuredAt: new Date(now) }, now).connection).toBe('revoked');
  });
});

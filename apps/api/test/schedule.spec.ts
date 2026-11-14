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

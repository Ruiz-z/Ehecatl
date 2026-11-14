import type { Indicators } from '../src/modules/nasa-data/contracts.js';

export function indicators(): Indicators {
  return { version: 1, point: { lat: 0, lon: 0 }, period: { start: '2024-01-01', end: '2024-12-31' }, origin: 'live', fetchedAt: '2025-01-01T00:00:00Z',
    sources: { power: { status: 'available', reason: null }, modis: { status: 'available', reason: null } },
    monthly: [{ variable: 'T2M', date: '2024-01-01', value: 24, unit: 'C', source: 'NASA POWER', resolution: '0.5 degrees' }],
    climatology: Array.from({ length: 12 }, (_, i) => ({ variable: 'T2M', month: i+1, value: 24, samples: 10, unit: 'C' })),
    anomalies: [], trends: [], warnings: [], windows: [
      { id: 'w1', start: '2025-01-01', end: '2025-05-31', months: [1, 2, 3, 4, 5], durationDays: 151, temperatureMin: 15, temperatureMax: 30, meanTemperature: 24, precipitationMm: 700, irrigated: false },
      { id: 'w2', start: '2025-07-01', end: '2025-11-30', months: [7, 8, 9, 10, 11], durationDays: 153, temperatureMin: 15, temperatureMax: 30, meanTemperature: 24, precipitationMm: 700, irrigated: false },
      { id: 'w3', start: '2026-01-01', end: '2026-05-31', months: [1, 2, 3, 4, 5], durationDays: 151, temperatureMin: 15, temperatureMax: 30, meanTemperature: 24, precipitationMm: 700, irrigated: false },
    ] };
}

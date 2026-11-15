import { request } from '@/shared/api/client';

export interface Device {
  id: string; zoneId: string; name: string; origin: 'REAL' | 'SIMULATED'; status: 'ACTIVE' | 'REVOKED';
  connection: 'online' | 'offline' | 'revoked'; ageSeconds: number | null;
  dryRaw: number | null; wetRaw: number | null; depthCm: number | null; calibrationVersion: number;
  expectedIntervalSeconds: number; lastMeasuredAt: string | null; lastReceivedAt: string | null;
}
export interface Reading {
  id: string; deviceId: string; zoneId: string; readingId: string; measuredAt: string; receivedAt: string;
  origin: 'REAL' | 'SIMULATED'; soilMoistureRaw: number | null; soilMoisture: number | null;
  airTemperature: number | null; airHumidity: number | null; mq2Raw: number | null; calibrationVersion: number;
}
export interface ReadingPage { items: Reading[]; nextCursor: string | null; from: string; to: string }
export interface DeviceConfig { name: string; expectedIntervalSeconds: number; dryRaw: number | null; wetRaw: number | null; depthCm: number | null }
export interface IssuedKey { device: Device; apiKey: string }
export interface IrrigationCommand {
  id: string; durationSeconds: number; actualSeconds: number | null;
  status: 'PENDING' | 'DELIVERED' | 'DONE' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  createdAt: string; deliveredAt?: string | null; origin: Device['origin']; requestedBy: { id: string; name: string };
}
export const sensorsApi = {
  irrigationHistory: (zoneId: string, signal?: AbortSignal) => request<IrrigationCommand[]>(`/zones/${encodeURIComponent(zoneId)}/irrigation-commands`, 'GET', undefined, undefined, signal),
  water: (zoneId: string, durationSeconds: number) => request(`/zones/${encodeURIComponent(zoneId)}/irrigation-commands`, 'POST', { durationSeconds }),
  cancel: (id: string) => request(`/irrigation-commands/${encodeURIComponent(id)}`, 'DELETE'),
  devices: (zoneId: string, signal?: AbortSignal) => request<Device[]>(`/zones/${encodeURIComponent(zoneId)}/devices`, 'GET', undefined, undefined, signal),
  readings: (zoneId: string, query: { from?: string; to?: string; cursor?: string } = {}, signal?: AbortSignal) => request<ReadingPage>(`/zones/${encodeURIComponent(zoneId)}/readings?${new URLSearchParams(query)}`, 'GET', undefined, undefined, signal),
  create: (zoneId: string, input: DeviceConfig & { origin: Device['origin'] }) => request<IssuedKey>('/devices', 'POST', { ...input, zoneId }),
  update: (id: string, input: DeviceConfig & { zoneId: string }) => request<Device>(`/devices/${encodeURIComponent(id)}`, 'PATCH', input),
  rotate: (id: string) => request<IssuedKey>(`/devices/${encodeURIComponent(id)}/rotate-key`, 'POST'),
  revoke: (id: string) => request<Device>(`/devices/${encodeURIComponent(id)}/revoke`, 'POST'),
};

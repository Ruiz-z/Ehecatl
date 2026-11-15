import type { Device, IrrigationCommand } from './api.ts';
import { SOIL_DRY, SOIL_WET } from './copy.ts';

export function freshness(date: string | null, now: number) {
  if (!date || !Number.isFinite(Date.parse(date))) return 'Sin lecturas';
  const minutes = Math.max(0, Math.floor((now - Date.parse(date)) / 60000));
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 1440) return `hace ${Math.floor(minutes / 60)} h`;
  return `hace ${Math.floor(minutes / 1440)} días`;
}
export function soilState(index: number | null) {
  if (index === null || !Number.isFinite(index)) return 'Sin dato';
  return index < SOIL_DRY ? 'Seca' : index >= SOIL_WET ? 'Húmeda' : 'Bien';
}
export function isOnline(device: Device, now: number) {
  return device.status !== 'REVOKED' && device.connection === 'online' && device.lastMeasuredAt !== null && now - Date.parse(device.lastMeasuredAt) <= device.expectedIntervalSeconds * 3000;
}
export function connectionSentence(device: Device | undefined, now: number) {
  if (!device) return 'Aún no hay sensor en esta zona. Pide al administrador que lo registre.';
  if (isOnline(device, now)) return `Tu sensor está en línea. Última lectura ${freshness(device.lastMeasuredAt, now)}.`;
  return `Sin señal. ${device.lastReceivedAt ? `No recibimos datos desde ${freshness(device.lastReceivedAt, now)}.` : 'Todavía no recibimos datos.'} Revisa que el sensor tenga luz y WiFi.`;
}
export function lastIrrigation(commands: IrrigationCommand[]) {
  return commands.filter(command => command.status === 'DONE').sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
}
export function primaryDevice(devices: Device[]) {
  const received = (device: Device) => device.lastReceivedAt ? Date.parse(device.lastReceivedAt) : 0;
  return devices.filter(device => device.status === 'ACTIVE').sort((a, b) => received(b) - received(a))[0];
}

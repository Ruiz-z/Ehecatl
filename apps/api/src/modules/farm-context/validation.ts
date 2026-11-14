import { BadRequestException } from '@nestjs/common';
import { crops, findCrop } from '../crop-knowledge/crop-catalog.js';

export function objectBody(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Se requiere un objeto JSON');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new BadRequestException('Campos desconocidos');
  return input;
}
export function name(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) throw new BadRequestException('Nombre requerido (1–200 caracteres)');
  return value.trim();
}
export function coordinates(lat: unknown, lon: unknown): { lat: number; lon: number } {
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90 || typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180) throw new BadRequestException('Coordenadas inválidas');
  return { lat, lon };
}
export function cropId(value: unknown): string {
  if (typeof value !== 'string' || !findCrop(value)) throw new BadRequestException({ message: 'Cultivo fuera del catálogo', validCropIds: crops.map(c => c.id) });
  return value;
}
export function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new BadRequestException('Se requiere un booleano');
  return value;
}
export function soilNotes(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 4000) throw new BadRequestException('Notas inválidas (máximo 4000 caracteres)');
  return value;
}
export function realDate(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z)?$/.test(value)) throw new BadRequestException('Fecha ISO inválida');
  const result = new Date(value);
  if (!Number.isFinite(result.getTime()) || result.toISOString().slice(0, 10) !== value.slice(0, 10)) throw new BadRequestException('Fecha inexistente');
  return result;
}
export function historyData(input: Record<string, unknown>) {
  const plantedAt = realDate(input.plantedAt), harvestedAt = realDate(input.harvestedAt);
  if (harvestedAt < plantedAt || harvestedAt > new Date()) throw new BadRequestException('Cosecha anterior a siembra o fecha futura');
  const yieldTonHa = input.yieldTonHa;
  if (yieldTonHa !== undefined && yieldTonHa !== null && (typeof yieldTonHa !== 'number' || !Number.isFinite(yieldTonHa) || yieldTonHa < 0)) throw new BadRequestException('Rendimiento inválido');
  return { cropId: cropId(input.cropId), plantedAt, harvestedAt, yieldTonHa: yieldTonHa as number | null | undefined };
}

import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { objectBody, realDate } from '../farm-context/validation.js';

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new BadRequestException('Identificador UUID inválido');
  return value.toLowerCase();
}
export function bounded(value: unknown, field: string, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new BadRequestException(`${field}: valor fuera de rango`);
  }
  return value;
}
export function setting(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
export function measurementDate(value: unknown): Date {
  if (typeof value !== 'string' || !value.includes('T') || !value.endsWith('Z')) throw new BadRequestException('Se requiere fecha y hora ISO UTC');
  const date = realDate(value);
  // Date normaliza también horas inexistentes (p. ej. 24:00); no admitirlas.
  if (date.toISOString().slice(0, 19) !== value.slice(0, 19)) throw new BadRequestException('Hora inexistente');
  return date;
}
export function readingInput(body: unknown) {
  const input = objectBody(body, ['readingId', 'measuredAt', 'soilMoistureRaw', 'airTemperature', 'airHumidity', 'mq2Raw']);
  const fields = {
    soilMoistureRaw: input.soilMoistureRaw === undefined ? null : bounded(input.soilMoistureRaw, 'soilMoistureRaw', 0, 4095, true),
    airTemperature: input.airTemperature === undefined ? null : bounded(input.airTemperature, 'airTemperature', -50, 80),
    airHumidity: input.airHumidity === undefined ? null : bounded(input.airHumidity, 'airHumidity', 0, 100),
    mq2Raw: input.mq2Raw === undefined ? null : bounded(input.mq2Raw, 'mq2Raw', 0, 4095, true),
  };
  if (Object.values(fields).every(v => v === null)) throw new BadRequestException('Se requiere al menos una variable medida');
  const value = { readingId: uuid(input.readingId), measuredAt: measurementDate(input.measuredAt), ...fields };
  return { ...value, payloadHash: createHash('sha256').update(JSON.stringify(value)).digest('hex') };
}
export function calibrated(raw: number | null, dry: number | null, wet: number | null): number | null {
  if (raw === null || dry === null || wet === null) return null;
  const value = (raw - dry) / (wet - dry);
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new BadRequestException('Lectura fuera del intervalo calibrado; revisar sensor o calibración');
  return value;
}

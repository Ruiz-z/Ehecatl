import { BadRequestException } from '@nestjs/common';
import type { Weights } from '../../nasa-data/contracts.js';

export const defaultWeights: Weights = { water: 25, soil: 25, income: 25, risk: 25 };
export const weightKeys = ['water', 'soil', 'income', 'risk'] as const;
export function normalizeWeights(input: unknown): Weights {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Prioridades inválidas');
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some(key => !weightKeys.includes(key as typeof weightKeys[number]))) throw new BadRequestException('Prioridad desconocida');
  const values = weightKeys.map(key => data[key]);
  if (values.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100)) throw new BadRequestException('Cada peso debe ser un número de 0 a 100');
  const sum = (values as number[]).reduce((a, b) => a + b, 0);
  if (sum === 0) return { ...defaultWeights };
  const scaled = (values as number[]).map(v => v * 100 / sum);
  const rounded = scaled.map(Math.floor);
  const order = scaled.map((v, i) => ({ i, fraction: v-rounded[i] })).sort((a, b) => b.fraction-a.fraction || a.i-b.i);
  for (let left = 100-rounded.reduce((a, b) => a+b, 0), n = 0; left > 0; left--, n++) rounded[order[n].i]++;
  return Object.fromEntries(weightKeys.map((key, i) => [key, rounded[i]])) as unknown as Weights;
}

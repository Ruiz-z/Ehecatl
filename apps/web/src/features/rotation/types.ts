import type { Priorities } from '@/features/parcels/types';
export type CropFamily = 'grain' | 'legume' | 'other' | 'cover';
export interface CropWindow {
  crop: string;
  family: CropFamily;
  startMonth: number;
  months: number;
  current?: boolean;
  start?: string;
  end?: string;
}
export interface CycleClimate { meanTemperature: number | null; rainMm: number | null; cycleDays: number | null }
export interface CycleWater { etoMm: number | null; kc: number; demandMm: number; rainMm: number | null; coveragePct: number | null; method: 'radiation' | 'catalog' }
export interface RotationStep { previousCropName?: string; cropName: string; start: string; end: string; reasons?: Reason[]; climate?: CycleClimate; water?: CycleWater }
export interface Rest { start: string; end: string; months: number; reason: string; suggestion: string }
export interface Reason {
  effect?: 'favor' | 'contra' | 'neutral';
  // La API aún no etiqueta el origen ni el eje de cada razón; si faltan, no se inventan.
  origin?: 'Dato NASA' | 'Regla de rotación' | 'Tu parcela';
  text: string;
  axis?: keyof Priorities;
}
export interface Strategy {
  irrigationNeedMm?: number;
  score?: number;
  delta?: number | null;
  id: string;
  baseline: boolean;
  name: string;
  axes: Priorities;
  windows: CropWindow[];
  steps?: RotationStep[];
  rests?: Rest[];
  changeAt: string;
  reasons: Reason[];
  risks: string[];
  confidence: 'Alta' | 'Media' | 'Baja';
  confidenceReason: string;
  known?: string[];
  missing?: string[];
}
export interface RankedStrategy extends Strategy {
  score: number;
  // null cuando no hay estrategia actual contra la cual comparar.
  delta: number | null;
}
export interface RecommendationResult {
  priorities?: Priorities;
  status: 'ok' | 'no_viable_options';
  origin: 'live' | 'cache' | 'mock';
  confidence: 'Alta' | 'Media' | 'Baja';
  warnings: string[];
  risk: { level: 'high' | 'low'; reasons: string[] };
  // Inicio del horizonte de 24 meses, 'YYYY-MM'.
  horizonStart: string;
  strategies: Strategy[];
  baselineUnavailableReasons?: string[];
}

import type { Priorities } from '@/features/parcels/types';
export type CropFamily = 'grain' | 'legume' | 'other' | 'cover';
export interface CropWindow {
  crop: string;
  family: CropFamily;
  startMonth: number;
  months: number;
  current?: boolean;
}
export interface Reason {
  // La API aún no etiqueta el origen ni el eje de cada razón; si faltan, no se inventan.
  origin?: 'Dato NASA' | 'Regla de rotación' | 'Tu parcela';
  text: string;
  axis?: keyof Priorities;
}
export interface Strategy {
  id: string;
  baseline: boolean;
  name: string;
  axes: Priorities;
  windows: CropWindow[];
  changeAt: string;
  reasons: Reason[];
  risks: string[];
  confidence: 'Alta' | 'Media' | 'Baja';
  confidenceReason: string;
}
export interface RankedStrategy extends Strategy {
  score: number;
  // null cuando no hay estrategia actual contra la cual comparar.
  delta: number | null;
}
export interface RecommendationResult {
  status: 'ok' | 'no_viable_options';
  origin: 'live' | 'cache' | 'mock';
  confidence: 'Alta' | 'Media' | 'Baja';
  warnings: string[];
  risk: { level: 'high' | 'low'; reasons: string[] };
  // Inicio del horizonte de 24 meses, 'YYYY-MM'.
  horizonStart: string;
  strategies: Strategy[];
}

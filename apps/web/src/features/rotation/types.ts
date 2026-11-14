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
  origin: 'Dato NASA' | 'Regla de rotación' | 'Tu parcela';
  text: string;
  axis: keyof Priorities;
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
  delta: number;
}

import type { DemoUser, Parcel, Priorities } from '@/features/parcels/types';
import type { RecommendationResult } from '@/features/rotation/types';
import type { Observation, TimePoint } from '@/features/nasa/types';
import type { LoginInput } from '@/features/identity/validation';
export type { LoginInput, Parcel, Priorities };
export interface Session { user: DemoUser; accessToken: string; expiresAt: number }
export interface Crop { id: string; name: string; family: string }
export interface NewParcelInput { name: string; latitude: number; longitude: number; cropId: string; irrigation: boolean }
export type MetricKey = 'rainfall' | 'temperature' | 'moisture' | 'ndvi';
export interface MetricSummary { text: string; tone: 'warning' | 'good' | 'neutral' }
export interface Indicators {
  observations: Observation[];
  series: TimePoint[];
  summaries: Partial<Record<MetricKey, MetricSummary>>;
  ndvi: { value: number | null; label: string; source?: string; date?: string; zone?: number };
  lastObservation: string;
  lastDataMonth?: string;
  periodLabel: string;
  origin: 'live' | 'cache' | 'mock';
  warnings: string[];
}
export interface ApiClient {
  login(input: LoginInput): Promise<Session>;
  listCrops(): Promise<Crop[]>;
  listParcels(): Promise<Parcel[]>;
  createParcel(input: NewParcelInput): Promise<Parcel>;
  getIndicators(parcel: Parcel): Promise<Indicators>;
  getRecommendations(parcel: Parcel): Promise<RecommendationResult>;
  savePriorities(weights: Priorities): Promise<Priorities>;
}
export interface AuthClient {
  getSession(): Session | null;
  setSession(session: Session): void;
  logout(): void;
}

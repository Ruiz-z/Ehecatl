import type { DemoUser, Parcel, Priorities } from '@/features/parcels/types';
import type { RankedStrategy } from '@/features/rotation/types';
import type { Observation, TimePoint } from '@/features/nasa/fixtures/observations';
import type { LoginInput } from '@/features/identity/validation';
export type { LoginInput, Parcel, Priorities };
// Modelos de vista provisionales: B1 todavía no publica contratos JSON.
export interface Session { user: DemoUser; accessToken: string; expiresAt: number }
export interface Indicators { observations: Observation[]; series: TimePoint[]; origin: 'live' | 'cache' | 'mock' }
export interface ApiClient {
  login(input: LoginInput): Promise<Session>;
  listParcels(): Promise<Parcel[]>;
  createParcel(parcel: Parcel): Promise<Parcel>;
  getIndicators(parcel: Parcel): Promise<Indicators>;
  getRecommendations(parcel: Parcel, weights: Priorities): Promise<RankedStrategy[]>;
  savePriorities(weights: Priorities): Promise<Priorities>;
}
export interface AuthClient {
  getSession(): Session | null;
  setSession(session: Session): void;
  logout(): void;
}

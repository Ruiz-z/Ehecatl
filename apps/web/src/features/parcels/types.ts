export type Priorities = Record<'water' | 'soil' | 'income' | 'risk', number>;
export type DataState = 'ready' | 'empty' | 'error' | 'no-windows';
export interface Parcel {
  id: string;
  ownerId: string;
  name: string;
  place: string;
  latitude: number;
  longitude: number;
  crop: string;
  irrigation: boolean;
  area: number | null;
  risk: 'high' | 'moderate' | 'low';
  dataState: DataState;
}
export interface DemoUser {
  id: string;
  name: string;
  initials: string;
  region: string;
  description: string;
  priorities: Priorities;
}

export type Priorities = Record<'water' | 'soil' | 'income' | 'risk', number>;
export type DataState = 'ready' | 'empty' | 'error' | 'no-windows';
export interface ParcelZone {
  id: string; name: string; latitude: number; longitude: number;
  cropId: string; crop: string; irrigation: boolean;
}
export interface Parcel {
  id: string;
  ownerId: string;
  zoneId?: string;
  zones?: ParcelZone[];
  cropId?: string;
  name: string;
  place: string;
  latitude: number;
  longitude: number;
  crop: string;
  irrigation: boolean;
  area: number | null;
  risk: 'high' | 'moderate' | 'low' | 'unknown';
  dataState: DataState;
}
export interface DemoUser {
  id: string;
  email: string;
  role: 'farmer' | 'admin';
  name: string;
  initials: string;
  region: string;
  description: string;
  priorities: Priorities;
}

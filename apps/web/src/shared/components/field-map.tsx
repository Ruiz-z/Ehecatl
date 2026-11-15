'use client';

import dynamic from 'next/dynamic';
import type { Parcel } from '@/features/parcels/types';
export interface FieldMapProps {
  parcels: Parcel[];
  selectedId?: string;
  center?: [number, number];
  initialCenter?: [number, number];
  editable?: boolean;
  ndvi?: boolean;
  onSelect?: (id: string) => void;
  onPoint?: (latitude: number, longitude: number) => void;
}
const MapCanvas = dynamic(() => import('./map-canvas'), {
  ssr: false,
  loading: () => <div className="map-loading" role="status">Preparando el mapa…</div>
});
export function FieldMap(props: FieldMapProps) {
  return <div className="field-map">
    <MapCanvas {...props} />
  </div>;
}

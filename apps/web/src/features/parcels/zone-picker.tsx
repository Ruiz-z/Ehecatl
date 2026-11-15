'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Parcel } from './types';
import { parcelUrl, type ParcelTab } from './parcel-tabs';
import { apiClient, useMocks } from '@/shared/api/client';
import { useAsync } from '@/shared/api/use-async';

export function ZonePicker({ parcel, tab, onUpdate }: { parcel: Parcel; tab: ParcelTab; onUpdate: (parcel: Parcel) => void }) {
  const router = useRouter();
  const crops = useAsync(() => apiClient.listCrops(), 'zone-crops');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  return <div className="zone-picker">
    {parcel.zones && <label>Zona de la parcela<select value={parcel.zoneId} onChange={event => router.replace(parcelUrl(parcel.id, tab, event.target.value))}>{parcel.zones.map(zone => <option value={zone.id} key={zone.id}>{zone.name}</option>)}</select></label>}
    {!useMocks && <details><summary>Agregar zona</summary><form onSubmit={async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true); setError('');
      try { const saved = await apiClient.createZone(parcel, { name: String(data.get('name')), currentCropId: String(data.get('crop')), irrigated: data.get('irrigated') === 'on' }); onUpdate(saved); router.replace(parcelUrl(saved.id, tab, saved.zoneId)); }
      catch (e) { setError(e instanceof Error ? e.message : 'No se pudo agregar la zona.'); } finally { setPending(false); }
    }}>
      <label>Nombre de zona<input name="name" required maxLength={200} /></label>
      <label>Cultivo actual<select name="crop" required disabled={crops.status !== 'ready'}>{crops.status === 'ready' && crops.data.map(crop => <option key={crop.id} value={crop.id}>{crop.name}</option>)}</select></label>
      <label className="checkbox-label"><input name="irrigated" type="checkbox" />Tengo riego disponible</label>
      <p className="form-note">La nueva zona hereda las coordenadas de la parcela.</p>
      {crops.status === 'error' && <p role="alert">{crops.message}<button type="button" className="text-button" onClick={crops.retry}>Reintentar catálogo</button></p>}
      {error && <p role="alert">{error}</p>}<button className="button" disabled={pending || crops.status !== 'ready'}>Guardar zona</button>
    </form></details>}
  </div>;
}

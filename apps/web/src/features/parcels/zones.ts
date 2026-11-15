import type { Parcel } from './types';

export function selectZone(parcel: Parcel, id?: string | null): Parcel | null {
  if (!id) return parcel;
  const zone = parcel.zones?.find(item => item.id === id);
  if (!zone) return parcel.zoneId === id ? parcel : null;
  return { ...parcel, zoneId: zone.id, cropId: zone.cropId, crop: zone.crop, irrigation: zone.irrigation,
    latitude: zone.latitude, longitude: zone.longitude, place: `${zone.latitude.toFixed(3)}, ${zone.longitude.toFixed(3)}` };
}

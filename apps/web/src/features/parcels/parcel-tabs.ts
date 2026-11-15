export const parcelTabs = [
  { key: 'sembrar', label: 'Qué sembrar' },
  { key: 'estado', label: 'Estado' },
  { key: 'datos', label: 'Datos' },
  { key: 'sensores', label: 'Sensores' }
] as const;
export type ParcelTab = typeof parcelTabs[number]['key'];
export function resolveParcelTab(value: string | null): ParcelTab {
  return parcelTabs.find(tab => tab.key === value)?.key ?? 'sembrar';
}
export function parcelUrl(id: string, tab: ParcelTab = 'sembrar', zoneId?: string): string {
  return `/parcelas/${encodeURIComponent(id)}?tab=${tab}${zoneId ? `&zone=${encodeURIComponent(zoneId)}` : ''}`;
}

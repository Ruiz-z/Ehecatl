'use client';

import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import type { FieldMapProps } from './field-map';
const marker = L.divIcon({
  className: 'field-pin',
  html: '<span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});
const activeMarker = L.divIcon({
  className: 'field-pin selected',
  html: '<span></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});
function Behavior({
  center,
  editable,
  onPoint
}: Pick<FieldMapProps, 'center' | 'editable' | 'onPoint'>) {
  const map = useMap();
  const latitude = center?.[0];
  const longitude = center?.[1];
  useEffect(() => {
    if (latitude !== undefined && longitude !== undefined) map.setView([latitude, longitude], 13, {
      animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    });
  }, [latitude, longitude, map]);
  useMapEvents({
    click: event => {
      if (editable) onPoint?.(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6)));
    }
  });
  return null;
}
function LocationControl() {
  const map = useMap();
  const [message, setMessage] = useState('');
  return <div className="location-control">
    <button aria-label="Centrar en mi ubicación" title="Mi ubicación" onClick={() => {
      if (!navigator.geolocation) {
        setMessage('Ubicación no disponible. Usa las coordenadas.');
        return;
      }
      navigator.geolocation.getCurrentPosition(position => {
        map.setView([position.coords.latitude, position.coords.longitude], 13);
        setMessage('');
      }, () => setMessage('No pudimos ubicarte. Puedes escribir las coordenadas.'));
    }}><LocateFixed size={20} /></button>
    {message && <p role="status">{message}</p>}
  </div>;
}
export default function MapCanvas({
  parcels,
  selectedId,
  center,
  initialCenter,
  editable,
  ndvi,
  onSelect,
  onPoint
}: FieldMapProps) {
  const selected = parcels.find(parcel => parcel.id === selectedId) ?? parcels[0];
  const focus: [number, number] = center ?? initialCenter ?? (selected ? [selected.latitude, selected.longitude] : [20, 0]);
  const [failed, setFailed] = useState(false);
  return <><MapContainer center={focus} zoom={selected || center ? 13 : 2} zoomControl={true} className="leaflet-map" attributionControl={true}><LayersControl position="topright"><LayersControl.BaseLayer checked name="Satélite"><TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles © Esri · Source: Esri, Maxar, Earthstar Geographics, GIS User Community" eventHandlers={{
            tileerror: () => setFailed(true),
            tileload: () => setFailed(false)
          }} /></LayersControl.BaseLayer><LayersControl.BaseLayer name="Calles"><TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' /></LayersControl.BaseLayer>{selected && <LayersControl.Overlay checked={ndvi} name="Qué tan verdes están las plantas"><Circle center={[selected.latitude, selected.longitude]} radius={280} pathOptions={{
            className: 'ndvi-high',
            weight: 1,
            fillOpacity: 0.4
          }} /><Circle center={[selected.latitude + 0.002, selected.longitude - 0.002]} radius={170} pathOptions={{
            className: 'ndvi-medium',
            weight: 1,
            fillOpacity: 0.5
          }} /><Circle center={[selected.latitude - 0.001, selected.longitude + 0.002]} radius={100} pathOptions={{
            className: 'ndvi-low',
            weight: 1,
            fillOpacity: 0.6
          }} /></LayersControl.Overlay>}</LayersControl>{parcels.map(parcel => <Marker key={parcel.id} alt={parcel.name} title={parcel.name} position={[parcel.latitude, parcel.longitude]} icon={parcel.id === selectedId ? activeMarker : marker} eventHandlers={{
        click: () => onSelect?.(parcel.id)
      }}><Popup><strong>{parcel.name}</strong><br />{parcel.crop} · {parcel.place}</Popup></Marker>)}{editable && center && <Marker alt="Punto seleccionado" title="Punto seleccionado" position={center} icon={activeMarker} />}<Behavior center={focus} editable={editable} onPoint={onPoint} /><LocationControl /></MapContainer><div className="map-label">
    <span className="live-dot" />
    {editable ? 'Haz clic en el mapa para ubicar tu parcela' : 'Vista satelital'}
    <span>Esri World Imagery</span>
  </div><div className="mobile-map-attribution">Tiles © Esri, Maxar · © OpenStreetMap</div>
    {failed && <div className="map-error" role="status">El mapa requiere conexión. Puedes usar las coordenadas y el panel.</div>}</>;
}

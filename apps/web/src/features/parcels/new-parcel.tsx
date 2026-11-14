'use client';

import { useState } from 'react';
import { SheetHandle } from '@/shared/components/sheet-handle';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Check, ArrowRight } from 'lucide-react';
import { useDemo } from '@/features/identity/demo-provider';
import { FieldMap } from '@/shared/components/field-map';
export function NewParcel() {
  const {
    user,
    parcels,
    addParcel
  } = useDemo();
  const router = useRouter();
  const [point, setPoint] = useState<[number, number] | undefined>();
  const [name, setName] = useState('');
  const [crop, setCrop] = useState('Maíz');
  const [irrigation, setIrrigation] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  function updatePoint(latitude: number, longitude: number) {
    setPoint([latitude, longitude]);
    setLat(String(latitude));
    setLon(String(longitude));
    setError('');
  }
  function locate() {
    const latitude = Number(lat),
      longitude = Number(lon);
    if (!lat.trim() || !lon.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      setError('Usa una latitud entre −90 y 90 y una longitud entre −180 y 180.');
      return false;
    }
    updatePoint(latitude, longitude);
    return true;
  }
  return <main id="main" className="map-workspace">
    <FieldMap parcels={[]} center={point} initialCenter={parcels[0] ? [parcels[0].latitude, parcels[0].longitude] : undefined} editable onPoint={updatePoint} />
    <section className={`side-panel new-panel ${expanded ? 'sheet-expanded' : ''}`}>
      <SheetHandle expanded={expanded} onChange={setExpanded} />
      <Link className="back-link" href="/parcelas"><ArrowLeft size={16} />Mis parcelas</Link>
      <h1>Agrega tu parcela</h1>
      <p className="muted">Pon un punto en el mapa. Nosotros vemos el contexto.</p>
      <form onSubmit={event => {
        event.preventDefault();
        if (!locate() || !user) return;
        const id = crypto.randomUUID();
        addParcel({
          id,
          ownerId: user.id,
          name: name.trim(),
          crop,
          irrigation,
          latitude: Number(lat),
          longitude: Number(lon),
          place: `${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`,
          area: null,
          risk: 'moderate',
          dataState: 'empty'
        });
        router.push(`/parcelas/${id}`);
      }}>
        <div className="form-section">
          <h2><MapPin size={18} />Ubicación</h2>
          <p>Selecciona un punto o escribe las coordenadas.</p>
          <div className="coordinate-fields">
            <label>Latitud<input required type="number" min="-90" max="90" step="any" value={lat} onChange={event => setLat(event.target.value)} placeholder="−90 a 90" /></label>
            <label>Longitud<input required type="number" min="-180" max="180" step="any" value={lon} onChange={event => setLon(event.target.value)} placeholder="−180 a 180" /></label>
          </div>
          <button type="button" className="button secondary full" onClick={locate}>Ubicar en el mapa</button>
          {point && <p className="good-text location-saved"><Check size={14} />Punto seleccionado</p>}
          {error && <p className="error-text" role="alert">{error}</p>}
        </div>
        <div className="form-section">
          <h2>Sobre tu campo</h2>
          <label>Nombre de la parcela<input required pattern=".*\S.*" title="Escribe un nombre para la parcela, no solo espacios." maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Por ejemplo, La Nogalera" /></label>
          <label>Cultivo actual<select value={crop} onChange={event => setCrop(event.target.value)}>{['Maíz', 'Sorgo', 'Frijol', 'Cebada', 'Alfalfa', 'Soja', 'Trigo', 'Girasol', 'Avena', 'Garbanzo', 'Caupí', 'Vicia'].map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="checkbox-label">
            <input type="checkbox" checked={irrigation} onChange={event => setIrrigation(event.target.checked)} />
            <span>Tengo riego disponible<small>Nos ayuda a evaluar qué cultivos son viables.</small></span>
          </label>
        </div>
        <button type="submit" className="button primary full">Guardar parcela<ArrowRight size={17} /></button>
        <p className="form-note">Se guardará solo en este navegador como parte de la demo.</p>
      </form>
    </section>
  </main>;
}

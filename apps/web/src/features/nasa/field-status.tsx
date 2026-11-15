'use client';
import { parcelUrl } from '@/features/parcels/parcel-tabs';

import { Droplets, Thermometer, Sprout, ArrowUpRight, TriangleAlert, CheckCircle2, Satellite } from 'lucide-react';
import Link from 'next/link';
import type { Parcel } from '@/features/parcels/types';
import { apiClient, useMocks } from '@/shared/api/client';
import { waitingNote } from '@/shared/api/messages';
import { useAsync } from '@/shared/api/use-async';
import type { Indicators } from '@/shared/api/types';
import { EmptyState, LoadingState } from '@/shared/components/ui';
const icons = [Droplets, Thermometer, Sprout];
export function FieldStatus({
  parcel
}: {
  parcel: Parcel;
}) {
  const state = useAsync(() => apiClient.getIndicators(parcel), parcel.id);
  if (state.status === 'loading') return <LoadingState note={useMocks ? undefined : waitingNote} />;
  if (state.status === 'error') return <EmptyState title="No pudimos cargar los datos NASA"><p>{state.message}</p><button className="button primary" onClick={state.retry}>Reintentar</button></EmptyState>;
  return <Status parcel={parcel} data={state.data} />;
}
function Status({
  parcel,
  data
}: {
  parcel: Parcel;
  data: Indicators;
}) {
  const mock = data.origin === 'mock';
  return <div className="status-content">
    <div className="section-heading">
      <div>
        <h2>Así está tu campo</h2>
        <p>Última observación · {data.lastObservation || 'sin fecha'}</p>
      </div>
      <Satellite size={20} />
    </div>
    <div className="field-visuals">
      <div className="ndvi-card">
        <div className="visual-heading">
          <span>Verdor de la zona</span>
          <span className="chip neutral-chip">NDVI</span>
        </div>
        <strong className="ndvi-headline">{data.ndvi.label}</strong>
        {data.ndvi.value === null ? <small>MODIS no tiene una lectura confiable para este punto; no la inventamos.</small> : <details>
          <summary>Ver dato NASA</summary>
          <dl>
            <div><dt>Variable</dt><dd>NDVI</dd></div>
            <div><dt>Valor</dt><dd>{data.ndvi.value}</dd></div>
            <div><dt>Fuente</dt><dd>{data.ndvi.source ?? 'MODIS'}</dd></div>
            <div><dt>Fecha</dt><dd>{data.ndvi.date ?? data.lastObservation}</dd></div>
            <div><dt>Origen</dt><dd>{mock ? 'mock · datos de ejemplo' : data.origin}</dd></div>
          </dl>
        </details>}
      </div>
      <div className="satellite-card" role="img" aria-label={`Vista satelital de la ubicación de ${parcel.name}`} style={{
        backgroundImage: `url(https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${parcel.longitude - 0.018},${parcel.latitude - 0.018},${parcel.longitude + 0.018},${parcel.latitude + 0.018}&bboxSR=4326&size=400,400&format=jpg&f=image)`
      }}>
        <span>Tu ubicación</span>
        <MapCross />
        <small>Imagen © Esri</small>
      </div>
    </div>
    <p className="visual-disclaimer">NDVI ilustrativo de la zona; no mide una parcela delimitada.</p>
    <div className="indicators">
      {data.observations.filter(item => parcel.dataState !== 'error' || item.variable !== 'GWETROOT').map((observation, i) => {
        const Icon = icons[i] ?? Sprout;
        return <article className="indicator" key={observation.variable}>
        <div className="indicator-heading">
          <span><Icon size={19} />{observation.label}</span>
          <strong>{observation.value}</strong>
        </div>
        <p className={`indicator-status ${observation.tone === 'good' ? 'good-text' : observation.tone === 'warning' ? 'warning-text' : 'muted'}`}>{observation.tone === 'warning' ? <TriangleAlert size={15} /> : observation.tone === 'good' ? <CheckCircle2 size={15} /> : null}{observation.status}</p>
        <p>{observation.consequence}</p>
        <details>
          <summary>Ver dato NASA</summary>
          <dl>
            <div>
              <dt>Variable</dt>
              <dd>{observation.variable}</dd>
            </div>
            <div>
              <dt>Valor crudo</dt><dd>{observation.rawValue ?? observation.value}</dd>
            </div>
            <div>
              <dt>Fuente</dt>
              <dd>{observation.source}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{observation.date}</dd>
            </div>
            <div>
              <dt>Origen</dt>
              <dd>{mock ? 'mock · datos de ejemplo' : data.origin}</dd>
            </div>
          </dl>
        </details>
      </article>;
      })}
    </div>
    <Link className="next-decision" href={parcelUrl(parcel.id)}><div>
        <Sprout size={22} />
        <span><strong>Prepara el siguiente ciclo</strong><small>Compara qué sembrar y cuándo cambiar.</small></span>
      </div><ArrowUpRight size={22} /></Link>
    {data.warnings.length > 0 && <p className="status-source">{data.warnings.join(' · ')}</p>}
    <p className="status-source">{mock ? <>Datos de ejemplo basados en escenarios ilustrativos.<br /></> : null}NASA POWER · MODIS / ORNL DAAC</p>
  </div>;
}
function MapCross() {
  return <span className="satellite-cross" aria-hidden="true"><i /><i /></span>;
}

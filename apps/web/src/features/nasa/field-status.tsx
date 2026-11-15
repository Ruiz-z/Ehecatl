'use client';
import { useId, useState } from 'react';
import { copy } from './copy';
import { buildVerdict } from './verdict';
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
  const state = useAsync(() => apiClient.getIndicators(parcel), parcel.zoneId ?? parcel.id);
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
  const now = new Date();
  const expectedMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth()-1, 1)).toISOString().slice(0,7);
  const verdict = buildVerdict(data.observations, parcel.crop, data.lastDataMonth ?? '', expectedMonth, data.ndvi.zone === 0);
  return <div className="status-content">
    <div className="section-heading">
      <div>
        <h2>Así está tu campo</h2>
        <p>Última observación · {data.lastObservation || 'sin fecha'}</p>
      </div>
      <Satellite size={20} />
    </div>
    <section className={`field-verdict ${verdict.tone}`}>
      <h3>{verdict.title}</h3><p>{verdict.text}</p>
      {verdict.note && <p>{verdict.note}</p>}
      {verdict.showButton && <Link className="button primary" href={parcelUrl(parcel.id, 'sembrar', parcel.zoneId)}>{copy.verdict.button}</Link>}
    </section>
    <div className="field-visuals">
      <div className="ndvi-card">
        <div className="visual-heading">
          <span>{copy.vegetation.title}</span>
          <Help label={copy.vegetation.title} text={copy.help.vegetation} />
        </div>
        {data.ndvi.zone === undefined && <strong className="ndvi-headline">{data.ndvi.label}</strong>}
        {data.ndvi.zone !== undefined && <ZoneBar zone={data.ndvi.zone} labels={copy.vegetation.descriptions.map(describe => describe((data.ndvi.date ?? data.lastObservation).split(' de ')[0]!))} />}
        <p>{copy.vegetation.note}</p>
        {data.ndvi.value !== null && <details>
          <summary>{copy.exact.title}</summary>
          <p>{copy.exact.value(String(data.ndvi.value), data.ndvi.date ?? data.lastObservation)}</p>
          <p className="muted">{copy.exact.technical} NDVI</p>
          <p>{data.ndvi.source ?? 'Fuente no informada'} · {data.ndvi.resolution ?? 'Escala no informada'} · origen: {data.origin}</p>
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

    <div className="indicators">
      {data.observations.filter(item => parcel.dataState !== 'error' || item.variable !== 'GWETROOT').map((observation, i) => {
        const Icon = icons[i] ?? Sprout;
        return <article className="indicator" key={observation.variable}>
        <div className="indicator-heading">
          <span><Icon size={19} /><span className="indicator-title">{observation.label}{observation.variable !== 'GWETROOT' && <Help label={copy.charts.normal} text={copy.help.normal} />}</span></span>
          <div className="indicator-value"><strong>{observation.value}</strong>{observation.variable === 'T2M_MAX' && <small>{copy.heat.note}</small>}</div>
        </div>
        {observation.zone !== undefined && <ZoneBar zone={observation.zone} labels={copy.moisture.zones} />}
        {observation.zone === undefined && <p className={`indicator-status ${observation.tone === 'good' ? 'good-text' : observation.tone === 'warning' ? 'warning-text' : 'muted'}`}>{observation.tone === 'warning' ? <TriangleAlert size={15} /> : observation.tone === 'good' ? <CheckCircle2 size={15} /> : null}{observation.status}</p>}
        <p>{observation.consequence}</p>
        <details>
          <summary>{copy.exact.title}</summary>
          <dl><div><dt>Valor</dt><dd>{observation.rawValue ?? observation.value}</dd></div><div><dt>Fuente</dt><dd>{observation.source}</dd></div><div><dt>Fecha</dt><dd>{observation.date}</dd></div><div><dt>Resolución</dt><dd>{observation.resolution ?? 'No informada'}</dd></div><div><dt>Origen</dt><dd>{data.origin}</dd></div></dl>
          <p className="muted">{copy.exact.technical} {observation.variable}</p>
        </details>
      </article>;
      })}
    </div>
    <Link className="next-decision" href={parcelUrl(parcel.id, 'sembrar', parcel.zoneId)}><div>
        <Sprout size={22} />
        <span><strong>Prepara el siguiente ciclo</strong><small>Compara qué sembrar y cuándo cambiar.</small></span>
      </div><ArrowUpRight size={22} /></Link>
    {data.warnings.length > 0 && <p className="status-source">{data.warnings.join(' · ')}</p>}
    <p className="status-source">{mock ? <>Datos de ejemplo basados en escenarios ilustrativos.<br /></> : null}POWER representa contexto regional; el FC28 mide un punto de suelo. La fecha de consulta no es la fecha de la observación.{data.fetchedAt && <> Consulta de fuentes: {new Date(data.fetchedAt).toLocaleString('es-MX')}.</>}</p>
  </div>;
}
function MapCross() {
  return <span className="satellite-cross" aria-hidden="true"><i /><i /></span>;
}

function Help({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <span className="indicator-help"><button type="button" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>?</button><span id={id} hidden={!open}>{text}</span></span>;
}
function ZoneBar({ zone, labels }: { zone: number; labels: readonly string[] }) {
  return <div className="zone-bar" role="img" aria-label={labels[zone]}>
    <div className="zone-track" aria-hidden="true">{labels.map((label, index) => <span key={label} className={`zone-${index}${index === zone ? ' selected' : ''}`} />)}</div>
    <span>{labels[zone]}</span>
  </div>;
}

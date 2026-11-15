'use client';

import { parcelTabs, parcelUrl, resolveParcelTab } from './parcel-tabs';
import { Suspense, useState } from 'react';
import { SheetHandle } from '@/shared/components/sheet-handle';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, X, MapPin, Download, RefreshCw } from 'lucide-react';
import { useDemo } from '@/features/identity/demo-provider';
import { FieldMap } from '@/shared/components/field-map';
import { useMocks } from '@/shared/api/client';
import { EmptyState, LoadingState, Notice } from '@/shared/components/ui';
import { FieldStatus } from '@/features/nasa/field-status';
import { FieldCharts } from '@/features/nasa/field-charts';
import { Recommendations } from '@/features/rotation/recommendations';
export function ParcelDetail({
  id
}: {
  id: string;
}) {
  return <Suspense fallback={<LoadingState />}><Detail id={id} /></Suspense>;
}
function Detail({
  id
}: {
  id: string;
}) {
  const {
    parcels,
    updateParcel
  } = useDemo();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const parcel = parcels.find(item => item.id === id);
  const tab = resolveParcelTab(search.get('tab'));
  if (!parcel) return <main id="main" className="not-found">
    <EmptyState title="No encontramos esta parcela"><p>Elige una parcela de tu perfil para continuar.</p><Link className="button primary" href="/parcelas">Volver a mis parcelas</Link></EmptyState>
  </main>;
  function loadData() {
    if (!parcel) return;
    setLoading(true);
    window.setTimeout(() => {
      updateParcel({
        ...parcel,
        dataState: 'ready'
      });
      setLoading(false);
    }, 900);
  }
  const wide = tab === 'datos' || tab === 'sembrar';
  return <main id="main" className={`map-workspace detail-workspace ${wide ? 'wide-workspace' : ''}`}>
    <FieldMap parcels={parcels} selectedId={parcel.id} ndvi={useMocks && tab === 'estado' && parcel.dataState !== 'empty'} />
    <section className={`detail-panel ${wide ? 'wide-panel' : ''} ${expanded ? 'sheet-expanded' : ''}`}>
      <SheetHandle expanded={expanded} onChange={setExpanded} />
      <header className="detail-heading">
        <div className="detail-back">
          <Link href="/parcelas" className="back-link"><ArrowLeft size={15} />Mis parcelas</Link>
          <Link href="/parcelas" className="icon-button" aria-label="Cerrar parcela"><X size={19} /></Link>
        </div>
        <div className="detail-title">
          <h1>{parcel.name}</h1>
          <span className="heading-crop"><span>Cultivo actual</span><strong className="crop-chip">{parcel.crop}</strong></span>
        </div>
        {parcel.place !== `${parcel.latitude.toFixed(3)}, ${parcel.longitude.toFixed(3)}` && <p className="detail-location"><MapPin size={15} />{parcel.place}</p>}
        <dl className="detail-meta">
          <div><dt>Superficie</dt><dd>{parcel.area ? `${parcel.area} hectáreas` : 'Parcela por punto'}</dd></div>
          <div><dt>Riego</dt><dd>{parcel.irrigation ? 'Con riego' : 'De temporal'}</dd></div>
          <div><dt>Coordenadas</dt><dd>{parcel.latitude.toFixed(3)}, {parcel.longitude.toFixed(3)}</dd></div>
        </dl>
      </header>
      <nav className="tabs" aria-label="Secciones de la parcela">
        {parcelTabs.map(item => <Link key={item.key} aria-current={tab === item.key ? 'page' : undefined} href={parcelUrl(id, item.key)} className={tab === item.key ? 'selected' : ''}>{item.label}</Link>)}
      </nav>
      <div className="detail-scroll">
        {loading ? <LoadingState /> : parcel.dataState === 'empty' ? <EmptyState title="Conozcamos este campo"><p>Aún no hay datos NASA para esta parcela. Carga un escenario de ejemplo para explorar sus indicadores y opciones.</p><button className="button primary" onClick={loadData}><Download size={17} />Cargar datos de ejemplo</button><small>No se consultará la API de NASA en esta demo.</small></EmptyState> : <>{parcel.dataState === 'error' && <Notice variant="warning" label="AVISO · SUELO" title="Falta la humedad del suelo" error><p><strong>1 indicador no disponible.</strong> La fuente no respondió en este escenario. Puedes consultar el resto; la confianza es baja.</p><button className="text-button" onClick={loadData}><RefreshCw size={14} />Reintentar con datos de ejemplo</button></Notice>}{tab === 'datos' ? <FieldCharts parcel={parcel} /> : tab === 'sembrar' ? <Recommendations parcel={parcel} /> : <FieldStatus parcel={parcel} />}</>}
      </div>
    </section>
    <div className="map-context">
      <span className="source-dot" />
      <span>{useMocks && tab === 'estado' && parcel.dataState !== 'empty' ? 'NDVI · capa ilustrativa' : 'Ubicación de tu parcela'}</span>
    </div>
  </main>;
}

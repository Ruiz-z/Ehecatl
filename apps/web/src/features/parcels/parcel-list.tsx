'use client';

import { useState } from 'react';
import { SheetHandle } from '@/shared/components/sheet-handle';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, ArrowUpRight, MapPin, Droplets, ChevronLeft, PanelLeftClose } from 'lucide-react';
import { useDemo } from '@/features/identity/demo-provider';
import { FieldMap } from '@/shared/components/field-map';
import { EmptyState } from '@/shared/components/ui';
export function ParcelList() {
  const {
    parcels
  } = useDemo();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const filtered = parcels.filter(parcel => `${parcel.name} ${parcel.place} ${parcel.crop}`.toLowerCase().includes(query.toLowerCase()));
  return <main id="main" className="map-workspace">
    <FieldMap parcels={parcels} onSelect={id => router.push(`/parcelas/${id}`)} />
    <section className={`side-panel list-panel ${collapsed ? 'collapsed' : ''} ${expanded ? 'sheet-expanded' : ''}`}>
      <SheetHandle expanded={expanded} onChange={setExpanded} />
      <div className="panel-heading">
        <div>
          <h1>Mis parcelas<span className="count">{parcels.length}</span></h1>
          <p>Ubicaciones y condiciones de tus campos.</p>
        </div>
        <button className="icon-button collapse-button" aria-label="Ocultar lista" onClick={() => setCollapsed(true)}><PanelLeftClose size={19} /></button>
      </div>
      <Link className="button primary add-parcel" href="/parcelas/nueva"><Plus size={18} />Agregar parcela</Link>
      <label className="search-field">
        <Search size={18} />
        <span className="sr-only">Buscar parcelas</span>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nombre o cultivo" />
      </label>
      <div className="list-caption">
        {`${filtered.length} ${filtered.length === 1 ? 'parcela' : 'parcelas'}`}

      </div>
      <div className="parcel-list">
        {filtered.map(parcel => <Link key={parcel.id} href={`/parcelas/${parcel.id}`} className="parcel-row"><div className="parcel-row-top">
            <span className="field-symbol"><MapPin size={23} strokeWidth={1.5} /></span>
            <ArrowUpRight size={18} />
          </div><h2>{parcel.name}</h2><p>{parcel.place}</p><div className="parcel-meta">
            <span>{parcel.crop}</span>
            <span>{parcel.area ? `${parcel.area} ha` : 'Punto de parcela'}</span>
            <span><Droplets size={12} />{parcel.irrigation ? 'Riego' : 'Temporal'}</span>
          </div><span className={`chip ${parcel.dataState === 'empty' ? 'neutral-chip' : parcel.risk === 'high' ? 'risk-chip' : 'ok-chip'}`}>{parcel.dataState === 'empty' ? 'Sin datos NASA aún' : parcel.risk === 'high' ? 'Atención · poca agua' : parcel.risk === 'low' ? 'Condiciones favorables' : 'Vigilar condiciones'}</span></Link>)}
        {!filtered.length && <EmptyState title={query ? 'Sin coincidencias' : 'Tu próxima cosecha empieza aquí'}><p>{query ? 'Prueba con otro nombre o cultivo.' : 'Agrega tu primera parcela para conocer su contexto.'}</p>{query ? <button className="button" onClick={() => setQuery('')}>Limpiar búsqueda</button> : <Link className="button primary" href="/parcelas/nueva">Agregar parcela</Link>}</EmptyState>}
      </div>
      <footer className="panel-footnote"><span>NASA POWER · MODIS</span></footer>
    </section>
    {collapsed && <button className="button reopen-panel" onClick={() => setCollapsed(false)}><ChevronLeft size={18} />Mis parcelas</button>}
    <div className="map-context">
      <MapPin size={16} />
      <span>{parcels[0]?.place ?? 'Explora cualquier lugar del mundo'}</span>
    </div>
  </main>;
}

'use client';

import { demoClimateByOwner } from '@/features/identity/fixtures/users';
import { Droplets, Thermometer, Sprout, ArrowUpRight, TriangleAlert, CheckCircle2, Satellite } from 'lucide-react';
import Link from 'next/link';
import type { Parcel } from '@/features/parcels/types';
import { observationsFor } from './fixtures/observations';
const icons = [Droplets, Thermometer, Sprout];
export function FieldStatus({
  parcel
}: {
  parcel: Parcel;
}) {
  const humid = demoClimateByOwner[parcel.ownerId] === 'humid';
  return <div className="status-content">
    <div className="section-heading">
      <div>
        <h2>Así está tu campo</h2>
        <p>Última observación · 31 oct 2026</p>
      </div>
      <Satellite size={20} />
    </div>
    <div className="field-visuals">
      <div className="ndvi-card">
        <div className="visual-heading">
          <span>Verdor de la zona</span>
          <span className="chip neutral-chip">NDVI</span>
        </div>
        <strong>{humid ? '0.59' : '0.28'}</strong>
        <p>{humid ? 'Vegetación activa' : 'Actividad moderada'}</p>
        <div className="ndvi-scale">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="scale-labels">
          <span>Menos</span>
          <span>Más</span>
        </div>
        <small>MODIS · origen: mock</small>
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
      {observationsFor(parcel).filter(item => parcel.dataState !== 'error' || item.variable !== 'GWETROOT').map((observation, i) => {
        const Icon = icons[i];
        return <article className="indicator" key={observation.variable}>
        <div className="indicator-heading">
          <span><Icon size={19} />{observation.label}</span>
          <strong>{observation.value}</strong>
        </div>
        <p className={`indicator-status ${observation.tone === 'good' ? 'good-text' : 'warning-text'}`}>{observation.tone === 'good' ? <CheckCircle2 size={15} /> : <TriangleAlert size={15} />}{observation.status}</p>
        <p>{observation.consequence}</p>
        <details>
          <summary>Ver dato NASA</summary>
          <dl>
            <div>
              <dt>Variable</dt>
              <dd>{observation.variable}</dd>
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
              <dd>mock · datos de ejemplo</dd>
            </div>
          </dl>
        </details>
      </article>;
      })}
    </div>
    <Link className="next-decision" href={`/parcelas/${parcel.id}?tab=sembrar`}><div>
        <Sprout size={22} />
        <span><strong>Prepara el siguiente ciclo</strong><small>Compara qué sembrar y cuándo cambiar.</small></span>
      </div><ArrowUpRight size={22} /></Link>
    <p className="status-source">Datos de ejemplo basados en escenarios ilustrativos.<br />NASA POWER · MODIS / ORNL DAAC</p>
  </div>;
}
function MapCross() {
  return <span className="satellite-cross" aria-hidden="true"><i /><i /></span>;
}

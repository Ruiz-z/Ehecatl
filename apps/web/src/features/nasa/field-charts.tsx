'use client';

import { demoClimateByOwner } from '@/features/identity/fixtures/users';
import { useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Parcel } from '@/features/parcels/types';
import { seriesFor } from './fixtures/observations';
const metrics = [{
  key: 'rainfall',
  normal: 'rainfallNormal',
  title: 'Lluvia acumulada',
  unit: 'mm',
  color: 'var(--data-rain)',
  deviation: '38 % menos que lo normal',
  humid: 'Lluvia suficiente para el ciclo'
}, {
  key: 'temperature',
  normal: 'temperatureNormal',
  title: 'Temperatura del aire',
  unit: '°C',
  color: 'var(--data-temperature)',
  deviation: '2.1 °C más que lo normal',
  humid: 'Dentro del rango habitual'
}, {
  key: 'moisture',
  normal: 'moistureNormal',
  title: 'Humedad en raíz',
  unit: '%',
  color: 'var(--data-moisture)',
  deviation: 'Reserva de agua por debajo de lo normal',
  humid: 'Buena reserva de agua'
}, {
  key: 'ndvi',
  normal: 'ndviNormal',
  title: 'Verdor de la vegetación',
  unit: 'NDVI',
  color: 'var(--ndvi-high)',
  deviation: 'Menor actividad que lo normal',
  humid: 'Vegetación en crecimiento'
}];
export function FieldCharts({
  parcel
}: {
  parcel: Parcel;
}) {
  const [range, setRange] = useState('12');
  const all = seriesFor(parcel);
  const data = all.slice(-Number(range));
  return <div className="charts-section">
    <div className="section-heading">
      <div>
        <h2>El clima, con perspectiva</h2>
        <p>Compara este ciclo con el promedio de 10 años.</p>
      </div>
      <label className="range-label">
        <span className="sr-only">Rango de fechas</span>
        <select value={range} onChange={event => setRange(event.target.value)}><option value="12">Últimos 12 meses</option><option value="6">Últimos 6 meses</option></select>
      </label>
    </div>
    <div className="charts-grid">
      {metrics.filter(metric => parcel.dataState !== 'error' || metric.key !== 'moisture').map(metric => <section className="chart-card" key={metric.key}>
        <div className="chart-heading">
          <h3>{metric.title}</h3>
          <span>{metric.unit}</span>
        </div>
        <p className={demoClimateByOwner[parcel.ownerId] === 'humid' ? 'good-text' : 'warning-text'}>{demoClimateByOwner[parcel.ownerId] === 'humid' ? metric.humid : metric.deviation}</p>
        <div className="chart-legend">
          <span><i style={{
              background: metric.color
            }} />Este ciclo</span>
          <span><i className="normal-line" />Lo normal</span>
        </div>
        <div className="chart-frame" role="img" aria-label={`${metric.title}: ${demoClimateByOwner[parcel.ownerId] === 'humid' ? metric.humid : metric.deviation}. Comparación mensual con la media histórica.`}>
          <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{
              top: 8,
              right: 10,
              left: -24,
              bottom: 0
            }} accessibilityLayer><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{
                fill: 'var(--muted-foreground)',
                fontSize: 12
              }} minTickGap={18} /><YAxis tickLine={false} axisLine={false} tick={{
                fill: 'var(--muted-foreground)',
                fontSize: 12
              }} width={58} domain={[0, 'auto']} /><Tooltip contentStyle={{
                background: 'var(--foreground)',
                border: 'none',
                borderRadius: 8,
                color: 'var(--card)',
                fontSize: 12
              }} labelStyle={{
                color: 'var(--card)'
              }} formatter={(value, name) => [`${Number(value).toFixed(metric.key === 'ndvi' ? 2 : 1)} ${metric.unit}`, name]} />{metric.key === 'rainfall' ? <Area isAnimationActive={false} type="monotone" dataKey={metric.key} name="Este ciclo" fill={metric.color} fillOpacity={0.2} stroke={metric.color} strokeWidth={2} /> : <Line isAnimationActive={false} type="monotone" dataKey={metric.key} name="Este ciclo" stroke={metric.color} strokeWidth={2.5} dot={{
                r: 2
              }} />}<Line isAnimationActive={false} type="monotone" dataKey={metric.normal} name="Lo normal (10 años)" stroke="var(--data-normal)" strokeDasharray="5 4" dot={false} strokeWidth={2} /></ComposedChart></ResponsiveContainer>
        </div>
        <p className="chart-source">{metric.key === 'ndvi' ? 'MODIS / ORNL DAAC' : 'NASA POWER'} · {range === '12' ? 'nov 2025' : 'may 2026'} – oct 2026 · origen: mock</p>
        <details className="chart-table">
          <summary>Ver valores en tabla</summary>
          <table>
            <caption>{metric.title} ({metric.unit})</caption>
            <thead>
              <tr>
                <th>Mes</th>
                <th>Este ciclo</th>
                <th>Lo normal</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => <tr key={row.month}>
                <th>{row.month}</th>
                <td>{Number(row[metric.key as keyof typeof row]).toFixed(metric.key === 'ndvi' ? 2 : 1)}</td>
                <td>{Number(row[metric.normal as keyof typeof row]).toFixed(metric.key === 'ndvi' ? 2 : 1)}</td>
              </tr>)}
            </tbody>
          </table>
        </details>
      </section>)}
    </div>
  </div>;
}

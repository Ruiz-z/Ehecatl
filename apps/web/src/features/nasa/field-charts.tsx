'use client';

import { copy } from './copy';
import { useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Parcel } from '@/features/parcels/types';
import { apiClient, useMocks } from '@/shared/api/client';
import { waitingNote } from '@/shared/api/messages';
import { useAsync } from '@/shared/api/use-async';
import type { Indicators } from '@/shared/api/types';
import { EmptyState, LoadingState } from '@/shared/components/ui';
const metrics = [{
  key: 'rainfall',
  normal: 'rainfallNormal',
  title: copy.charts.rain,
  unit: 'mm',
  color: 'var(--foreground)'
}, {
  key: 'temperature',
  normal: 'temperatureNormal',
  title: copy.charts.heat,
  unit: '°C',
  color: 'var(--foreground)'
}, {
  key: 'moisture',
  normal: 'moistureNormal',
  title: copy.moisture.title,
  unit: '%',
  color: 'var(--foreground)'
}, {
  key: 'ndvi',
  normal: 'ndviNormal',
  title: copy.vegetation.title,
  unit: '',
  color: 'var(--foreground)'
}];
export function FieldCharts({
  parcel
}: {
  parcel: Parcel;
}) {
  const state = useAsync(() => apiClient.getIndicators(parcel), parcel.id);
  if (state.status === 'loading') return <LoadingState note={useMocks ? undefined : waitingNote} />;
  if (state.status === 'error') return <EmptyState title="No pudimos cargar el historial"><p>{state.message}</p><button className="button primary" onClick={state.retry}>Reintentar</button></EmptyState>;
  return <Charts parcel={parcel} indicators={state.data} />;
}
function Charts({
  parcel,
  indicators
}: {
  parcel: Parcel;
  indicators: Indicators;
}) {
  const [range, setRange] = useState('12');
  const data = indicators.series.slice(-Number(range));
  return <div className="charts-section">
    <div className="section-heading">
      <div>
        <h2>Historial del clima</h2>
        <p>Compara este ciclo con el promedio de 10 años.</p>
      </div>
      <label className="range-label">
        <span className="sr-only">Rango de fechas</span>
        <select value={range} onChange={event => setRange(event.target.value)}><option value="12">Últimos 12 meses</option><option value="6">Últimos 6 meses</option></select>
      </label>
    </div>
    <div className="charts-grid">
      {metrics.filter(metric => (parcel.dataState !== 'error' || metric.key !== 'moisture') && data.some(row => row[metric.key as keyof typeof row] !== null)).map(metric => {
        const summary = indicators.summaries[metric.key as keyof typeof indicators.summaries];
        return <section className="chart-card" key={metric.key}>
        <div className="chart-heading">
          <h3>{metric.title}</h3>
          <span>{metric.unit}</span>
        </div>
        {summary && <p className={summary.tone === 'good' ? 'good-text' : summary.tone === 'warning' ? 'warning-text' : 'muted'}>{summary.text}</p>}
        <div className="chart-legend">
          <span><i style={{
              background: metric.color
            }} />{copy.charts.current}</span>
          <span><i className="normal-line" />{copy.charts.normal}</span>
        </div>
        <div className="chart-frame" role="img" aria-label={`${metric.title}${summary ? `: ${summary.text}` : ''}. Comparación mensual con la media histórica.`}>
          <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{
              top: 8,
              right: 10,
              left: -24,
              bottom: 0
            }} accessibilityLayer><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{
                fill: 'var(--muted-foreground)',
                fontSize: 13
              }} ticks={data.filter((_, index) => index % Math.ceil(data.length / 6) === 0).map(row => row.month)} tickFormatter={value => String(value).slice(0, 3)} interval={0} minTickGap={8} /><YAxis tickLine={false} axisLine={false} tick={{
                fill: 'var(--muted-foreground)',
                fontSize: 13
              }} width={58} domain={[0, 'auto']} /><Tooltip itemStyle={{ color: 'var(--card)' }} contentStyle={{
                background: 'var(--foreground)',
                border: 'none',
                borderRadius: 8,
                color: 'var(--card)',
                fontSize: 13
              }} labelStyle={{
                color: 'var(--card)'
              }} formatter={(value, name) => [`${Number(value).toFixed(metric.key === 'ndvi' ? 2 : 1)} ${metric.unit}`, name]} />{metric.key === 'rainfall' ? <Area isAnimationActive={false} type="monotone" dataKey={metric.key} name={copy.charts.current} fill={metric.color} fillOpacity={0.2} stroke={metric.color} strokeWidth={2} /> : <Line isAnimationActive={false} type="monotone" dataKey={metric.key} name={copy.charts.current} stroke={metric.color} strokeWidth={2.5} dot={{
                r: 2
              }} />}<Line isAnimationActive={false} type="monotone" dataKey={metric.normal} name={copy.charts.normal} stroke="var(--data-normal)" strokeDasharray="5 4" dot={false} strokeWidth={2} /></ComposedChart></ResponsiveContainer>
        </div>
        <p className="chart-source">{metric.key === 'ndvi' ? 'MODIS / ORNL DAAC' : 'NASA POWER'} · {indicators.periodLabel} · origen: {indicators.origin}</p>
        <details className="chart-table">
          <summary>Ver valores en tabla</summary>
          <table>
            <caption>{metric.title} ({metric.unit})</caption>
            <thead>
              <tr>
                <th>Mes</th>
                <th>{copy.charts.current}</th>
                <th>{copy.charts.normal}</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => <tr key={row.month}>
                <th>{row.month}</th>
                <td>{cell(row[metric.key as keyof typeof row], metric.key)}</td>
                <td>{cell(row[metric.normal as keyof typeof row], metric.key)}</td>
              </tr>)}
            </tbody>
          </table>
        </details>
      </section>;
      })}
    </div>
  </div>;
}
function cell(value: string | number | null, key: string) {
  return typeof value === 'number' ? value.toFixed(key === 'ndvi' ? 2 : 1) : '';
}

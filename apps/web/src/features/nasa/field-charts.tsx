'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { copy, calendarCopy } from './copy';
import { buildYearCalendar, monthName, type CalendarCell, type CalendarKey } from './calendar';
import type { Parcel } from '@/features/parcels/types';
import { apiClient, useMocks } from '@/shared/api/client';
import { waitingNote } from '@/shared/api/messages';
import { formatDate } from '@/shared/api/adapters';
import { useAsync } from '@/shared/api/use-async';
import type { Indicators } from '@/shared/api/types';
import { EmptyState, LoadingState } from '@/shared/components/ui';

export function FieldCharts({ parcel }: { parcel: Parcel }) {
  const state = useAsync(() => apiClient.getIndicators(parcel), parcel.zoneId ?? parcel.id);
  if (state.status === 'loading') return <LoadingState note={useMocks ? undefined : waitingNote} />;
  if (state.status === 'error') return <EmptyState title="No pudimos cargar el historial"><p>{state.message}</p><button className="button primary" onClick={state.retry}>Reintentar</button></EmptyState>;
  return <Charts indicators={state.data} />;
}
function Charts({ indicators }: { indicators: Indicators }) {
  const [selected, setSelected] = useState<CalendarKey>('rainfall');
  const rows = buildYearCalendar(indicators.series, indicators.windows);
  const detail = rows.find(row => row.key === selected)!;
  const data = indicators.series.slice(-12);
  const unit = selected === 'rainfall' ? 'mm' : selected === 'temperature' ? '°C' : selected === 'moisture' ? '%' : '';
  const lastClimate = data.filter(point => point.rainfall !== null || point.temperature !== null).at(-1)?.date;
  const pending = data.filter(point => (!lastClimate || point.date > lastClimate) && point.rainfall === null && point.temperature === null);
  return <div className="charts-section">
    <div className="section-heading"><div><h2>{calendarCopy.title}</h2><p>{calendarCopy.subtitle}</p></div></div>
    <div className="year-calendar-scroll" tabIndex={0} role="region" aria-label={calendarCopy.title}>
      <table className="year-calendar">
        <caption className="sr-only">{calendarCopy.title}</caption>
        <thead><tr><th scope="col"><span className="sr-only">{calendarCopy.title}</span></th>{data.map(point => <th scope="col" key={point.date} title={monthName(point.date)}>{point.month}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.key}><th scope="row"><button type="button" aria-pressed={selected === row.key} aria-controls="year-detail" onClick={() => setSelected(row.key)}>{row.title}</button></th>{row.cells.map(cell => <td key={cell.date}><CalendarTile cell={cell} kind={row.key} /></td>)}</tr>)}</tbody>
      </table>
    </div>
    {pending.map(point => <p key={point.date}>{calendarCopy.pending(monthName(point.date))}</p>)}
    <section id="year-detail" className="chart-card" aria-labelledby="year-detail-title">
      <h3 id="year-detail-title">{detail.title}</h3>
      {detail.total && <p>{detail.total}</p>}
      {detail.summary && <p>{detail.summary}</p>}
      {(selected === 'rainfall' || selected === 'temperature') ? <>
        <div className="chart-legend"><span><i className={selected === 'rainfall' ? 'current-bar' : 'current-line'} />{copy.charts.current}</span><span><i className={selected === 'rainfall' ? 'normal-dot' : 'normal-line'} />{copy.charts.normal}</span></div>
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            {selected === 'rainfall' ? <BarChart data={data} accessibilityLayer margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis width={76} tick={{ fontSize: 13 }} unit=" mm" tickLine={false} axisLine={false} />
              <Tooltip formatter={value => typeof value === 'number' ? `${Number(value.toFixed(1))} ${unit}` : value} /><Bar dataKey="rainfall" name={copy.charts.current} fill="var(--data-rain)" isAnimationActive={false} />
              {data.filter(point => point.rainfallNormal !== null).map(point => <ReferenceDot key={point.date} x={point.month} y={point.rainfallNormal!} ifOverflow="extendDomain" r={5} fill="var(--card)" stroke="var(--foreground)" strokeWidth={2} />)}
            </BarChart> : <LineChart data={data} accessibilityLayer margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis width={76} tick={{ fontSize: 13 }} domain={[(min: number) => Math.floor(min - 2), (max: number) => Math.ceil(max + 2)]} allowDecimals={false} unit=" °C" tickLine={false} axisLine={false} />
              <Tooltip formatter={value => typeof value === 'number' ? `${Number(value.toFixed(1))} ${unit}` : value} /><Line dataKey="temperature" name={copy.charts.current} stroke="var(--data-temperature)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              <Line dataKey="temperatureNormal" name={copy.charts.normal} stroke="var(--data-normal)" strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            </LineChart>}
          </ResponsiveContainer>
        </div>
      </> : <div className="year-detail-strip">{detail.cells.map(cell => <div key={cell.date}><span>{cell.month}</span><CalendarTile cell={cell} kind={selected} /><span>{selected === 'sowing' ? cell.label : formatValue(cell.value, unit)}</span></div>)}</div>}
      <details className="chart-table"><summary>Ver valores en tabla</summary>
        <table><caption>{detail.title}{unit ? ` (${unit})` : ''}</caption><thead><tr><th scope="col">Mes</th><th scope="col">{copy.charts.current}</th>{selected !== 'sowing' && <th scope="col">{copy.charts.normal}</th>}</tr></thead>
          <tbody>{detail.cells.map(cell => <tr key={cell.date}><th scope="row">{cell.month}</th><td>{selected === 'sowing' ? cell.label : formatValue(cell.value, unit)}</td>{selected !== 'sowing' && <td>{formatValue(cell.normal, unit)}</td>}</tr>)}</tbody>
        </table>
      </details>
    </section>
    {selected !== 'sowing' && <p className="chart-source">{indicators.metadata?.[selected]?.sources.join(' · ') || 'Fuente no informada'} · {indicators.metadata?.[selected]?.resolutions.join(' · ') || 'Resolución no informada'} · origen: {indicators.origin}</p>}
    {indicators.origin === 'mock' && <p>Datos de ejemplo</p>}
    <p className="chart-source">{calendarCopy.footer(formatDate(indicators.period.start), formatDate(indicators.period.end))}</p>
  </div>;
}
function CalendarTile({ cell, kind }: { cell: CalendarCell; kind: CalendarKey }) {
  return <span className={`calendar-tile ${cell.zone === null ? 'calendar-missing' : `calendar-${kind}-${cell.zone}`}`} title={cell.description} aria-label={cell.description}>{cell.label}</span>;
}
function formatValue(value: number | null, unit: string) {
  return value === null ? calendarCopy.missing : `${Number(value.toFixed(unit ? 1 : 3))}${unit ? ` ${unit}` : ''}`;
}

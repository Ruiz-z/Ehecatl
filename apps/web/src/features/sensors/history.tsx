'use client';
import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { sensorsApi, type Device, type ReadingPage } from './api';
import { freshness, primaryDevice } from './summary';

export function History({ zoneId, initial, devices, days, setDays, now }: { zoneId: string; initial: ReadingPage; devices: Device[]; days: string; setDays: (days: string) => void; now: number }) {
  const [older, setOlder] = useState<ReadingPage | null>(null);
  const rows = [...initial.items, ...(older?.items ?? [])].filter((row, index, all) => all.findIndex(item => item.id === row.id) === index);
  const page = older ?? initial;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState('soil');
  const device = primaryDevice(devices);
  const chart = rows.filter(row => row.deviceId === device?.id).slice().reverse().map(row => ({ time: new Date(row.measuredAt).toLocaleString('es-MX'), measurement: metric === 'soil' ? row.soilMoisture === null ? null : row.soilMoisture * 100 : metric === 'temperature' ? row.airTemperature : row.airHumidity }));
  const hasData = chart.some(row => row.measurement !== null);
  return <section className="sensor-history"><h3>Historial de mediciones</h3>
    <div className="sensor-chips" role="group" aria-label="Periodo">{[['1', 'Hoy'], ['7', '7 días'], ['30', '30 días']].map(([id, label]) => <button className="button" aria-pressed={days === id} key={id} onClick={() => setDays(id)}>{label}</button>)}</div>
    <div className="sensor-chips" role="group" aria-label="Medición">{[['soil', 'Tierra'], ['temperature', 'Temperatura'], ['humidity', 'Humedad del aire']].map(([id, label]) => <button className="button" aria-pressed={metric === id} key={id} onClick={() => setMetric(id)}>{label}</button>)}</div>
    {device?.origin === 'SIMULATED' && <p>Datos de ejemplo</p>}
    {hasData ? <div className="chart-frame" role="img" aria-label={`Historial de ${metric === 'soil' ? 'tierra en porcentaje' : metric === 'temperature' ? 'temperatura en grados Celsius' : 'humedad del aire en porcentaje'}`}><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="time" hide /><YAxis /><Tooltip /><Line dataKey="measurement" name="Medición" stroke="var(--foreground)" connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div> : <p>{metric === 'soil' && device && (device.dryRaw === null || device.wetRaw === null) ? 'Para ver la tierra en porcentaje hay que calibrar el sensor.' : 'Todavía no hay datos de esta medición en el periodo.'}</p>}
    <details><summary>Ver todas las lecturas</summary>
      {!rows.length && <p>No hay lecturas en este periodo.</p>}
      {rows.map(row => <article className="sensor-reading" key={row.id}><p>{freshness(row.measuredAt, now)} · {devices.find(d => d.id === row.deviceId)?.name ?? 'Sensor anterior'}{row.origin === 'SIMULATED' ? ' · de ejemplo' : ''}</p><details><summary>Ver todos los datos</summary><dl><dt>Fecha</dt><dd>{new Date(row.measuredAt).toLocaleString('es-MX')}</dd><dt>ADC de tierra</dt><dd>{row.soilMoistureRaw ?? 'Sin dato'}</dd><dt>Índice relativo</dt><dd>{row.soilMoisture === null ? 'Sin calibración' : `${Math.round(row.soilMoisture * 100)} %`}</dd><dt>Aire</dt><dd>{row.airTemperature ?? 'Sin dato'} °C · {row.airHumidity ?? 'Sin dato'} %RH</dd><dt>MQ2 experimental</dt><dd>{row.mq2Raw ?? 'Sin dato'}</dd><dt>Calibración</dt><dd>v{row.calibrationVersion}</dd><dt>Origen</dt><dd>{row.origin === 'SIMULATED' ? 'de ejemplo' : 'Campo'}</dd></dl></details></article>)}
      {error && <p role="alert">{error}</p>}
      {page.nextCursor && <button className="button" disabled={pending} onClick={async () => {
        setPending(true); setError('');
        try { const next = await sensorsApi.readings(zoneId, { from: page.from, to: page.to, cursor: page.nextCursor! }); setOlder(old => ({ ...next, items: [...(old?.items ?? []), ...next.items] })); }
        catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar.'); } finally { setPending(false); }
      }}>Ver lecturas anteriores</button>}
    </details>
  </section>;
}

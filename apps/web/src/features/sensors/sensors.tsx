'use client';
import { useState, type FormEvent } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Parcel } from '@/features/parcels/types';
import { useDemo } from '@/features/identity/demo-provider';
import { useMocks } from '@/shared/api/client';
import { useAsync } from '@/shared/api/use-async';
import { EmptyState, LoadingState, Notice } from '@/shared/components/ui';
import { Irrigation } from './irrigation';
import { sensorsApi, type Device, type DeviceConfig, type IssuedKey, type Reading, type ReadingPage } from './api';

const date = (value: string | null) => value ? new Date(value).toLocaleString('es-MX') : 'Sin lecturas';
const value = (number: number | null, suffix = '') => number === null ? 'Sin dato' : `${Number(number.toFixed(2))}${suffix}`;
function config(form: HTMLFormElement): DeviceConfig {
  const data = new FormData(form);
  const optional = (key: string) => String(data.get(key) ?? '').trim() === '' ? null : Number(data.get(key));
  return { name: String(data.get('name') ?? ''), expectedIntervalSeconds: Number(data.get('expectedIntervalSeconds')),
    dryRaw: optional('dryRaw'), wetRaw: optional('wetRaw'), depthCm: optional('depthCm') };
}
function ConfigFields({ device }: { device?: Device }) {
  return <>
    <label>Nombre<input name="name" required maxLength={200} defaultValue={device?.name ?? ''} placeholder="Nodo de la zona" /></label>
    <div className="sensor-fields">
      <label>Intervalo de envío (segundos)<input name="expectedIntervalSeconds" type="number" min={30} max={86400} required defaultValue={device?.expectedIntervalSeconds ?? 300} /></label>
      <label>Profundidad (cm, opcional)<input name="depthCm" type="number" min={0} max={200} step="any" defaultValue={device?.depthCm ?? ''} /></label>
      <label>ADC en seco (opcional)<input name="dryRaw" type="number" min={0} max={4095} defaultValue={device?.dryRaw ?? ''} /></label>
      <label>ADC en húmedo (opcional)<input name="wetRaw" type="number" min={0} max={4095} defaultValue={device?.wetRaw ?? ''} /></label>
    </div>
    <p className="form-note">Completa ambos valores de calibración o deja ambos vacíos. Usa mediciones del FC28 instalado; sin calibración se conserva el ADC.</p>
  </>;
}

export function Sensors({ parcel }: { parcel: Parcel }) {
  const { user } = useDemo();
  const [revision, setRevision] = useState(0);
  const [days, setDays] = useState('7');
  const [issued, setIssued] = useState<IssuedKey | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const state = useAsync(async () => {
    if (useMocks || !parcel.zoneId) return { devices: [] as Device[], page: { items: [], nextCursor: null, from: '', to: '' } as ReadingPage };
    const to = new Date().toISOString(), from = new Date(Date.now() - Number(days) * 86400000).toISOString();
    const [devices, page] = await Promise.all([sensorsApi.devices(parcel.zoneId), sensorsApi.readings(parcel.zoneId, { from, to })]);
    return { devices, page };
  }, `${parcel.zoneId}:${revision}:${days}`);
  if (useMocks) return <EmptyState title="Conecta la API para preparar tus sensores"><p>El modo de ejemplo no registra dispositivos ni presenta lecturas como mediciones reales.</p></EmptyState>;
  const refresh = () => setRevision(n => n + 1);
  async function perform(action: () => Promise<unknown>) {
    setPending(true); setError('');
    try { await action(); refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar.'); }
    finally { setPending(false); }
  }
  return <section className="sensor-panel">
    <div className="section-heading"><div><h2>Sensores de esta zona</h2><p>FC28 · DHT11 · MQ2 experimental</p></div><button className="button" disabled={pending} onClick={refresh}>Actualizar</button></div>
    <Notice variant="info" label="VERSIÓN BETA" title="Mediciones de campo"><p>Las lecturas complementan el contexto NASA. La comparación está pendiente; todavía no modifican la confianza de las recomendaciones. Versión beta. El riego es manual, el sistema nunca riega solo.</p></Notice>
    {issued && <div className="sensor-key" role="status"><strong>Clave de {issued.device.name} · copia y guarda ahora</strong><p>Se muestra una sola vez. Al cerrar este aviso no podrás volver a consultarla.</p><code>{issued.apiKey}</code><button className="button" onClick={() => setIssued(null)}>Ya guardé la clave</button></div>}
    {error && <p role="alert" className="error-text">{error}</p>}
    <Irrigation key={parcel.zoneId} zoneId={parcel.zoneId} devices={state.status === 'ready' ? state.data.devices : []} />
    <label>Periodo del historial<select value={days} onChange={event => setDays(event.target.value)}><option value="1">Últimas 24 horas</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option></select></label>
    {state.status === 'loading' ? <LoadingState /> : state.status === 'error' ? <EmptyState title="No pudimos consultar los sensores"><p>{state.message}</p><button className="button" onClick={state.retry}>Reintentar</button></EmptyState> : <>
      {!state.data.devices.length && <p>No hay dispositivos asignados a esta zona.{user?.role === 'admin' ? ' Puedes registrar uno abajo.' : ' Pide al administrador que registre tu dispositivo.'}</p>}
      {state.data.devices.map(device => <article className="sensor-device" key={`${device.id}:${device.calibrationVersion}:${device.zoneId}`}>
        <h3>{device.name}</h3>
        <p><span className={`chip ${device.origin === 'SIMULATED' ? 'warning-chip' : 'neutral-chip'}`}>{device.origin === 'SIMULATED' ? 'Datos de ejemplo · simulado' : 'Mediciones de campo'}</span> <strong>{device.connection === 'online' ? 'En línea' : device.connection === 'revoked' ? 'Revocado' : 'Sin señal'}</strong></p>
        <p>Última medición: {date(device.lastMeasuredAt)}<br />Última recepción: {date(device.lastReceivedAt)}</p>
        <p>{device.dryRaw === null ? 'Suelo sin calibrar: solo ADC' : `Calibración v${device.calibrationVersion}: seco ${device.dryRaw}, húmedo ${device.wetRaw}`} · Estado al actualizar</p>
        {user?.role === 'admin' && device.status === 'ACTIVE' && <details><summary>Administrar dispositivo</summary>
          <form onSubmit={event => { event.preventDefault(); const form = event.currentTarget; void perform(() => sensorsApi.update(device.id, { ...config(form), zoneId: String(new FormData(form).get('zoneId')) })); }}>
            <ConfigFields device={device} />
            <label>Zona<select name="zoneId" defaultValue={device.zoneId}>{(parcel.zones ?? []).map(zone => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
            <button className="button" disabled={pending}>Guardar configuración</button>
          </form>
          <div className="sensor-actions"><button className="button" disabled={pending} onClick={() => void perform(async () => setIssued(await sensorsApi.rotate(device.id)))}>Generar nueva clave</button><button className="button" disabled={pending} onClick={() => void perform(() => sensorsApi.revoke(device.id))}>Revocar dispositivo</button></div>
          <p className="form-note">Generar una nueva clave invalida la anterior. Revocar detiene la recepción sin borrar el historial.</p>
        </details>}
      </article>)}
      <History key={`${revision}:${days}`} zoneId={parcel.zoneId!} initial={state.data.page} devices={state.data.devices} />
    </>}
    {user?.role === 'admin' && <details className="sensor-device"><summary>Registrar dispositivo</summary><form onSubmit={(event: FormEvent<HTMLFormElement>) => {
      event.preventDefault(); const form = event.currentTarget;
      const origin = new FormData(form).get('origin') as Device['origin'];
      void perform(async () => { const next = await sensorsApi.create(parcel.zoneId!, { ...config(form), origin }); setIssued(next); form.reset(); });
    }}><ConfigFields /><label>Origen<select name="origin" defaultValue="SIMULATED"><option value="SIMULATED">Simulador · datos de ejemplo</option><option value="REAL">ESP32 real</option></select></label><p className="form-note">El origen no se puede cambiar después del registro.</p><button className="button primary" disabled={pending || !parcel.zoneId}>Registrar y generar clave</button></form></details>}
  </section>;
}

function History({ zoneId, initial, devices }: { zoneId: string; initial: ReadingPage; devices: Device[] }) {
  const [page, setPage] = useState(initial);
  const [rows, setRows] = useState<Reading[]>(initial.items);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState('soil');
  const [chartDevice, setChartDevice] = useState(initial.items[0]?.deviceId ?? '');
  if (!rows.length) return <div className="sensor-device"><h3>Sin mediciones en este periodo</h3><p>Cuando el ESP32 o el simulador envíe una lectura válida aparecerá aquí. No rellenamos el historial con ejemplos.</p></div>;
  const chart = rows.filter(row => row.deviceId === chartDevice).slice().reverse().map(row => ({ time: date(row.measuredAt),
    measurement: metric === 'soil' ? row.soilMoisture === null ? null : row.soilMoisture * 100 : metric === 'temperature' ? row.airTemperature : row.airHumidity,
    device: devices.find(d => d.id === row.deviceId)?.name ?? row.deviceId, origin: row.origin === 'SIMULATED' ? 'Datos de ejemplo' : 'Campo' }));
  return <div className="sensor-history"><h3>Historial de mediciones</h3>
    <label>Dispositivo en la gráfica<select value={chartDevice} onChange={event => setChartDevice(event.target.value)}>{[...new Set(rows.map(row => row.deviceId))].map(id => <option value={id} key={id}>{devices.find(d => d.id === id)?.name ?? 'Dispositivo reasignado'}{rows.find(row => row.deviceId === id)?.origin === 'SIMULATED' ? ' · datos de ejemplo' : ' · campo'}</option>)}</select></label>
    <label>Variable<select value={metric} onChange={event => setMetric(event.target.value)}><option value="soil">Índice relativo de suelo (%)</option><option value="temperature">Temperatura del aire (°C)</option><option value="humidity">Humedad del aire (%)</option></select></label>
    <div className="chart-frame" role="img" aria-label="Historial de la variable elegida, con origen indicado en la tabla">
      <ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="time" hide /><YAxis /><Tooltip formatter={(v, _name, item) => [v, `${item.payload.device} · ${item.payload.origin}`]} /><Line dataKey="measurement" name="Medición" stroke="var(--foreground)" connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
    </div>
    <p className="form-note">El índice del FC28 es relativo a su calibración; no equivale al porcentaje NASA. Huecos indican valores ausentes. La tabla conserva el origen de cada muestra.</p>
    <div className="sensor-table"><table><caption>Lecturas de la zona · fecha de medición y recepción</caption><thead><tr><th>Medición / recepción</th><th>Dispositivo / origen</th><th>Suelo</th><th>Aire</th><th>MQ2</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}>
      <td>{date(row.measuredAt)}<small>Recibida: {date(row.receivedAt)}</small></td><td>{devices.find(d => d.id === row.deviceId)?.name ?? 'Dispositivo reasignado'}<small>{row.origin === 'SIMULATED' ? 'Datos de ejemplo' : 'Campo'}</small></td>
      <td>ADC: {value(row.soilMoistureRaw)}<small>{row.soilMoisture === null ? 'Sin calibración' : `Índice: ${value(row.soilMoisture * 100, ' %')}`} · v{row.calibrationVersion}</small></td>
      <td>{value(row.airTemperature, ' °C')}<small>{value(row.airHumidity, ' %RH')}</small></td><td>{value(row.mq2Raw)}<small>ADC experimental</small></td>
    </tr>)}</tbody></table></div>
    {error && <p role="alert">{error}</p>}
    {page.nextCursor && <button className="button" disabled={pending} onClick={async () => {
      setPending(true); setError('');
      try { const next = await sensorsApi.readings(zoneId, { from: page.from, to: page.to, cursor: page.nextCursor! }); setRows(old => [...old, ...next.items]); setPage(next); }
      catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar.'); } finally { setPending(false); }
    }}>Ver lecturas anteriores</button>}
  </div>;
}

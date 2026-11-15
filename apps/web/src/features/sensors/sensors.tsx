'use client';
import { useEffect, useState } from 'react';
import type { Parcel } from '@/features/parcels/types';
import { useDemo } from '@/features/identity/demo-provider';
import { useMocks } from '@/shared/api/client';
import { EmptyState, LoadingState } from '@/shared/components/ui';
import { Irrigation } from './irrigation';
import { History } from './history';
import { AdminTools } from './admin-tools';
import { sensorsApi, type Device, type Reading, type ReadingPage } from './api';
import { connectionSentence, freshness, primaryDevice, soilState } from './summary';
import { sensorCopy } from './copy';

export function Sensors({ parcel }: { parcel: Parcel }) {
  return <SensorsPanel key={parcel.zoneId ?? parcel.id} parcel={parcel} />;
}
function SensorsPanel({ parcel }: { parcel: Parcel }) {
  const { user } = useDemo();
  const [revision, setRevision] = useState(0);
  const [days, setDays] = useState('7');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()); setRevision(n => n + 1); }, 30000);
    return () => clearInterval(timer);
  }, []);
  const [data, setData] = useState<{ devices: Device[]; page: ReadingPage; latest: Reading[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
    if (useMocks || !parcel.zoneId) return { devices: [] as Device[], page: { items: [], nextCursor: null, from: '', to: '' } as ReadingPage, latest: [] as Reading[] };
    const to = new Date().toISOString();
    const from = days === '1' ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString() : new Date(Date.now() - Number(days) * 86400000).toISOString();
    const devices = await sensorsApi.devices(parcel.zoneId);
    const [page, latest] = await Promise.all([sensorsApi.readings(parcel.zoneId, { from, to }), sensorsApi.readings(parcel.zoneId)]);
    return { devices, page, latest: latest.items };
    }
    void load().then(next => { if (active) { setData(next); setError(''); } }).catch(failure => { if (active) setError(failure instanceof Error ? failure.message : 'No se pudo consultar.'); });
    return () => { active = false; };
  }, [parcel.zoneId, revision, days]);
  if (useMocks) return <EmptyState title="Conecta la API para ver tus sensores"><p>El modo de ejemplo no registra dispositivos.</p></EmptyState>;
  return <section className="sensor-panel">
    <div className="section-heading"><h2>Sensores</h2><button className="button" onClick={() => { setNow(Date.now()); setRevision(n => n + 1); }}>Actualizar</button></div>
    {error && <p role="alert">{error}</p>}
    {!data ? error ? <EmptyState title="No pudimos consultar los sensores"><p>{error}</p><button className="button" onClick={() => setRevision(n => n + 1)}>Reintentar</button></EmptyState> : <LoadingState /> : <>
      <LiveSummary devices={data.devices} readings={data.latest} now={now} />
      <Irrigation now={now} key={parcel.zoneId} zoneId={parcel.zoneId} devices={error ? [] : data.devices} />
      <History key={`${parcel.zoneId}:${days}`} zoneId={parcel.zoneId!} initial={data.page} devices={data.devices} days={days} setDays={setDays} now={now} />
      {user?.role === 'admin' && <AdminTools now={now} parcel={parcel} devices={data.devices} readings={data.latest} refresh={() => setRevision(n => n + 1)} />}
    </>}
  </section>;
}

function LiveSummary({ devices, readings, now }: { devices: Device[]; readings: Reading[]; now: number }) {
  const device = primaryDevice(devices);
  const reading = readings.find(row => row.deviceId === device?.id);
  const calibrated = device && device.dryRaw !== null && device.wetRaw !== null;
  return <div className="sensor-live">
    <p className="sensor-connection"><span aria-hidden="true" className={`sensor-dot ${connectionSentence(device, now).includes('en línea') ? 'online' : ''}`} />{connectionSentence(device, now)}</p>
    {device?.origin === 'SIMULATED' && <p className="chip warning-chip">Datos de ejemplo</p>}
    {device && <><p className="form-note">{device.name}{reading ? ` · ${freshness(reading.measuredAt, now)}` : ''}</p><div className="sensor-metrics">
      <article><h3>Tierra</h3>{!calibrated ? <><p>{sensorCopy.calibration}</p><p className="form-note">{sensorCopy.calibrationHelp}</p></> : <><p className="sensor-number">{reading?.soilMoisture == null ? 'Sin dato' : `${Math.round(reading.soilMoisture * 100)} %`}</p><p>{soilState(reading?.soilMoisture ?? null)}</p></>}</article>
      <article><h3>Temperatura</h3><p className="sensor-number">{reading?.airTemperature == null ? 'Sin dato' : `${reading.airTemperature} °C`}</p><p>del aire</p></article>
      <article><h3>Humedad del aire</h3><p className="sensor-number">{reading?.airHumidity == null ? 'Sin dato' : `${reading.airHumidity} %`}</p></article>
    </div></>}
  </div>;
}

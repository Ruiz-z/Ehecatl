'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Parcel } from '@/features/parcels/types';
import { useDemo } from '@/features/identity/demo-provider';
import { useMocks } from '@/shared/api/client';
import { EmptyState, LoadingState } from '@/shared/components/ui';
import { Irrigation } from './irrigation';
import { History } from './history';
import { AdminTools } from './admin-tools';
import { sensorsApi, type Device, type Reading, type ReadingPage } from './api';
import { connectionSentence, freshness, primaryDevice, soilState } from './summary';
import { useLivePolling } from './live';
import { sensorCopy } from './copy';

export function Sensors({ parcel }: { parcel: Parcel }) {
  return <SensorsPanel key={parcel.zoneId ?? parcel.id} parcel={parcel} />;
}
function SensorsPanel({ parcel }: { parcel: Parcel }) {
  const { user } = useDemo();
  const received = useRef<string | null>(null);
  const [animate, setAnimate] = useState(false);
  const [days, setDays] = useState('7');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()); }, 10000);
    return () => clearInterval(timer);
  }, []);
  const [data, setData] = useState<{ devices: Device[]; page: ReadingPage; latest: Reading[] } | null>(null);
  const load = useCallback(async (signal: AbortSignal) => {
    if (useMocks || !parcel.zoneId) return;
    const to = new Date().toISOString();
    const from = days === '1' ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString() : new Date(Date.now() - Number(days) * 86400000).toISOString();
    const [devices, page, latest] = await Promise.all([
      sensorsApi.devices(parcel.zoneId, signal),
      sensorsApi.readings(parcel.zoneId, { from, to }, signal),
      sensorsApi.readings(parcel.zoneId, {}, signal),
    ]);
    if (signal.aborted) return;
    const selected = primaryDevice(devices);
    const readingId = latest.items.find(row => row.deviceId === selected?.id)?.id ?? null;
    setAnimate(received.current !== null && readingId !== received.current);
    received.current = readingId;
    setData(previous => ({ devices, latest: latest.items, page: {
      ...page,
      items: [...page.items, ...(previous?.page.items ?? [])].filter((row, index, all) =>
        Date.parse(row.measuredAt) >= Date.parse(from) && all.findIndex(item => item.id === row.id) === index),
    } }));
  }, [parcel.zoneId, days]);
  const { status, refresh } = useLivePolling(load, 5000);
  const disconnected = status === 'offline';
  const error = disconnected ? 'Sin conexión, reintentando' : '';
  if (useMocks) return <EmptyState title="Conecta la API para ver tus sensores"><p>El modo de ejemplo no registra dispositivos.</p></EmptyState>;
  return <section className="sensor-panel">
    <div className="section-heading"><h2>Sensores</h2><span className="sensor-live-status" role="status"><span aria-hidden="true" className={`sensor-dot ${status === 'live' ? 'online' : ''}`} />{status === 'paused' ? 'Pausado' : error || 'En vivo'}</span><button className="button" onClick={() => { setNow(Date.now()); refresh(); }}>Actualizar</button></div>

    {!data ? error ? <EmptyState title="No pudimos consultar los sensores"><p>{error}</p><button className="button" onClick={() => refresh()}>Reintentar</button></EmptyState> : <LoadingState /> : <>
      <LiveSummary devices={data.devices} readings={data.latest} now={now} animate={animate} />
      <Irrigation now={now} key={parcel.zoneId} zoneId={parcel.zoneId} devices={error ? [] : data.devices} />
      <History key={`${parcel.zoneId}:${days}`} zoneId={parcel.zoneId!} initial={data.page} devices={data.devices} days={days} setDays={setDays} now={now} />
      {user?.role === 'admin' && <AdminTools now={now} parcel={parcel} devices={data.devices} readings={data.latest} refresh={() => refresh()} />}
    </>}
  </section>;
}

function LiveSummary({ devices, readings, now, animate }: { devices: Device[]; readings: Reading[]; now: number; animate: boolean }) {
  const device = primaryDevice(devices);
  const reading = readings.find(row => row.deviceId === device?.id);
  const calibrated = device && device.dryRaw !== null && device.wetRaw !== null;
  return <div className="sensor-live">
    <p className="sensor-connection"><span aria-hidden="true" className={`sensor-dot ${connectionSentence(device, now).includes('en línea') ? 'online' : ''}`} />{connectionSentence(device, now)}</p>
    {device?.origin === 'SIMULATED' && <p className="chip warning-chip">Datos de ejemplo</p>}
    {device && <><p className="form-note">{device.name}{reading ? ` · ${freshness(reading.measuredAt, now)}` : ''}</p><div className={`sensor-metrics ${animate ? 'sensor-arrival' : ''}`} key={reading?.id}>
      <article><h3>Tierra</h3>{!calibrated ? <><p>{sensorCopy.calibration}</p><p className="form-note">{sensorCopy.calibrationHelp}</p></> : <><p className="sensor-number">{reading?.soilMoisture == null ? 'Sin dato' : `${Math.round(reading.soilMoisture * 100)} %`}</p><p>{soilState(reading?.soilMoisture ?? null)}</p></>}</article>
      <article><h3>Temperatura</h3><p className="sensor-number">{reading?.airTemperature == null ? 'Sin dato' : `${reading.airTemperature} °C`}</p><p>del aire</p></article>
      <article><h3>Humedad del aire</h3><p className="sensor-number">{reading?.airHumidity == null ? 'Sin dato' : `${reading.airHumidity} %`}</p></article>
    </div></>}
  </div>;
}

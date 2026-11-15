'use client';
import { useCallback, useEffect, useState } from 'react';
import { sensorsApi, type Device, type IrrigationCommand } from './api';

import { isOnline, lastIrrigation } from './summary';
import { useLivePolling } from './live';
import { sensorCopy } from './copy';

const statuses = { PENDING: 'Orden enviada', DELIVERED: 'Regando…', DONE: 'Terminó', FAILED: 'No se pudo regar', EXPIRED: 'No se pudo regar: la orden venció', CANCELLED: 'Orden cancelada' };

export function Irrigation({ zoneId, devices, now }: { now: number; zoneId?: string; devices: Device[] }) {
  const [duration, setDuration] = useState(20);
  const [confirming, setConfirming] = useState(false);
  const [commands, setCommands] = useState<IrrigationCommand[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const running = commands.some(command => command.status === 'PENDING' || command.status === 'DELIVERED');
  const [clock, setClock] = useState(now);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  const load = useCallback(async (signal: AbortSignal) => {
    if (!zoneId) return;
    const history = await sensorsApi.irrigationHistory(zoneId, signal);
    if (!signal.aborted) { setCommands(history); setClock(Date.now()); }
  }, [zoneId]);
  const { status, refresh } = useLivePolling(load, running ? 1000 : 5000);
  async function perform(action: () => Promise<unknown>) {
    setPending(true); setError('');
    try { await action(); refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo completar el riego.'); }
    finally { setPending(false); }
  }
  const online = devices.some(device => isOnline(device, now));
  const last = lastIrrigation(commands);
  const lastDate = last ? new Date(last.createdAt) : null;
  const lastLabel = lastDate ? `${lastDate.toDateString() === new Date(now).toDateString() ? 'hoy' : lastDate.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })} ${lastDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : '';
  const latest = commands.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  return <section className="sensor-device" aria-labelledby="manual-irrigation-title">
    <h3 id="manual-irrigation-title">Riego manual</h3>
    <p>{sensorCopy.beta}</p>
    <div className="sensor-chips" role="group" aria-label="Duración del riego">
      {[10, 20, 30].map(seconds => <button className="button" key={seconds} aria-pressed={duration === seconds} disabled={pending || confirming} onClick={() => setDuration(seconds)}>{seconds} s</button>)}
    </div>
    <button className="button primary" disabled={pending || !online} onClick={() => setConfirming(true)}>Regar ahora</button>
    {!online && <p>Para regar, espera a que tu sensor esté en línea.</p>}
    {confirming && <div role="group" aria-label="Confirmar riego">
      <p>Vas a regar {duration} s. La bomba se apaga sola.</p>
      <button className="button primary" disabled={pending || !online} onClick={() => void perform(async () => { await sensorsApi.water(zoneId!, duration); setConfirming(false); })}>Confirmar riego</button>
      <button className="button" disabled={pending} onClick={() => setConfirming(false)}>Volver</button>
    </div>}
    {(error || status === 'offline') && <p role="alert" className="error-text">{error || 'Sin conexión, reintentando'}</p>}
    <div aria-live="polite">{latest && <p>{statuses[latest.status]}{latest.status === 'DELIVERED' ? ` ${Math.max(0, latest.durationSeconds - Math.floor((clock - Date.parse(latest.deliveredAt ?? latest.createdAt)) / 1000))} s` : ''}{latest.status === 'DONE' ? `: ${latest.actualSeconds ?? latest.durationSeconds} s` : ''}{latest.origin === 'SIMULATED' ? ' · de ejemplo' : ''}</p>}</div>
    <p>{last ? `Último riego: ${lastLabel}, ${last.actualSeconds ?? last.durationSeconds} s${last.origin === 'SIMULATED' ? ' · de ejemplo' : ''}` : 'Todavía no hay riegos completados.'}</p>
    <details><summary>Ver historial</summary>
    <div aria-live="polite">
      {!commands.length && <p>Todavía no hay órdenes de riego.</p>}
      {commands.map(command => <div key={command.id}>
        <p>{new Date(command.createdAt).toLocaleString('es-MX')} · {command.requestedBy.name} · {command.origin === 'SIMULATED' ? 'de ejemplo' : 'Dispositivo real'}</p>
        <p>{statuses[command.status]} · {command.actualSeconds === null ? `${command.durationSeconds} s solicitados` : `${command.actualSeconds} s regados`}</p>
        {command.status === 'PENDING' && <button className="button" disabled={pending} onClick={() => void perform(() => sensorsApi.cancel(command.id))}>Cancelar orden</button>}
      </div>)}
    </div></details>
  </section>;
}

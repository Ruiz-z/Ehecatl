'use client';
import { useEffect, useState } from 'react';
import { sensorsApi, type Device, type IrrigationCommand } from './api';

const statuses = { PENDING: 'Enviada. Esperando al dispositivo', DELIVERED: 'Entregada. Esperando resultado del riego', DONE: 'Terminada', FAILED: 'Falló o se interrumpió', EXPIRED: 'Vencida', CANCELLED: 'Cancelada' };

export function Irrigation({ zoneId, devices }: { zoneId?: string; devices: Device[] }) {
  const [duration, setDuration] = useState(20);
  const [confirming, setConfirming] = useState(false);
  const [commands, setCommands] = useState<IrrigationCommand[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!zoneId) return;
    let active = true;
    const load = async () => {
      try { const history = await sensorsApi.irrigationHistory(zoneId); if (active) setCommands(history); }
      catch (failure) { if (active) setError(failure instanceof Error ? failure.message : 'No se pudo consultar el historial.'); }
    };
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => { active = false; clearInterval(timer); };
  }, [zoneId, revision]);
  async function perform(action: () => Promise<unknown>) {
    setPending(true); setError('');
    try { await action(); setRevision(n => n + 1); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo completar el riego.'); }
    finally { setPending(false); }
  }
  const online = devices.some(device => device.connection === 'online');
  return <section className="sensor-device" aria-labelledby="manual-irrigation-title">
    <h3 id="manual-irrigation-title">Riego manual</h3>
    <p>Versión beta. El riego es manual, el sistema nunca riega solo.</p>
    <label htmlFor="irrigation-duration">Duración</label>
    <select id="irrigation-duration" value={duration} disabled={pending || confirming} onChange={event => setDuration(Number(event.target.value))}>
      {[10, 20, 30].map(seconds => <option key={seconds} value={seconds}>{seconds} segundos</option>)}
    </select>
    <button className="button primary" disabled={pending || !online} onClick={() => setConfirming(true)}>Regar ahora</button>
    {!online && <p>No hay dispositivo en línea. Espera una lectura reciente y pulsa Actualizar para regar.</p>}
    {confirming && <div role="group" aria-label="Confirmar riego">
      <p>Vas a regar {duration} s. La bomba se apaga sola.</p>
      <button className="button primary" disabled={pending || !online} onClick={() => void perform(async () => { await sensorsApi.water(zoneId!, duration); setConfirming(false); })}>Confirmar riego</button>
      <button className="button" disabled={pending} onClick={() => setConfirming(false)}>Volver</button>
    </div>}
    {error && <p role="alert" className="error-text">{error}</p>}
    <h4>Historial de riegos</h4>
    <div aria-live="polite">
      {!commands.length && <p>Todavía no hay órdenes de riego.</p>}
      {commands.map(command => <div key={command.id}>
        <p>{new Date(command.createdAt).toLocaleString('es-MX')} · {command.requestedBy.name} · {command.origin === 'SIMULATED' ? 'Simulado' : 'Dispositivo real'}</p>
        <p>{statuses[command.status]} · {command.actualSeconds === null ? `${command.durationSeconds} s solicitados` : `${command.actualSeconds} s regados`}</p>
        {command.status === 'PENDING' && <button className="button" disabled={pending} onClick={() => void perform(() => sensorsApi.cancel(command.id))}>Cancelar orden</button>}
      </div>)}
    </div>
  </section>;
}

'use client';
import { useState } from 'react';
import { isOnline } from './summary';
import type { Parcel } from '@/features/parcels/types';
import { sensorsApi, type Device, type DeviceConfig, type IssuedKey, type Reading } from './api';
function config(form: HTMLFormElement): DeviceConfig {
  const data = new FormData(form);
  const optional = (key: string) => String(data.get(key) ?? '').trim() === '' ? null : Number(data.get(key));
  return { name: String(data.get('name') ?? ''), expectedIntervalSeconds: Number(data.get('expectedIntervalSeconds')),
    dryRaw: null, wetRaw: null, depthCm: optional('depthCm') };
}
function ConfigFields({ device }: { device?: Device }) {
  return <>
    <label>Nombre<input name="name" required maxLength={200} defaultValue={device?.name ?? ''} placeholder="Nodo de la zona" /></label>
    <div className="sensor-fields">
      <label>Intervalo de envío (segundos)<input name="expectedIntervalSeconds" type="number" min={30} max={86400} required defaultValue={device?.expectedIntervalSeconds ?? 300} /></label>
      <label>Profundidad (cm, opcional)<input name="depthCm" type="number" min={0} max={200} step="any" defaultValue={device?.depthCm ?? ''} /></label>
    </div>

  </>;
}


export function AdminTools({ parcel, devices, readings, refresh, now }: { now: number; parcel: Parcel; devices: Device[]; readings: Reading[]; refresh: () => void }) {
  const [issued, setIssued] = useState<IssuedKey | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function perform(action: () => Promise<unknown>) {
    setPending(true); setError('');
    try { await action(); refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar.'); }
    finally { setPending(false); }
  }
  return <details className="sensor-device"><summary>Administrar sensores</summary>
    {issued && <div className="sensor-key" role="status"><p>Clave de {issued.device.name}. Cópiala y guárdala ahora.</p><code>{issued.apiKey}</code><button className="button" onClick={() => setIssued(null)}>Ya guardé la clave</button></div>}
    {error && <p role="alert">{error}</p>}
    {devices.map(device => <article className="sensor-device" key={device.id}><h3>{device.name}</h3><p>{device.connection === 'online' ? 'En línea' : device.connection === 'revoked' ? 'Revocado' : 'Sin señal · sin uso'}{device.origin === 'SIMULATED' ? ' · de ejemplo' : ''}</p>
      {device.status === 'ACTIVE' && <>
        <form onSubmit={event => { event.preventDefault(); const form = event.currentTarget; void perform(() => sensorsApi.update(device.id, { ...config(form), dryRaw: device.dryRaw, wetRaw: device.wetRaw, zoneId: String(new FormData(form).get('zoneId')) })); }}>
          <ConfigFields device={device} /><label>Zona<select name="zoneId" defaultValue={device.zoneId}>{parcel.zones?.map(zone => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label><button className="button" disabled={pending}>Guardar configuración</button>
        </form>
        <Calibration now={now} device={device} reading={readings.find(row => row.deviceId === device.id)} pending={pending} perform={perform} />
        <div className="sensor-actions"><button className="button" disabled={pending} onClick={() => void perform(async () => setIssued(await sensorsApi.rotate(device.id)))}>Generar nueva clave</button><button className="button" disabled={pending} onClick={() => void perform(() => sensorsApi.revoke(device.id))}>Revocar dispositivo</button></div>
        <p className="form-note">Una nueva clave invalida la anterior. Revocar detiene la recepción y conserva el historial.</p>
      </>}
    </article>)}
    <details><summary>Registrar dispositivo</summary><form onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget;
      const origin = new FormData(form).get('origin') as Device['origin'];
      void perform(async () => { setIssued(await sensorsApi.create(parcel.zoneId!, { ...config(form), origin })); form.reset(); });
    }}><ConfigFields /><label>Origen<select name="origin" defaultValue="SIMULATED"><option value="SIMULATED">Simulador · de ejemplo</option><option value="REAL">ESP32 real</option></select></label><button className="button" disabled={pending || !parcel.zoneId}>Registrar y generar clave</button></form></details>
  </details>;
}
function Calibration({ device, reading, pending, perform, now }: { now: number; device: Device; reading?: Reading; pending: boolean; perform: (action: () => Promise<unknown>) => Promise<void> }) {
  const [dry, setDry] = useState<{ raw: number; id: string } | null>(null);
  const available = isOnline(device, now) && reading?.soilMoistureRaw != null && now - Date.parse(reading.receivedAt) <= device.expectedIntervalSeconds * 3000;
  return <div className="sensor-calibration"><h4>Calibrar la tierra</h4>
    <p>1. Con el sensor al aire, pulsa Guardar seco.</p><button className="button" disabled={pending || !available} onClick={() => setDry({ raw: reading!.soilMoistureRaw!, id: reading!.id })}>Guardar seco</button>
    {dry && <p role="status">Seco guardado. Ahora espera una nueva lectura con el sensor en agua.</p>}
    <p>2. Con el sensor en agua, pulsa Guardar húmedo.</p><button className="button" disabled={pending || !available || !dry || dry.id === reading?.id || dry.raw === reading?.soilMoistureRaw} onClick={() => void perform(async () => {
      await sensorsApi.update(device.id, { name: device.name, zoneId: device.zoneId, expectedIntervalSeconds: device.expectedIntervalSeconds, depthCm: device.depthCm, dryRaw: dry!.raw, wetRaw: reading!.soilMoistureRaw }); setDry(null);
    })}>Guardar húmedo</button>
    {!available && <p>Espera una lectura reciente para calibrar.</p>}
    {device.dryRaw !== null && <p>El sensor ya tiene calibración. Puedes repetir los pasos para cambiarla.</p>}
  </div>;
}

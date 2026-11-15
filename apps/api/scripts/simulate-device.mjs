// Dispositivo de ejemplo: nunca imprime claves ni registra lecturas como reales.
import { randomUUID } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export async function pollIrrigation({ baseUrl, apiKey, fetcher = fetch, sleep = wait, now = Date.now, startedAt = now(), state = { finishedAt: 0 } }) {
  const headers = { 'Content-Type': 'application/json', 'X-Device-Key': apiKey };
  const self = await fetcher(new URL('/device', baseUrl), { headers, signal: AbortSignal.timeout(10000) });
  if (!self.ok || (await self.json()).origin !== 'SIMULATED') throw new Error('El riego simulado exige dispositivo SIMULATED activo.');
  const next = await fetcher(new URL('/device/commands/next', baseUrl), { headers, signal: AbortSignal.timeout(10000) });
  if (next.status === 204) return null;
  if (!next.ok) throw new Error(`No se pudo consultar la orden (${next.status}).`);
  const command = await next.json();
  let status = 'FAILED', actualSeconds = 0;
  if (Number.isInteger(command.durationSeconds) && command.durationSeconds > 0 && command.durationSeconds <= 30 &&
      Date.parse(command.createdAt) >= startedAt && Date.parse(command.expiresAt) > now() && now() - state.finishedAt >= 300000) {
    const start = now();
    await sleep(Math.min(command.durationSeconds * 1000, Date.parse(command.expiresAt) - start));
    actualSeconds = Math.min(command.durationSeconds, Math.max(0, (now() - start) / 1000));
    status = now() < Date.parse(command.expiresAt) ? 'DONE' : 'FAILED';
    state.finishedAt = now();
  }
  const body = JSON.stringify({ status, actualSeconds });
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const result = await fetcher(new URL(`/device/commands/${command.id}/result`, baseUrl), { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
      if (!result.ok) throw new Error(`Reporte rechazado (${result.status}).`);
      console.log(`Riego SIMULATED: orden ${command.id}, ${status}, ${actualSeconds} s.`);
      return { id: command.id, status, actualSeconds, origin: 'SIMULATED' };
    } catch (error) { if (attempt === 3) throw error; await sleep(1000 * 2 ** attempt); }
  }
}

export async function simulate({ baseUrl, apiKey, count = 5, intervalMs = 5000, soilRaw = 1800, irrigation = false, fetcher = fetch, sleep = wait }) {
  if (!apiKey) throw new Error('Define DEVICE_API_KEY sin ponerla en argumentos ni en Git.');
  if (!Number.isInteger(count) || count < 1 || count > 10000 || !Number.isFinite(intervalMs) || intervalMs < 1000 || intervalMs > 86400000 || !Number.isInteger(soilRaw) || soilRaw < 0 || soilRaw > 4095) throw new Error('Cantidad, intervalo o ADC inválidos.');
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) throw new Error('Usa HTTPS; HTTP solo se permite en localhost.');
  const headers = { 'Content-Type': 'application/json', 'X-Device-Key': apiKey };
  const self = await fetcher(new URL('/device', base), { headers, signal: AbortSignal.timeout(10000) });
  if (!self.ok) throw new Error(`No se pudo autenticar el dispositivo (${self.status}).`);
  const device = await self.json();
  if (device.origin !== 'SIMULATED') throw new Error('El simulador exige un dispositivo SIMULATED; no se envió ninguna lectura.');
  const receipts = [];
  const startedAt = Date.now();
  const irrigationState = { finishedAt: 0 };
  for (let n = 0; n < count; n++) {
    const payload = { readingId: randomUUID(), measuredAt: new Date().toISOString(), soilMoistureRaw: soilRaw,
      airTemperature: Number((24 + Math.sin(n / 3)).toFixed(2)), airHumidity: Number((60 + Math.cos(n / 3) * 3).toFixed(2)), mq2Raw: 300 + n % 10 };
    let accepted;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const response = await fetcher(new URL('/readings', base), { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
        if (!response.ok) {
          if (response.status >= 500 || response.status === 429) { if (attempt === 3) throw new Error('Reintentos agotados.'); await sleep(response.status === 429 ? 60000 : 1000 * 2 ** attempt); continue; }
          throw new Error(`Lectura rechazada (${response.status}); revisar fecha, rangos y calibración.`);
        }
        const result = await response.json();
        if (result.accepted !== true || result.readingId !== payload.readingId || result.origin !== 'SIMULATED') throw new Error('Confirmación incompatible.');
        accepted = result;
        break;
      } catch (error) {
        // Solo errores de transporte se reintentan aquí; los errores HTTP son explícitos.
        if (!(error instanceof TypeError || error?.name === 'TimeoutError' || error?.name === 'AbortError') || attempt === 3) throw error;
        await sleep(1000 * 2 ** attempt);
      }
    }
    if (!accepted) throw new Error('No se recibió confirmación.');
    receipts.push(accepted);
    if (irrigation) await pollIrrigation({ baseUrl, apiKey, fetcher, sleep, startedAt, state: irrigationState });
    if (n < count - 1) await sleep(irrigation ? 5000 : intervalMs);
  }
  return receipts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const results = await simulate({ baseUrl: process.env.SIMULATOR_API_URL ?? 'http://localhost:3001', apiKey: process.env.DEVICE_API_KEY,
      irrigation: process.env.SIMULATOR_IRRIGATION === 'true', count: Number(process.env.SIMULATOR_COUNT ?? 5), intervalMs: Number(process.env.SIMULATOR_INTERVAL_MS ?? 5000), soilRaw: Number(process.env.SIMULATOR_SOIL_RAW ?? 1800) });
    console.log(`Simulación terminada: ${results.length} lecturas de ejemplo confirmadas.`);
  } catch (error) { console.error(error instanceof Error ? error.message : 'Falló el simulador.'); process.exitCode = 1; }
}

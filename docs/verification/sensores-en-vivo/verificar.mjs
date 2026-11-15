// Ejecuta desde la raíz. Reutiliza Playwright instalado, sin agregar dependencias.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { simulate, pollIrrigation } from '../../../apps/api/scripts/simulate-device.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const password = readFileSync('.env', 'utf8').split('\n').find(line => line.startsWith('SEED_DEMO_PASSWORD=')).split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
const base = 'http://localhost:3001';
async function api(path, method = 'GET', body, token) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  assert(response.ok, `${method} ${path}: ${response.status}`);
  return response.status === 204 ? null : response.json();
}
const owner = await api('/auth/login', 'POST', { email: 'coahuila@demo.ehecatl', password });
const admin = await api('/auth/login', 'POST', { email: 'admin@demo.ehecatl', password });
const parcel = await api('/parcels', 'POST', { name: 'Verificación en vivo de ejemplo', lat: 0, lon: 0, currentCropId: 'maize', irrigated: true }, owner.accessToken);
const zone = parcel.zones[0].id;
const issued = await api('/devices', 'POST', { zoneId: zone, name: 'Sensor de ejemplo', origin: 'SIMULATED', expectedIntervalSeconds: 30, dryRaw: 3000, wetRaw: 1000 }, admin.accessToken);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM, headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const output = 'docs/verification/sensores-en-vivo';
const report = { checks: [], errors: [], screenshots: [] };
page.on('pageerror', e => report.errors.push(e.message));
let apiStopped = false;
try {
  await simulate({ baseUrl: base, apiKey: issued.apiKey, count: 1, soilRaw: 3000 });
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Correo electrónico').fill('coahuila@demo.ehecatl');
  await page.locator('input[name=password]').fill(password);
  await page.getByRole('button', { name: 'Entrar a mis parcelas' }).click();
  await page.waitForURL('**/parcelas');
  await page.goto(`http://localhost:3000/parcelas/${parcel.id}?tab=sensores&zone=${zone}`);
  await page.locator('.sensor-number').getByText('0 %', { exact: true }).waitFor();
  await page.locator('.sensor-history').getByRole('button', { name: 'Temperatura', exact: true }).click();
  await page.getByText('Ver todas las lecturas', { exact: true }).click();
  const flashing = page.evaluate(() => new Promise(resolve => {
    const handler = e => { if (e.animationName === 'sensor-reading-arrival') { document.removeEventListener('animationstart', handler); resolve(true); } };
    document.addEventListener('animationstart', handler);
    setTimeout(() => { document.removeEventListener('animationstart', handler); resolve(false); }, 15000);
  }));
  await simulate({ baseUrl: base, apiKey: issued.apiKey, count: 1, soilRaw: 1800 });
  await page.locator('.sensor-live').getByText('60 %', { exact: true }).waitFor();
  assert(await flashing, 'Destello al llegar lectura');
  assert.equal(await page.locator('.sensor-history').getByRole('button', { name: 'Temperatura', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.sensor-reading').count(), 2);
  report.checks.push('Lectura nueva, historial y destello sin pulsar Actualizar; variable y desplegable conservados');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.waitForTimeout(500);
    await page.getByRole('heading', { name: 'Sensores', exact: true }).scrollIntoViewIfNeeded();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const visible = await page.locator('.sensor-panel').innerText();
    assert(!/ADC|MQ2|\bRH\b/.test(visible));
    assert(!visible.includes('Administrar sensores'));
    assert(visible.includes('de ejemplo'));
    const path = `${output}/en-vivo-${width}.png`;
    await page.screenshot({ path, fullPage: true }); report.screenshots.push(path);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.sensor-metrics').evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  report.checks.push('1440 y 390 px sin desbordamiento, sin jerga ni administración; ejemplo marcado; movimiento reducido sin destello');
  await page.getByRole('button', { name: '10 s', exact: true }).click();
  await page.getByRole('button', { name: /^Regar ahora/ }).click();
  await page.getByRole('button', { name: /^Confirmar riego/ }).click();
  await page.getByText(/^Orden enviada/).first().waitFor();
  const running = pollIrrigation({ baseUrl: base, apiKey: issued.apiKey, startedAt: Date.now() - 60000 });
  await page.getByText(/^Regando… \d+ s/).first().waitFor();
  await running;
  await page.getByText(/^Terminó: 10 s/).first().waitFor();
  report.checks.push('Riego manual confirmado: Orden enviada, Regando con segundos, Terminó sin recargar');
  // Congela la API, no el reloj: la edad debe cambiar aunque fallen las consultas.
  console.log('Deteniendo API');
  execFileSync('docker', ['compose', 'stop', '-t', '1', 'api'], { stdio: 'pipe' }); apiStopped = true;
  console.log('API detenida');
  await page.locator('.sensor-live-status').getByText('Sin conexión, reintentando', { exact: true }).waitFor();
  console.log('Desconexión visible, comprobando reloj');
  let aged = false;
  for (let attempt = 0; attempt < 45; attempt++) {
    const text = await page.locator('.sensor-live > .form-note').textContent();
    if (/hace [12] min/.test(text ?? '')) { aged = true; break; }
    await page.waitForTimeout(2000);
  }
  assert(aged, 'El texto de edad debe avanzar con el reloj');
  report.checks.push('Reloj avanza de hace un momento a minutos sin recibir consultas correctas; API detenida muestra Sin conexión, reintentando');
  execFileSync('docker', ['compose', 'start', 'api'], { stdio: 'pipe' }); apiStopped = false;
  await page.locator('.sensor-live-status').getByText('En vivo', { exact: true }).waitFor({ timeout: 80000 });
  report.checks.push('API reiniciada: recuperación automática');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
  const other = await context.newPage(); await other.goto('about:blank'); await other.bringToFront();
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.hasFocus()), false);
  let requests = 0;
  const count = req => { if (req.url().startsWith(base)) requests++; };
  page.on('request', count); await page.waitForTimeout(11000); page.off('request', count);
  assert.equal(requests, 0);
  let resumed = page.waitForRequest(req => req.url().includes(`/zones/${zone}/devices`), { timeout: 2000 });
  await page.bringToFront(); await resumed;
  report.checks.push('Pérdida real de foco: cero peticiones durante 11 s y consulta inmediata al volver');
  await other.close();
  // El navegador de automatización conserva visible; se prueba aparte el evento controlado.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.locator('.sensor-live-status').getByText('Pausado', { exact: true }).waitFor();
  requests = 0; page.on('request', count); await page.waitForTimeout(11000); page.off('request', count);
  assert.equal(requests, 0);
  resumed = page.waitForRequest(req => req.url().includes(`/zones/${zone}/devices`), { timeout: 2000 });
  await page.evaluate(() => {
    delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await resumed;
  report.checks.push('Visibilidad hidden simulada por evento: pausa y cero peticiones durante 11 s; carga inmediata al restaurar. No se pudo verificar ocultamiento real en este navegador');
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message;
  report.lastSummary = await page.locator('.sensor-live').textContent().catch(() => 'Sin resumen');
  console.error(error);
  throw error;
} finally {
  if (apiStopped) execFileSync('docker', ['compose', 'start', 'api'], { stdio: 'pipe' });
  writeFileSync(`${output}/reporte.json`, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  for (let attempt = 0; attempt < 30; attempt++) {
    try { if ((await fetch(base + '/health')).ok) break; } catch { /* API reiniciándose. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  await api(`/parcels/${parcel.id}`, 'DELETE', undefined, owner.accessToken);
}
console.log(JSON.stringify(report, null, 2));

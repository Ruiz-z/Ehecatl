// Ejecuta desde la raíz con PLAYWRIGHT_MODULE y PLAYWRIGHT_CHROMIUM si no están en las rutas habituales.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { simulate, pollIrrigation } from '../../../apps/api/scripts/simulate-device.mjs';
const password = readFileSync('.env','utf8').split('\n').find(line=>line.startsWith('SEED_DEMO_PASSWORD=')).split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g,'');
const base='http://localhost:3001';
async function api(path,method='GET',body,token) {
 const response=await fetch(base+path,{signal:AbortSignal.timeout(15000),method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
 return response.status===204?null:response.json();
}
console.log('inicio login');
const owner=await api('/auth/login','POST',{email:'coahuila@demo.ehecatl',password});
console.log('dueño listo');
const admin=await api('/auth/login','POST',{email:'admin@demo.ehecatl',password});
console.log('admin listo');
const parcel=await api('/parcels','POST',{name:'Verificación de sensores de ejemplo',lat:0,lon:0,currentCropId:'maize',irrigated:true},owner.accessToken);
const zone=parcel.zones[0].id;
console.log('parcela lista');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM,args:['--no-sandbox']});
console.log('browser listo');
const context=await browser.newContext({viewport:{width:1440,height:1100}});
const page=await context.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(15000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const output='docs/verification/sensores-agricultor';
const report={states:[],checks:[],errors};
const route=`http://localhost:3000/parcelas/${parcel.id}?tab=sensores&zone=${zone}`;
async function login(page,email) {
 await page.goto('http://localhost:3000/login',{waitUntil:'domcontentloaded'}); console.log('login page');
 await page.getByLabel('Correo electrónico').fill(email);
 await page.locator('input[name=password]').fill(password);
 await page.getByRole('button',{name:'Entrar a mis parcelas'}).click();await page.waitForURL('**/parcelas');
 await page.goto(route,{waitUntil:"domcontentloaded"});console.log("route ready");await page.getByRole('heading',{name:'Riego manual',exact:true}).waitFor();console.log('sensors ready');
}
async function refresh(page) {
 const loaded=page.waitForResponse(r=>r.url().includes(`/zones/${zone}/devices`)&&r.request().method()==='GET');
 await page.getByRole('button',{name:'Actualizar',exact:true}).click();await loaded;
 await page.waitForTimeout(600);
}
async function capture(state) {
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:1100});await page.waitForTimeout(400);
  const panel=page.locator('.sensor-panel');
  const visible=await panel.innerText();
  assert(!/ADC|MQ2|%?\bRH\b|calibración v|\borigen\b|índice relativo|\bv1\b/i.test(visible), 'Jerga visible');
  assert.equal(await page.locator('summary').filter({hasText:'Administrar sensores'}).count(),0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Desbordamiento horizontal');
  await page.screenshot({path:`${output}/${state}-${width}.png`,fullPage:true,timeout:10000});
  report.states.push({state,width,noJargon:true,noAdmin:true,noOverflow:true});
 }
 console.log(`capturado ${state}`);
}
let adminContext;
try {
 await login(page,'coahuila@demo.ehecatl');
 await page.getByText('Aún no hay sensor en esta zona.',{exact:false}).waitFor();
 assert(await page.getByRole('button',{name:/^Regar ahora/}).isDisabled());
 await capture('sin-sensor');
 const issued=await api('/devices','POST',{zoneId:zone,name:'Sensor de ejemplo',origin:'SIMULATED',expectedIntervalSeconds:30},admin.accessToken);
 const send=raw=>simulate({baseUrl:base,apiKey:issued.apiKey,count:1,soilRaw:raw});
 await send(3000);await refresh(page);
 await page.getByText('Falta calibrar el sensor',{exact:true}).waitFor();
 await capture('en-linea-sin-calibrar');
 assert.equal(await page.locator('.sensor-history .chart-frame').count(),0);
 adminContext=await browser.newContext({viewport:{width:1440,height:1100}});
 const adminPage=await adminContext.newPage();adminPage.setDefaultTimeout(15000);await login(adminPage,'admin@demo.ehecatl');
 await adminPage.getByText('Administrar sensores',{exact:true}).click();
 for(const name of ['Generar nueva clave','Revocar dispositivo','Guardar configuración','Guardar seco']) assert(await adminPage.getByRole('button',{name,exact:true}).isVisible());
 assert(await adminPage.locator('select[name=zoneId]').isVisible());
 await adminPage.getByRole('button',{name:'Guardar seco',exact:true}).click();
 await send(1000);await refresh(adminPage);
 const patched=adminPage.waitForResponse(r=>r.url().endsWith(`/devices/${issued.device.id}`)&&r.request().method()==='PATCH');
 await adminPage.getByRole('button',{name:'Guardar húmedo',exact:true}).click();
 assert.equal((await patched).status(),200);
 const stored=await api(`/zones/${zone}/devices`,'GET',undefined,admin.accessToken);
 assert.equal(stored[0].dryRaw,3000);assert.equal(stored[0].wetRaw,1000);
 report.checks.push('Calibración guiada: seco 3000, húmedo 1000 con PATCH real y última lectura');
 await send(1800);await refresh(page);
 await page.locator('.sensor-live').getByText('60 %',{exact:true}).waitFor();
 await capture('calibrado');
 for (const label of ['Temperatura','Humedad del aire','Tierra']) {
  const button=page.locator('.sensor-history').getByRole('button',{name:label,exact:true});await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');
 }
 for (const label of ['Hoy','30 días','7 días']) {
  const button=page.locator('.sensor-history').getByRole('button',{name:label,exact:true});
  const loaded=page.waitForResponse(r=>r.url().includes(`/zones/${zone}/readings?from=`));
  await button.click();await loaded;await page.waitForTimeout(300);
 }
 report.checks.push('Botones de variables y periodos; sin gráfica de tierra antes de calibrar');
 await page.setViewportSize({width:1440,height:1100});
 await page.getByRole('button',{name:'10 s',exact:true}).click();
 await page.getByRole('button',{name:/^Regar ahora/}).click();
 assert(await page.getByRole('button',{name:/^Confirmar riego/}).isVisible());
 await page.getByRole('button',{name:/^Confirmar riego/}).click();
 await page.getByText('Orden enviada',{exact:false}).first().waitFor();
 const running=pollIrrigation({baseUrl:base,apiKey:issued.apiKey,startedAt:Date.now()-60000});
 await page.getByText(/^Regando…/).first().waitFor({timeout:12000});
 await running;
 await page.getByText(/^Terminó: 10 s/).first().waitFor({timeout:15000});
 const commands=await api(`/zones/${zone}/irrigation-commands`,'GET',undefined,owner.accessToken);
 assert.equal(commands[0].status,'DONE');assert.equal(commands[0].actualSeconds,10);
 report.checks.push('Riego desde UI: confirmación, Orden enviada, Regando…, Terminó: 10 s y DONE en API');
 // Esperar la pérdida de señal real según el intervalo de 30 s del dispositivo temporal.
 const devices=await api(`/zones/${zone}/devices`,'GET',undefined,owner.accessToken);
 const remaining=Math.max(0,Date.parse(devices[0].lastMeasuredAt)+91000-Date.now());
 console.log(`esperando pérdida de señal ${Math.ceil(remaining/1000)} s`);
 await page.waitForTimeout(remaining);await refresh(page);
 await page.getByText('Sin señal.',{exact:false}).waitFor();
 assert(await page.getByRole('button',{name:/^Regar ahora/}).isDisabled());
 await capture('sin-senal');
 await page.getByText('Ver todas las lecturas',{exact:true}).click();
 assert(!/ADC|MQ2|%?\bRH\b|\borigen\b|índice relativo/i.test(await page.locator('.sensor-panel').innerText()));
 await page.getByText('Ver todos los datos',{exact:true}).first().click();
 assert(/ADC/.test(await page.locator('.sensor-panel').innerText()));
 await refresh(adminPage);
 await adminPage.getByText('Registrar dispositivo',{exact:true}).click();
 const register=adminPage.locator('form').filter({has:adminPage.getByRole('button',{name:'Registrar y generar clave',exact:true})});
 await register.locator('input[name=name]').fill('Sensor auxiliar de ejemplo');
 const registered=adminPage.waitForResponse(r=>r.url().endsWith('/devices')&&r.request().method()==='POST');
 await register.getByRole('button',{name:'Registrar y generar clave',exact:true}).click();
 assert((await registered).ok());
 const auxiliary=adminPage.locator('article.sensor-device').filter({has:adminPage.getByRole('heading',{name:'Sensor auxiliar de ejemplo',exact:true})});
 await auxiliary.getByRole('button',{name:'Generar nueva clave',exact:true}).waitFor();
 const rotated=adminPage.waitForResponse(r=>r.url().endsWith('/rotate-key'));
 await auxiliary.getByRole('button',{name:'Generar nueva clave',exact:true}).click();assert((await rotated).ok());
 assert(await adminPage.locator('.sensor-key code').isVisible());
 await adminPage.getByRole('button',{name:'Ya guardé la clave',exact:true}).click();
 const revoked=adminPage.waitForResponse(r=>r.url().endsWith('/revoke'));
 await auxiliary.getByRole('button',{name:'Revocar dispositivo',exact:true}).click();assert((await revoked).ok());
 await auxiliary.getByText('Revocado · de ejemplo',{exact:true}).waitFor();
 report.checks.push('Administrador registra sensor auxiliar, ve clave, rota clave y revoca desde UI con endpoints reales');
 report.checks.push('Detalle técnico oculto hasta Ver todos los datos; permisos visuales admin/agricultor; datos de ejemplo visibles');
 writeFileSync(`${output}/verificacion.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
} catch(e) { await page.screenshot({path:'/tmp/ehe-sensors-error.png',fullPage:true,timeout:10000});console.log((await page.locator('body').innerText()).slice(-5000));throw e; }
finally { await browser.close();await api(`/parcels/${parcel.id}`,'DELETE',undefined,owner.accessToken); }

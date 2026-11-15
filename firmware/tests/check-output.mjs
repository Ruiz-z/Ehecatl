import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

assert.ok(process.argv[2], 'Indica la ruta del ejecutable compilado de telemetry.test.cpp');
const result = spawnSync(process.argv[2], [], { encoding: 'utf8', windowsHide: true });
if (result.stderr) process.stderr.write(result.stderr);
assert.equal(result.status, 0, result.error?.message ?? 'Falló la prueba C++');
const expected = JSON.parse(readFileSync(new URL('../../docs/fixtures/esp32-readings.json', import.meta.url), 'utf8'));
assert.deepEqual(JSON.parse(result.stdout), expected, 'El JSON real del firmware debe coincidir con el fixture de la API');
console.log('Los cuatro payloads generados por C++ coinciden con el contrato probado por la API.');

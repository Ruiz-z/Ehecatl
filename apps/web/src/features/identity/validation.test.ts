import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateLogin } from './validation.ts';
test('valida correo y contraseña sin imponer reglas nuevas de contraseña', () => {
 for (const email of ['', 'ana', 'ana@', 'ana @demo.test']) assert.ok(validateLogin({ email, password: 'demo' }));
 for (const password of ['', '   ']) assert.ok(validateLogin({ email: 'ana@demo.test', password }));
 assert.equal(validateLogin({ email: ' ana@demo.test ', password: 'x' }), null);
});

import { authenticateDemo, demoPassword } from './demo-auth.ts';
test('acepta las cuatro cuentas demo y no distingue qué credencial falló', () => {
 for (const id of ['ana', 'james', 'lucia', 'admin']) {
  const user = authenticateDemo({ email: `${id}@demo.ehecatl.test`, password: demoPassword });
  assert.equal(user.id, id);
  assert.equal(user.role, id === 'admin' ? 'admin' : 'farmer');
 }
 const generic = /Correo o contraseña incorrectos/;
 assert.throws(() => authenticateDemo({ email: 'ana@demo.ehecatl.test', password: 'otra' }), generic);
 assert.throws(() => authenticateDemo({ email: 'nadie@demo.ehecatl.test', password: demoPassword }), generic);
});

import { demoUsers } from './fixtures/users.ts';
import { validateLogin, type LoginInput } from './validation.ts';
// Credencial pública de fixtures, nunca una contraseña de producción.
export const demoPassword = 'Ehecatl-demo-2026';
export function authenticateDemo(input: LoginInput) {
  const error = validateLogin(input);
  if (error) throw new Error(error);
  const user = demoUsers.find(item => item.email === input.email.trim().toLowerCase());
  if (!user || input.password !== demoPassword) {
    throw new Error('Correo o contraseña incorrectos. Revisa tus credenciales.');
  }
  return user;
}

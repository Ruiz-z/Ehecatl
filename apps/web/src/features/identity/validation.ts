export interface LoginInput { email: string; password: string }
export function validateLogin(input: LoginInput): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return 'Escribe un correo electrónico válido.';
  if (!input.password.trim()) return 'Escribe tu contraseña.';
  return null;
}

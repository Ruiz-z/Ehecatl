import type { AuthClient, Session } from './types';
const key = 'ehecatl-session';
export const authClient: AuthClient = {
  getSession() {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? 'null') as Session | null;
      if (value && value.accessToken && value.user?.id && value.expiresAt > Date.now()) return value;
    } catch { /* Una sesión dañada requiere volver a entrar. */ }
    return null;
  },
  setSession(session) { localStorage.setItem(key, JSON.stringify(session)); window.dispatchEvent(new Event('ehecatl-auth')); },
  logout() { localStorage.removeItem(key); window.dispatchEvent(new Event('ehecatl-auth')); }
};

import { authenticateDemo } from '@/features/identity/demo-auth';
export { demoPassword } from '@/features/identity/demo-auth';
import { demoParcels } from '@/features/parcels/fixtures/parcels';
import { observationsFor, seriesFor } from '@/features/nasa/fixtures/observations';
import { strategiesFor } from '@/features/rotation/fixtures/strategies';
import { rankStrategies } from '@/features/rotation/ranking';
import { validateLogin } from '@/features/identity/validation';
import { authClient } from './auth-client';
import type { ApiClient, Parcel, Priorities, Session } from './types';
export const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== 'false';
const parcelKey = 'ehecatl-parcels';
function session(): Session {
  const value = authClient.getSession();
  if (!value) throw new Error('Tu sesión terminó. Vuelve a iniciar sesión.');
  return value;
}
function localParcels(): Parcel[] {
  const stored: Parcel[] = JSON.parse(localStorage.getItem(parcelKey) ?? '[]');
  return [...demoParcels.filter(p => !stored.some(s => s.id === p.id)), ...stored];
}
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(authClient.getSession() ? { Authorization: `Bearer ${session().accessToken}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (response.status === 401) { authClient.logout(); throw new Error('Correo o contraseña incorrectos, o sesión vencida. Vuelve a iniciar sesión.'); }
  if (!response.ok) throw new Error('No se pudo completar la solicitud. Intenta de nuevo.');
  return response.json() as Promise<T>;
}
function undefinedContract(): never { throw new Error('Esta operación aún no tiene un contrato de API publicado. Consulta apps/web/README.md.'); }
const mock: ApiClient = {
  async login(input) {
    const user = authenticateDemo(input);
    return { user, accessToken: `mock-${user.id}`, expiresAt: Date.now() + 3600000 };
  },
  async listParcels() { const { user } = session(); return localParcels().filter(p => user.role === 'admin' || p.ownerId === user.id); },
  async createParcel(parcel) { const { user } = session(); const owned = { ...parcel, ownerId: user.id }; localStorage.setItem(parcelKey, JSON.stringify([...localParcels().filter(p => p.id !== owned.id), owned])); return owned; },
  async getIndicators(parcel) { session(); return { observations: observationsFor(parcel), series: seriesFor(parcel), origin: 'mock' }; },
  async getRecommendations(parcel, weights) { session(); return rankStrategies(strategiesFor(parcel), weights); },
  async savePriorities(weights: Priorities) { const current = session(); authClient.setSession({ ...current, user: { ...current.user, priorities: weights } }); return weights; }
};
const remote: ApiClient = {
  async login(input) {
    const error = validateLogin(input); if (error) throw new Error(error);
    return request<Session>('/auth/login', 'POST', input);
  },
  async listParcels() { return undefinedContract(); },
  async createParcel() { return undefinedContract(); },
  async getIndicators() { return undefinedContract(); },
  async getRecommendations(parcel) {
    if (!parcel.zoneId) throw new Error('La parcela no incluye zoneId; no se puede pedir una recomendación por zona.');
    return request(`/zones/${encodeURIComponent(parcel.zoneId)}/recommendations`);
  },
  async savePriorities(weights) { return request('/me/priorities', 'PUT', weights); }
};
export const apiClient = useMocks ? mock : remote;

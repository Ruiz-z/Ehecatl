import { authenticateDemo } from '@/features/identity/demo-auth';
export { demoPassword } from '@/features/identity/demo-auth';
import { demoParcels } from '@/features/parcels/fixtures/parcels';
import { observationsFor, seriesFor } from '@/features/nasa/fixtures/observations';
import { demoClimateByOwner } from '@/features/identity/fixtures/users';
import { strategiesFor } from '@/features/rotation/fixtures/strategies';
import { validateLogin } from '@/features/identity/validation';
import { authClient } from './auth-client';
import { mapCrops, mapIndicators, mapParcel, mapRecommendations, mapSession, type ApiCrop, type ApiIndicators, type ApiLogin, type ApiParcel, type ApiRecommendations } from './adapters';
import type { ApiClient, Crop, Indicators, Parcel, Priorities, Session } from './types';
export const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== 'false';
const parcelKey = 'ehecatl-parcels';
const mockCrops = ['Maíz', 'Sorgo', 'Frijol', 'Cebada', 'Alfalfa', 'Soja', 'Trigo', 'Girasol', 'Avena', 'Garbanzo', 'Caupí', 'Vicia'];
function session(): Session {
  const value = authClient.getSession();
  if (!value) throw new Error('Tu sesión terminó. Vuelve a iniciar sesión.');
  return value;
}
function localParcels(): Parcel[] {
  const stored: Parcel[] = JSON.parse(localStorage.getItem(parcelKey) ?? '[]');
  return [...demoParcels.filter(p => !stored.some(s => s.id === p.id)), ...stored];
}
async function request<T>(path: string, method = 'GET', body?: unknown, token?: string): Promise<T> {
  const bearer = token ?? authClient.getSession()?.accessToken;
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (response.status === 401) { authClient.logout(); throw new Error('Correo o contraseña incorrectos, o sesión vencida. Vuelve a iniciar sesión.'); }
  if (response.status === 403) throw new Error('No tienes acceso a esta parcela.');
  if (response.status === 404) throw new Error('No encontramos lo que buscas.');
  if (response.status === 502 || response.status === 504) throw new Error('No pudimos consultar los datos NASA ahora. Intenta de nuevo en un momento.');
  if (!response.ok) throw new Error('No se pudo completar la solicitud. Intenta de nuevo.');
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}
function mockIndicators(parcel: Parcel): Indicators {
  const humid = demoClimateByOwner[parcel.ownerId] === 'humid';
  return {
    observations: observationsFor(parcel), series: seriesFor(parcel), origin: 'mock', warnings: [],
    summaries: humid ? {
      rainfall: { text: 'Lluvia suficiente para el ciclo', tone: 'good' }, temperature: { text: 'Dentro del rango habitual', tone: 'good' },
      moisture: { text: 'Buena reserva de agua', tone: 'good' }, ndvi: { text: 'Vegetación en crecimiento', tone: 'good' }
    } : {
      rainfall: { text: '38 % menos que lo normal', tone: 'warning' }, temperature: { text: '2.1 °C más que lo normal', tone: 'warning' },
      moisture: { text: 'Reserva de agua por debajo de lo normal', tone: 'warning' }, ndvi: { text: 'Menor actividad que lo normal', tone: 'warning' }
    },
    ndvi: { value: humid ? 0.59 : 0.28, label: humid ? 'Vegetación activa' : 'Actividad moderada' },
    lastObservation: '31 oct 2026', periodLabel: 'nov 2025 – oct 2026'
  };
}
const mock: ApiClient = {
  async login(input) {
    const user = authenticateDemo(input);
    return { user, accessToken: `mock-${user.id}`, expiresAt: Date.now() + 3600000 };
  },
  async listCrops() { return mockCrops.map(name => ({ id: name, name, family: '' })); },
  async listParcels() { const { user } = session(); return localParcels().filter(p => user.role === 'admin' || p.ownerId === user.id); },
  async createParcel(input) {
    const { user } = session();
    const owned: Parcel = { id: crypto.randomUUID(), ownerId: user.id, name: input.name, crop: input.cropId, irrigation: input.irrigation, latitude: input.latitude, longitude: input.longitude,
      place: `${input.latitude.toFixed(4)}, ${input.longitude.toFixed(4)}`, area: null, risk: 'moderate', dataState: 'empty' };
    localStorage.setItem(parcelKey, JSON.stringify([...localParcels().filter(p => p.id !== owned.id), owned]));
    return owned;
  },
  async getIndicators(parcel) { session(); return mockIndicators(parcel); },
  async getRecommendations(parcel) {
    session();
    const first = observationsFor(parcel)[0]!;
    return {
      status: parcel.dataState === 'no-windows' ? 'no_viable_options' : 'ok', origin: 'mock', horizonStart: '2026-11',
      confidence: parcel.dataState === 'error' ? 'Baja' : 'Media', warnings: [],
      risk: { level: parcel.risk === 'high' ? 'high' : 'low', reasons: [`${first.value} de lluvia disponible. ${first.consequence}`] },
      strategies: parcel.dataState === 'no-windows' ? [] : strategiesFor(parcel)
    };
  },
  async savePriorities(weights: Priorities) { const current = session(); authClient.setSession({ ...current, user: { ...current.user, priorities: weights } }); return weights; }
};
let cropCache: Promise<Crop[]> | null = null;
function crops(): Promise<Crop[]> {
  cropCache ??= request<ApiCrop[]>('/crops').then(mapCrops).catch(error => { cropCache = null; throw error; });
  return cropCache;
}
const remote: ApiClient = {
  async login(input) {
    const error = validateLogin(input); if (error) throw new Error(error);
    const login = await request<ApiLogin>('/auth/login', 'POST', input);
    const priorities = await request<Priorities>('/me/priorities', 'GET', undefined, login.accessToken);
    cropCache = null;
    return mapSession(login, priorities);
  },
  listCrops: crops,
  async listParcels() {
    const [parcels, catalog] = await Promise.all([request<ApiParcel[]>('/parcels'), crops()]);
    return parcels.map(parcel => mapParcel(parcel, catalog)).filter((parcel): parcel is Parcel => parcel !== null);
  },
  async createParcel(input) {
    const created = await request<ApiParcel>('/parcels', 'POST', { name: input.name, lat: input.latitude, lon: input.longitude, currentCropId: input.cropId, irrigated: input.irrigation });
    const parcel = mapParcel(created, await crops());
    if (!parcel) throw new Error('La parcela se creó sin zona. Intenta de nuevo.');
    return parcel;
  },
  async getIndicators(parcel) {
    if (!parcel.zoneId) throw new Error('La parcela no incluye zoneId; no se pueden pedir indicadores por zona.');
    return mapIndicators(await request<ApiIndicators>(`/zones/${encodeURIComponent(parcel.zoneId)}/indicators`));
  },
  async getRecommendations(parcel) {
    if (!parcel.zoneId) throw new Error('La parcela no incluye zoneId; no se puede pedir una recomendación por zona.');
    const [response, catalog] = await Promise.all([request<ApiRecommendations>(`/zones/${encodeURIComponent(parcel.zoneId)}/recommendations`), crops()]);
    return mapRecommendations(response, catalog);
  },
  async savePriorities(weights) {
    const saved = await request<Priorities>('/me/priorities', 'PUT', weights);
    const current = authClient.getSession();
    if (current) authClient.setSession({ ...current, user: { ...current.user, priorities: saved } });
    return saved;
  }
};
export const apiClient = useMocks ? mock : remote;

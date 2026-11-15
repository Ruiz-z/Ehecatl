'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/shared/api/client';
import { authClient } from '@/shared/api/auth-client';
import type { LoginInput } from './validation';
import type { DemoUser, Parcel } from '@/features/parcels/types';
import type { NewParcelInput } from '@/shared/api/types';
interface DemoSession {
  user: DemoUser | null; parcels: Parcel[]; ready: boolean; error: string;
  login(input: LoginInput): Promise<void>; logout(): void;
  addParcel(input: NewParcelInput): Promise<Parcel>; updateParcel(parcel: Parcel): void;
}
const Context = createContext<DemoSession | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<DemoUser | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    function sync() {
      const next = authClient.getSession()?.user ?? null;
      setUser(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      setReady(true);
    }
    sync(); window.addEventListener('storage', sync); window.addEventListener('ehecatl-auth', sync);
    const timer = window.setInterval(sync, 30000);
    return () => { window.clearInterval(timer); window.removeEventListener('storage', sync); window.removeEventListener('ehecatl-auth', sync); };
  }, []);
  useEffect(() => {
    let active = true;
    if (user) apiClient.listParcels().then(items => { if (active) { setParcels(items); setError(''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [user]);
  return <Context.Provider value={{ user, parcels: user ? parcels.filter(p => user.role === 'admin' || p.ownerId === user.id) : [], ready, error,
    async login(input) { const next = await apiClient.login(input); authClient.setSession(next); setParcels([]); router.replace('/parcelas'); },
    logout() { authClient.logout(); setParcels([]); router.replace('/login'); },
    async addParcel(input) { const saved = await apiClient.createParcel(input); setParcels(items => [...items, saved]); return saved; },
    updateParcel(parcel) { setParcels(items => items.map(p => p.id === parcel.id ? parcel : p)); }
  }}>{children}</Context.Provider>;
}
export function useDemo() { const value = useContext(Context); if (!value) throw new Error('DemoProvider required'); return value; }

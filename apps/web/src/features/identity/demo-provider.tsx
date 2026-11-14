'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { demoUsers } from './fixtures/users';
import { demoParcels } from '@/features/parcels/fixtures/parcels';
import type { DemoUser, Parcel } from '@/features/parcels/types';
interface DemoSession {
  user: DemoUser | null;
  parcels: Parcel[];
  ready: boolean;
  login: (id: string) => void;
  logout: () => void;
  addParcel: (parcel: Parcel) => void;
  updateParcel: (parcel: Parcel) => void;
}
const Context = createContext<DemoSession | null>(null);
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
};
const emit = () => listeners.forEach(listener => listener());
const snapshot = () => window.localStorage.getItem('ehecatl-demo') ?? '';
const serverSnapshot = () => '';
export function DemoProvider({
  children
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  let saved: {
    userId?: string;
    parcels?: Parcel[];
  } = {};
  try {
    saved = JSON.parse(raw || '{}');
  } catch {/* A damaged demo session starts fresh. */}
  const user = demoUsers.find(item => item.id === saved.userId) ?? null;
  const parcels = [...demoParcels, ...(saved.parcels ?? []).filter(item => !demoParcels.some(base => base.id === item.id))].map(item => saved.parcels?.find(override => override.id === item.id) ?? item).filter(item => item.ownerId === user?.id);
  function persist(next: typeof saved) {
    localStorage.setItem('ehecatl-demo', JSON.stringify(next));
    emit();
  }
  return <Context.Provider value={{
    user,
    parcels,
    ready,
    login: id => {
      persist({
        ...saved,
        userId: id
      });
      router.push('/parcelas');
    },
    logout: () => {
      persist({
        ...saved,
        userId: undefined
      });
      router.push('/login');
    },
    addParcel: parcel => persist({
      ...saved,
      parcels: [...(saved.parcels ?? []), parcel]
    }),
    updateParcel: parcel => persist({
      ...saved,
      parcels: [...(saved.parcels ?? []).filter(item => item.id !== parcel.id), parcel]
    })
  }}>{children}</Context.Provider>;
}
export function useDemo() {
  const value = useContext(Context);
  if (!value) throw new Error('DemoProvider required');
  return value;
}

'use client';
import { useEffect, useState } from 'react';
export type AsyncState<T> = { status: 'loading' } | { status: 'error'; message: string; retry: () => void } | { status: 'ready'; data: T };
type Settled<T> = { token: string; data: T } | { token: string; message: string };
// Carga un dato asíncrono y lo recarga cuando cambia `key` o se pide reintentar.
// El resultado se guarda con el token que lo pidió: si no coincide con el actual, sigue "cargando".
export function useAsync<T>(load: () => Promise<T>, key: string): AsyncState<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const token = `${key}#${attempt}`;
  useEffect(() => {
    let active = true;
    load().then(data => { if (active) setSettled({ token, data }); })
      .catch(error => { if (active) setSettled({ token, message: error instanceof Error ? error.message : 'No se pudo cargar.' }); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  if (!settled || settled.token !== token) return { status: 'loading' };
  if ('message' in settled) return { status: 'error', message: settled.message, retry: () => setAttempt(n => n + 1) };
  return { status: 'ready', data: settled.data };
}

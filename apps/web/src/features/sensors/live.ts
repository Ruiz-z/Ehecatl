'use client';
import { useEffect, useState } from 'react';

export function pollingDelay(ms: number, errors: number): number {
  return errors === 0 ? ms : Math.min(60000, 5000 * 2 ** Math.min(errors - 1, 4));
}
export function canPoll(visible: boolean, focused: boolean, busy: boolean): boolean {
  return visible && focused && !busy;
}

export function useLivePolling(load: (signal: AbortSignal) => Promise<void>, ms: number) {
  const [status, setStatus] = useState<'live' | 'paused' | 'offline'>('live');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let stopped = false;
    let busy = false;
    let errors = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const ready = () => canPoll(document.visibilityState !== 'hidden', document.hasFocus(), busy);
    async function run() {
      clearTimeout(timer);
      if (stopped || !ready()) return;
      busy = true;
      controller = new AbortController();
      const current = controller;
      try {
        await load(current.signal);
        if (!stopped && !current.signal.aborted) { errors = 0; setStatus('live'); }
      } catch {
        if (!stopped && !current.signal.aborted) { errors++; setStatus('offline'); }
      } finally {
        const interrupted = current.signal.aborted;
        current.abort();
        busy = false;
        if (!stopped && ready()) timer = setTimeout(() => void run(), interrupted ? 0 : pollingDelay(ms, errors));
      }
    }
    function activity() {
      clearTimeout(timer);
      if (document.visibilityState === 'hidden' || !document.hasFocus()) {
        controller?.abort();
        setStatus('paused');
      } else {
        setStatus(errors ? 'offline' : 'live');
        void run();
      }
    }
    document.addEventListener('visibilitychange', activity);
    window.addEventListener('focus', activity);
    window.addEventListener('blur', activity);
    activity();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', activity);
      window.removeEventListener('focus', activity);
      window.removeEventListener('blur', activity);
    };
  }, [load, ms, revision]);
  return { status, refresh: () => setRevision(value => value + 1) };
}

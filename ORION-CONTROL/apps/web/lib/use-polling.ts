'use client';

/**
 * Polling hook.
 *
 * Deliberately simple: no websockets, no extra infrastructure. Polling is the
 * same mechanism the worker uses, and it keeps the dashboard working on a free
 * Vercel plan. Components pass an interval appropriate to their data.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from './client';

export interface PollingState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

export function usePolling<T>(url: string, intervalMs: number, enabled = true): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const result = await apiFetch<T>(url);
        if (!cancelled && mounted.current) {
          setData(result);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled && mounted.current) {
          setError(caught instanceof Error ? caught.message : 'Request failed.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(tick, intervalMs);
        }
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [url, intervalMs, enabled, nonce]);

  return { data, error, loading, refresh };
}

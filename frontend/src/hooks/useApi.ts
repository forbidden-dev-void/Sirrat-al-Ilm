/**
 * useApi — declarative data fetching
 * ==================================
 *
 * Wraps a loader function with `loading` / `error` / `data` state, ignores
 * responses that arrive after unmount (no React state-update warnings) and
 * exposes `reload()` for optimistic refreshes after a mutation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (updater: T | ((previous: T | null) => T | null)) => void;
}

export function useApi<T>(loader: () => Promise<T>, deps: readonly unknown[] = []): UseApiResult<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Keep the latest loader without re-running the effect on every render.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loaderRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setDataState(result);
          setLoading(false);
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Please retry.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback((): void => setNonce((value) => value + 1), []);

  const setData = useCallback((updater: T | ((previous: T | null) => T | null)): void => {
    setDataState((previous) =>
      typeof updater === 'function' ? (updater as (prev: T | null) => T | null)(previous) : updater,
    );
  }, []);

  return { data, loading, error, reload, setData };
}

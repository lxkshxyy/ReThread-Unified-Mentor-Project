import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from './api';

/** Small data-fetching hook: const { data, loading, error, reload } = useFetch('/items', { params }) */
export function useFetch(url, options = {}, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState(null);
  const seq = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      if (!url) return;
      const id = ++seq.current;
      if (!silent) setLoading(true);
      try {
        const res = await api.get(url, options);
        if (id === seq.current) {
          setData(res.data);
          setError(null);
        }
      } catch (e) {
        if (id === seq.current) setError(errorMessage(e));
      } finally {
        if (id === seq.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, JSON.stringify(options), ...deps]
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data, setData, loading, error, reload: load };
}

export function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ReThread` : "ReThread — Swap, don't shop";
  }, [title]);
}

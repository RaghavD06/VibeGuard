import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchApi } from '../config';

export function useCollection(path: string, repository = 'all') {
  const [data, setData] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const load = useCallback(async (next?: string) => {
    active.current?.abort();
    const request = new AbortController();
    active.current = request;
    setLoading(true);
    setError(null);
    if (!next) { setData([]); setCursor(null); }
    try {
      const query = new URLSearchParams({ limit: '100' });
      if (repository !== 'all') query.set('repository', repository);
      if (next) query.set('cursor', next);
      const response = await fetchApi(`${path}${path.includes('?') ? '&' : '?'}${query}`, { signal: request.signal });
      if (!response.ok) throw new Error('Could not load records. Please retry.');
      const items = await response.json();
      if (!Array.isArray(items)) throw new Error('The server returned invalid records.');
      if (request.signal.aborted) return;
      setData(previous => next ? [...previous, ...items.filter(item => !previous.some(old => old.id === item.id))] : items);
      setCursor(response.headers.get('X-Next-Cursor'));
    } catch (failure) {
      if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load records.');
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, [path, repository]);
  useEffect(() => { void load(); return () => active.current?.abort(); }, [load]);
  return { data, setData, loading, error, hasMore: Boolean(cursor), loadMore: () => cursor && load(cursor), refresh: () => load() };
}

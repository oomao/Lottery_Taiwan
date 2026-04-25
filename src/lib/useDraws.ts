import { useEffect, useState, useCallback, useRef } from 'react';
import type { Draw, GameId } from './types';
import { loadDraws } from './data-loader';

interface UseDrawsResult {
  draws: Draw[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
  fetchedAt: Date | null;
}

// 載入彩種開獎資料,並提供以下自動更新機制:
// 1. 切回分頁 (visibilitychange) 時,如果距上次抓取 > 5 分鐘,背景重新抓
// 2. 提供 refresh() 可手動觸發
// 3. refresh 時 bustCache,跳過 Service Worker 確保拿到最新
export function useDraws(game: GameId): UseDrawsResult {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const lastFetchRef = useRef<number>(0);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await loadDraws(game, { bustCache: true });
      setDraws(data);
      const now = new Date();
      setFetchedAt(now);
      lastFetchRef.current = now.getTime();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [game]);

  // 初次載入 (用快取也 OK)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadDraws(game)
      .then((data) => {
        if (cancelled) return;
        setDraws(data);
        const now = new Date();
        setFetchedAt(now);
        lastFetchRef.current = now.getTime();
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [game]);

  // 切回分頁 / focus 時自動 refresh (5 分鐘 cooldown,避免太頻繁)
  useEffect(() => {
    const STALE_MS = 5 * 60 * 1000;
    const handler = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchRef.current < STALE_MS) return;
      refresh();
    };
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('focus', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('focus', handler);
    };
  }, [refresh]);

  return { draws, loading, error, refreshing, refresh, fetchedAt };
}

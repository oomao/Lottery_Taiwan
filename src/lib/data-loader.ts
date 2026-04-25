import type { Draw, GameId, StatsFile } from './types';

// 注意:Vite base 設了 /Lottery_Taiwan/,所以 fetch 路徑要用 import.meta.env.BASE_URL
const base = import.meta.env.BASE_URL;

async function fetchJson<T>(path: string, options: { bustCache?: boolean } = {}): Promise<T> {
  const { bustCache } = options;
  let url = `${base}${path}`.replace(/\/+/g, '/');
  // 加 query string 跳過 SW 快取,確保拿到最新版
  if (bustCache) url += `?t=${Date.now()}`;
  const res = await fetch(url, bustCache ? { cache: 'no-store' } : undefined);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status}`);
  }
  return res.json();
}

export async function loadDraws(
  game: GameId,
  options: { bustCache?: boolean } = {}
): Promise<Draw[]> {
  return fetchJson<Draw[]>(`data/${game}/raw.json`, options);
}

export async function loadStats(
  game: GameId,
  type: 'pair' | 'triplet' | 'quad',
  options: { bustCache?: boolean } = {}
): Promise<StatsFile> {
  return fetchJson<StatsFile>(`data/${game}/stats-${type}.json`, options);
}

// 期間篩選工具
export function filterDrawsByDateRange(
  draws: Draw[],
  startDate?: string,
  endDate?: string
): Draw[] {
  return draws.filter((d) => {
    if (startDate && d.drawDate < startDate) return false;
    if (endDate && d.drawDate > endDate) return false;
    return true;
  });
}

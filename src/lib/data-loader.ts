import type { Draw, GameId, StatsFile } from './types';

// 注意:Vite base 設了 /lottery/,所以 fetch 路徑要用 import.meta.env.BASE_URL
const base = import.meta.env.BASE_URL;

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${base}${path}`.replace(/\/+/g, '/');
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status}`);
  }
  return res.json();
}

export async function loadDraws(game: GameId): Promise<Draw[]> {
  return fetchJson<Draw[]>(`data/${game}/raw.json`);
}

export async function loadStats(
  game: GameId,
  type: 'pair' | 'triplet' | 'quad'
): Promise<StatsFile> {
  return fetchJson<StatsFile>(`data/${game}/stats-${type}.json`);
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

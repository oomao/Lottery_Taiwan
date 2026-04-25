import { useMemo } from 'react';
import type { Draw, GameConfig } from '@/lib/types';

interface Props {
  draws: Draw[];
  game: GameConfig;
  window?: number;
}

interface Stat {
  label: string;
  count: number;
  pct: number;
}

export default function CharacteristicAnalysis({ draws, game, window }: Props) {
  const sorted = useMemo(
    () => [...draws].sort((a, b) => b.drawDate.localeCompare(a.drawDate)),
    [draws]
  );
  const subset = window ? sorted.slice(0, window) : sorted;

  const [, max] = game.numberRange;
  const mid = Math.ceil(max / 2);

  // 大小:>= mid 為大,< mid 為小
  // 奇偶:奇/偶
  // 連號:存在連號 / 無連號
  const bigSmallStats: Record<string, number> = {};
  const oddEvenStats: Record<string, number> = {};
  let consecutiveCount = 0;

  for (const draw of subset) {
    const big = draw.numbers.filter((n) => n >= mid).length;
    const small = draw.numbers.length - big;
    const k = `${big}大${small}小`;
    bigSmallStats[k] = (bigSmallStats[k] ?? 0) + 1;

    const odd = draw.numbers.filter((n) => n % 2 === 1).length;
    const even = draw.numbers.length - odd;
    const k2 = `${odd}奇${even}偶`;
    oddEvenStats[k2] = (oddEvenStats[k2] ?? 0) + 1;

    const sortedNums = [...draw.numbers].sort((a, b) => a - b);
    let hasConsec = false;
    for (let i = 1; i < sortedNums.length; i++) {
      if (sortedNums[i] - sortedNums[i - 1] === 1) {
        hasConsec = true;
        break;
      }
    }
    if (hasConsec) consecutiveCount += 1;
  }

  const total = subset.length;
  const toStats = (obj: Record<string, number>): Stat[] =>
    Object.entries(obj)
      .map(([label, count]) => ({ label, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);

  const bigSmall = toStats(bigSmallStats);
  const oddEven = toStats(oddEvenStats);
  const consecPct = (consecutiveCount / total) * 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard title="📏 大小分布" stats={bigSmall.slice(0, 6)} hint={`${mid}↑為大`} />
      <StatCard title="🔢 奇偶分布" stats={oddEven.slice(0, 6)} />
      <div className="card">
        <h3 className="text-lg font-bold mb-3">🔗 連號出現率</h3>
        <div className="text-center py-4">
          <div className="text-4xl font-bold text-brand">{consecPct.toFixed(1)}%</div>
          <div className="text-sm text-gray-500 mt-2">
            {total} 期中有 <strong>{consecutiveCount}</strong> 期出現連號
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, stats, hint }: { title: string; stats: Stat[]; hint?: string }) {
  return (
    <div className="card">
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      <ul className="space-y-2 mt-2">
        {stats.map((s) => (
          <li key={s.label}>
            <div className="flex justify-between text-sm mb-1">
              <span>{s.label}</span>
              <span className="text-gray-500">
                {s.count} 期 ({s.pct.toFixed(1)}%)
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
              <div
                className="h-full bg-brand"
                style={{ width: `${s.pct}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

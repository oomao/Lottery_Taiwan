import { useMemo, useState } from 'react';
import type { Draw, GameConfig } from '@/lib/types';
import { computeFrequency } from '@/lib/stats/frequency';
import Ball from '@/components/ui/Ball';

interface Props {
  draws: Draw[];
  game: GameConfig;
}

export default function GapTable({ draws, game }: Props) {
  const [sortBy, setSortBy] = useState<'gap' | 'number'>('gap');
  const stats = useMemo(() => computeFrequency(draws, game), [draws, game]);

  const sorted = [...stats].sort((a, b) => {
    if (sortBy === 'gap') return b.gap - a.gap;
    return a.number - b.number;
  });

  // 標示「久未開」的閾值:超過平均值 1.5 倍視為冷
  const avgGap = sorted.reduce((s, x) => s + x.gap, 0) / sorted.length;
  const threshold = avgGap * 1.5;

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-lg font-bold">⏳ 遺漏值分析</h3>
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setSortBy('gap')}
            className={`px-2 py-1 rounded ${
              sortBy === 'gap' ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            依遺漏排序
          </button>
          <button
            onClick={() => setSortBy('number')}
            className={`px-2 py-1 rounded ${
              sortBy === 'number' ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            依號碼排序
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        平均遺漏 {avgGap.toFixed(1)} 期,標紅為超過 {threshold.toFixed(0)} 期未開
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {sorted.map((s) => (
          <div
            key={s.number}
            className={`flex items-center gap-2 p-2 rounded border ${
              s.gap > threshold
                ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <Ball number={s.number} color={game.ballColor} size="sm" />
            <span className="text-sm">
              <span className={s.gap > threshold ? 'text-red-600 font-bold' : ''}>
                {s.gap}
              </span>
              <span className="text-xs text-gray-500"> 期</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

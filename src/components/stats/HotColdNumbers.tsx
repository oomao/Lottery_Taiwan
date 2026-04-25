import { useMemo } from 'react';
import type { Draw, GameConfig } from '@/lib/types';
import { computeFrequency } from '@/lib/stats/frequency';
import Ball from '@/components/ui/Ball';

interface Props {
  draws: Draw[];
  game: GameConfig;
  topN?: number;
  window?: number;
}

export default function HotColdNumbers({ draws, game, topN = 5, window }: Props) {
  const stats = useMemo(
    () => computeFrequency(draws, game, { window }),
    [draws, game, window]
  );

  const sortedByCount = [...stats].sort((a, b) => b.count - a.count);
  const hot = sortedByCount.slice(0, topN);
  const cold = sortedByCount.slice(-topN).reverse();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card">
        <h3 className="text-lg font-bold mb-3">🔥 熱門號碼 Top {topN}</h3>
        <ul className="space-y-2">
          {hot.map((s, i) => (
            <li key={s.number} className="flex items-center gap-3">
              <span className="text-gray-400 text-sm w-5">#{i + 1}</span>
              <Ball number={s.number} color={game.ballColor} size="md" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                出現 <strong>{s.count}</strong> 次
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold mb-3">❄️ 冷門號碼 Top {topN}</h3>
        <ul className="space-y-2">
          {cold.map((s, i) => (
            <li key={s.number} className="flex items-center gap-3">
              <span className="text-gray-400 text-sm w-5">#{i + 1}</span>
              <Ball number={s.number} color="blue" size="md" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                出現 <strong>{s.count}</strong> 次
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

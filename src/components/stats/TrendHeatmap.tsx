import { useMemo, useState } from 'react';
import type { Draw, GameConfig } from '@/lib/types';

interface Props {
  draws: Draw[];
  game: GameConfig;
}

export default function TrendHeatmap({ draws, game }: Props) {
  const [windowSize, setWindowSize] = useState(30);
  const [min, max] = game.numberRange;

  const sorted = useMemo(
    () => [...draws].sort((a, b) => b.drawDate.localeCompare(a.drawDate)).slice(0, windowSize),
    [draws, windowSize]
  );

  // X 軸:期別 (新→舊),Y 軸:號碼 1..max
  const cellSize = 14;
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => i + min);

  const isHit = (term: string, number: number) => {
    const draw = sorted.find((d) => d.drawTerm === term);
    return draw?.numbers.includes(number) ?? false;
  };

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-lg font-bold">📈 號碼走勢 (近 {windowSize} 期)</h3>
        <div className="flex gap-1 text-xs">
          {[20, 30, 50, 100].map((n) => (
            <button
              key={n}
              onClick={() => setWindowSize(n)}
              className={`px-2 py-1 rounded ${
                windowSize === n ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-gray-700'
              }`}
            >
              {n} 期
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block">
          <div className="flex">
            <div style={{ width: 40 }} />
            {sorted.map((d) => (
              <div
                key={d.drawTerm}
                className="text-[8px] text-gray-400 text-center"
                style={{ width: cellSize, transform: 'rotate(-90deg)', transformOrigin: 'center' }}
              >
                {d.drawTerm.slice(-3)}
              </div>
            ))}
          </div>

          {numbers.map((n) => (
            <div key={n} className="flex items-center">
              <div className="text-xs text-gray-500 text-right pr-2" style={{ width: 40 }}>
                {n}
              </div>
              {sorted.map((d) => {
                const hit = isHit(d.drawTerm, n);
                return (
                  <div
                    key={d.drawTerm + '-' + n}
                    title={`${d.drawTerm} → ${hit ? '中' : '未中'}`}
                    className={`border border-gray-100 dark:border-gray-800 ${
                      hit
                        ? 'bg-red-500'
                        : 'bg-gray-50 dark:bg-gray-700/30'
                    }`}
                    style={{ width: cellSize, height: cellSize }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

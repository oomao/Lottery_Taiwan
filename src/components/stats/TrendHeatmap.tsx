import { useMemo, useState } from 'react';
import type { Draw, GameConfig } from '@/lib/types';

interface Props {
  draws: Draw[];
  game: GameConfig;
}

const PRESETS = [20, 30, 50, 100];

export default function TrendHeatmap({ draws, game }: Props) {
  const total = draws.length;
  const [windowSize, setWindowSize] = useState(Math.min(30, Math.max(1, total)));
  const [customInput, setCustomInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [min, max] = game.numberRange;

  const sorted = useMemo(
    () => [...draws].sort((a, b) => b.drawDate.localeCompare(a.drawDate)).slice(0, windowSize),
    [draws, windowSize]
  );

  const cellSize = 14;
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => i + min);

  const isHit = (term: string, number: number) => {
    const draw = sorted.find((d) => d.drawTerm === term);
    return draw?.numbers.includes(number) ?? false;
  };

  const applyCustom = () => {
    setError(null);
    const n = Number(customInput.trim());
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      setError('請輸入正整數');
      return;
    }
    if (n > total) {
      setError(`最多 ${total} 期`);
      return;
    }
    setWindowSize(n);
  };

  if (total === 0) return null;

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-lg font-bold">📈 號碼走勢 (近 {windowSize} 期)</h3>
        <div className="flex flex-wrap gap-1 text-xs items-end">
          {PRESETS.map((n) => (
            <button
              key={n}
              onClick={() => {
                setWindowSize(Math.min(n, total));
                setError(null);
              }}
              disabled={n > total}
              className={`px-2 py-1 rounded ${
                windowSize === n
                  ? 'bg-brand text-white'
                  : n > total
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                    : 'bg-gray-100 dark:bg-gray-700'
              }`}
            >
              {n} 期
            </button>
          ))}
          <input
            type="number"
            min={1}
            max={total}
            value={customInput}
            onChange={(e) => {
              setCustomInput(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
            placeholder="自訂"
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-20 bg-white dark:bg-gray-700"
          />
          <button
            onClick={applyCustom}
            className="px-2 py-1 rounded bg-brand text-white"
          >
            套用
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mb-2">⚠ {error}</p>}

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
                      hit ? 'bg-red-500' : 'bg-gray-50 dark:bg-gray-700/30'
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

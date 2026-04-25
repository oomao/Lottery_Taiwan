import { useMemo, useState } from 'react';
import type { Draw, GameConfig } from '@/lib/types';
import { computeFrequency } from '@/lib/stats/frequency';
import Ball from '@/components/ui/Ball';
import SavedNumbersList from './SavedNumbersList';

interface Props {
  draws: Draw[];
  game: GameConfig;
}

type Mode = 'random' | 'hot' | 'cold' | 'gap';

const MODES: { key: Mode; label: string; desc: string }[] = [
  { key: 'random', label: '純隨機', desc: '完全均勻分布' },
  { key: 'hot', label: '熱號加權', desc: '熱門號碼機率較高' },
  { key: 'cold', label: '冷號加權', desc: '冷門號碼機率較高' },
  { key: 'gap', label: '遺漏值加權', desc: '久未開的號碼機率較高' },
];

// 依權重抽出 k 個不重複數字 (Weighted Reservoir / 累加抽樣)
function weightedSample(weights: Map<number, number>, k: number): number[] {
  const result: number[] = [];
  const remaining = new Map(weights);
  for (let i = 0; i < k; i++) {
    const total = Array.from(remaining.values()).reduce((s, v) => s + v, 0);
    if (total <= 0 || remaining.size === 0) break;
    let r = Math.random() * total;
    let chosen = -1;
    for (const [n, w] of remaining) {
      r -= w;
      if (r <= 0) {
        chosen = n;
        break;
      }
    }
    if (chosen < 0) chosen = Array.from(remaining.keys())[0];
    result.push(chosen);
    remaining.delete(chosen);
  }
  return result.sort((a, b) => a - b);
}

export default function NumberPicker({ draws, game }: Props) {
  const [mode, setMode] = useState<Mode>('random');
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [setsToGenerate, setSetsToGenerate] = useState(1);
  const [results, setResults] = useState<number[][]>([]);

  const [min, max] = game.numberRange;
  const allNumbers = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => i + min),
    [min, max]
  );
  const stats = useMemo(() => computeFrequency(draws, game), [draws, game]);

  const generate = () => {
    const candidates = allNumbers.filter((n) => !excluded.has(n));
    if (candidates.length < game.pickCount) {
      alert(`排除太多了!至少要保留 ${game.pickCount} 個號碼,目前只剩 ${candidates.length} 個`);
      return;
    }
    if (draws.length === 0 && mode !== 'random') {
      alert('尚無歷史資料,加權選號需要資料才能計算,請先用「純隨機」或等資料抓取完成');
      return;
    }

    const out: number[][] = [];
    for (let i = 0; i < setsToGenerate; i++) {
      const weights = new Map<number, number>();
      candidates.forEach((n) => {
        const stat = stats.find((s) => s.number === n);
        const count = stat?.count ?? 0;
        const gap = stat?.gap ?? 0;
        let w: number;
        switch (mode) {
          case 'random':
            w = 1;
            break;
          case 'hot':
            // 熱:出現次數 + 1 為權重
            w = count + 1;
            break;
          case 'cold':
            // 冷:用最大次數倒推
            w = Math.max(1, 50 - count);
            break;
          case 'gap':
            // 遺漏越大權重越大
            w = gap + 1;
            break;
        }
        weights.set(n, w);
      });
      out.push(weightedSample(weights, game.pickCount));
    }
    setResults(out);
  };

  const toggleExclude = (n: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  };

  const clearExcluded = () => setExcluded(new Set());

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-lg font-bold mb-3">🎰 選號工具</h3>

        <div className="mb-4">
          <p className="text-sm font-medium mb-2">選號方式</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`p-3 rounded border text-left transition ${
                  mode === m.key
                    ? 'border-brand bg-brand/10 dark:bg-brand/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-sm">{m.label}</div>
                <div className="text-xs text-gray-500 mt-1">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium">
              排除號碼 {excluded.size > 0 && <span className="text-gray-500">(已排 {excluded.size} 個)</span>}
            </p>
            {excluded.size > 0 && (
              <button onClick={clearExcluded} className="text-xs text-brand hover:underline">
                清除排除
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allNumbers.map((n) => {
              const isExcluded = excluded.has(n);
              return (
                <button
                  key={n}
                  onClick={() => toggleExclude(n)}
                  className={`w-9 h-9 rounded-full text-xs font-medium border-2 transition ${
                    isExcluded
                      ? 'bg-gray-200 text-gray-400 border-gray-300 line-through dark:bg-gray-700 dark:text-gray-500'
                      : 'bg-white border-gray-300 hover:border-brand dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium">產生組數:</label>
          <select
            value={setsToGenerate}
            onChange={(e) => setSetsToGenerate(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-sm"
          >
            {[1, 3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n} 組
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={generate}
          className="w-full py-3 bg-brand hover:bg-brand-dark text-white font-bold rounded-lg transition"
        >
          🎲 產生號碼
        </button>
      </div>

      {results.length > 0 && (
        <div className="card">
          <h4 className="font-bold mb-3">產生結果</h4>
          <div className="space-y-3">
            {results.map((combo, i) => (
              <ResultRow key={i} index={i} numbers={combo} game={game} />
            ))}
          </div>
        </div>
      )}

      <SavedNumbersList game={game} />
    </div>
  );
}

function ResultRow({
  index,
  numbers,
  game,
}: {
  index: number;
  numbers: number[];
  game: GameConfig;
}) {
  const [saved, setSaved] = useState(false);

  const save = () => {
    const key = `lottery_saved_${game.id}`;
    const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as Array<{
      numbers: number[];
      savedAt: string;
    }>;
    existing.push({ numbers, savedAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(existing));
    setSaved(true);
    window.dispatchEvent(new Event('lottery_saved_updated'));
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-gray-400 text-sm w-8">#{index + 1}</span>
      <div className="flex gap-2 flex-wrap">
        {numbers.map((n) => (
          <Ball key={n} number={n} color={game.ballColor} size="md" />
        ))}
      </div>
      <button
        onClick={save}
        disabled={saved}
        className={`ml-auto px-3 py-1 text-xs rounded ${
          saved
            ? 'bg-gray-200 text-gray-500 dark:bg-gray-700'
            : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
        }`}
      >
        {saved ? '✓ 已收藏' : '☆ 收藏'}
      </button>
    </div>
  );
}

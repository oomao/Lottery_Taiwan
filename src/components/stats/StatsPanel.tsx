import { useMemo, useState } from 'react';
import type { Draw, GameConfig } from '@/lib/types';
import FrequencyChart from './FrequencyChart';
import HotColdNumbers from './HotColdNumbers';
import GapTable from './GapTable';
import TrendHeatmap from './TrendHeatmap';
import CharacteristicAnalysis from './CharacteristicAnalysis';

interface Props {
  draws: Draw[];
  game: GameConfig;
}

const PRESETS = [
  { label: '近 30 期', value: 30 },
  { label: '近 100 期', value: 100 },
  { label: '近 300 期', value: 300 },
  { label: '全部', value: null },
];

export default function StatsPanel({ draws, game }: Props) {
  const total = draws.length;
  const [window, setWindow] = useState<number | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 防呆:目前生效的視窗(顯示用)
  const effectiveWindow = useMemo(() => {
    if (window == null) return total;
    return Math.min(window, total);
  }, [window, total]);

  const applyCustom = () => {
    setError(null);
    const trimmed = customInput.trim();
    if (!trimmed) {
      setError('請輸入期數');
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      setError('請輸入整數');
      return;
    }
    if (n < 1) {
      setError('期數至少 1');
      return;
    }
    if (n > total) {
      setError(`目前只有 ${total} 期歷史資料,請輸入 ≤ ${total}`);
      return;
    }
    setWindow(n);
  };

  const applyPreset = (value: number | null) => {
    setError(null);
    setCustomInput('');
    setWindow(value);
  };

  if (total === 0) {
    return (
      <div className="card text-center py-8 text-gray-500">
        尚無資料,請先執行資料抓取
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold">統計範圍</h3>
          <span className="text-xs text-gray-500">
            目前資料庫共 <strong>{total}</strong> 期
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 mr-1">快選:</span>
          {PRESETS.map((p) => {
            const active = window === p.value;
            const disabled = p.value != null && p.value > total;
            return (
              <button
                key={p.label}
                onClick={() => applyPreset(p.value)}
                disabled={disabled}
                className={`px-3 py-1.5 text-xs rounded ${
                  active
                    ? 'bg-brand text-white'
                    : disabled
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={disabled ? `資料不足 ${p.value} 期` : ''}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">自訂期數 (1–{total})</label>
            <input
              type="number"
              min={1}
              max={total}
              step={1}
              value={customInput}
              onChange={(e) => {
                setCustomInput(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
              placeholder="例如 50"
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-sm w-32"
            />
          </div>
          <button
            onClick={applyCustom}
            className="px-3 py-1.5 text-sm bg-brand hover:bg-brand-dark text-white rounded"
          >
            套用
          </button>
          {error && <span className="text-xs text-red-600 self-center">⚠ {error}</span>}
        </div>

        <div className="text-xs text-gray-500 pt-1">
          ✓ 已套用:近 <strong className="text-brand">{effectiveWindow}</strong> 期
        </div>
      </div>

      <FrequencyChart draws={draws} game={game} window={window ?? undefined} />
      <HotColdNumbers draws={draws} game={game} window={window ?? undefined} />
      <GapTable draws={draws} game={game} />
      <TrendHeatmap draws={draws} game={game} />
      <CharacteristicAnalysis draws={draws} game={game} window={window ?? undefined} />
    </div>
  );
}

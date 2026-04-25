import { useMemo, useState } from 'react';
import type { Draw, GameConfig } from '@/lib/types';
import {
  recommend,
  expectedRandomCount,
  type RecommendMethod,
  type ComboScore,
} from '@/lib/stats/recommend';
import Ball from '@/components/ui/Ball';

interface Props {
  draws: Draw[];
  game: GameConfig;
}

type ComboK = 2 | 3 | 4;

const COMBO_LABELS: Record<ComboK, string> = {
  2: '二合',
  3: '三合',
  4: '四合',
};

const METHODS: { key: RecommendMethod; label: string; desc: string }[] = [
  { key: 'composite', label: '🏆 綜合推薦', desc: '加權近期/邊際/共現/馬可夫的綜合分數 (預設)' },
  { key: 'frequency', label: '📊 純頻率', desc: '歷史出現次數最多的組合' },
  { key: 'weighted', label: '⚡ 衰減加權', desc: '近期出現權重更高 (decay 0.97)' },
  { key: 'gap', label: '⏳ 遺漏值', desc: '最久沒出現的組合 (賭徒謬誤,但彩迷愛看)' },
  { key: 'marginal', label: '🎯 邊際機率', desc: '依單號頻率推導,適合稀疏的四合' },
  { key: 'lift', label: '🔗 共現分析 (Lift)', desc: '組合內號碼互相正關聯的程度' },
  { key: 'markov', label: '🔄 馬可夫鏈', desc: '給定上期開獎,預測下期條件機率' },
];

const WINDOW_PRESETS = [
  { label: '近 100 期', value: 100 },
  { label: '近 300 期', value: 300 },
  { label: '近 500 期', value: 500 },
  { label: '全部', value: null },
];

const TOP_N_OPTIONS = [10, 20, 50, 100];

export default function ComboRecommend({ draws, game }: Props) {
  const [k, setK] = useState<ComboK>(2);
  const [method, setMethod] = useState<RecommendMethod>('composite');
  const [window, setWindow] = useState<number | null>(null);
  const [customWindow, setCustomWindow] = useState('');
  const [topN, setTopN] = useState(20);
  const [filterNum, setFilterNum] = useState('');
  const [error, setError] = useState<string | null>(null);

  const total = draws.length;
  const effectiveWindow = window ?? total;

  const mustContain = useMemo(() => {
    if (!filterNum.trim()) return undefined;
    const [min, max] = game.numberRange;
    const tokens = filterNum.trim().split(/[\s,\uFF0C\u3001;]+/).filter(Boolean);
    const nums = tokens.map((t) => Number(t)).filter((n) => Number.isInteger(n) && n >= min && n <= max);
    return nums.length > 0 ? nums : undefined;
  }, [filterNum, game.numberRange]);

  const results = useMemo(() => {
    if (total === 0) return [];
    return recommend(draws, game, k, method, {
      window: window ?? undefined,
      topN,
      mustContain,
    });
  }, [draws, game, k, method, window, topN, mustContain]);

  const baseline = useMemo(
    () => expectedRandomCount(effectiveWindow, k, game),
    [effectiveWindow, k, game]
  );

  const applyCustomWindow = () => {
    setError(null);
    const n = Number(customWindow.trim());
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      setError('請輸入正整數');
      return;
    }
    if (n > total) {
      setError(`最多 ${total} 期`);
      return;
    }
    setWindow(n);
  };

  if (total === 0) {
    return (
      <div className="card text-center py-8 text-gray-500">
        尚無資料,請先到 GitHub Actions 觸發資料抓取
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 控制區 */}
      <div className="card space-y-4">
        {/* 合數選擇 */}
        <div>
          <p className="text-sm font-medium mb-2">類型</p>
          <div className="flex gap-2">
            {([2, 3, 4] as ComboK[]).map((n) => (
              <button
                key={n}
                onClick={() => setK(n)}
                className={`px-4 py-2 rounded-lg font-bold transition ${
                  k === n
                    ? 'bg-brand text-white shadow'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {COMBO_LABELS[n]}
              </button>
            ))}
          </div>
        </div>

        {/* 方法選擇 */}
        <div>
          <p className="text-sm font-medium mb-2">演算法</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                className={`p-3 rounded border text-left transition ${
                  method === m.key
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

        {/* 視窗 + Top N + 篩選 */}
        <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">統計範圍</label>
            <div className="flex gap-1 flex-wrap">
              {WINDOW_PRESETS.map((p) => {
                const disabled = p.value != null && p.value > total;
                return (
                  <button
                    key={p.label}
                    onClick={() => {
                      if (disabled) return;
                      setWindow(p.value);
                      setCustomWindow('');
                      setError(null);
                    }}
                    disabled={disabled}
                    className={`px-2 py-1 text-xs rounded ${
                      window === p.value
                        ? 'bg-brand text-white'
                        : disabled
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">自訂期數 (1–{total})</label>
            <div className="flex gap-1">
              <input
                type="number"
                min={1}
                max={total}
                value={customWindow}
                onChange={(e) => {
                  setCustomWindow(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && applyCustomWindow()}
                placeholder="例 200"
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-sm w-24"
              />
              <button
                onClick={applyCustomWindow}
                className="px-2 py-1 text-xs bg-brand text-white rounded"
              >
                套用
              </button>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">顯示前</label>
            <select
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-sm"
            >
              {TOP_N_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} 組
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col flex-1 min-w-[160px]">
            <label className="text-xs text-gray-500 mb-1">
              只看含號 (空格分隔,選填)
            </label>
            <input
              type="text"
              value={filterNum}
              onChange={(e) => setFilterNum(e.target.value)}
              placeholder="例 7 23"
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-sm"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-600">⚠ {error}</p>}

        <div className="text-xs text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-3">
          <span>
            ✓ 統計範圍:近 <strong className="text-brand">{effectiveWindow}</strong> 期
          </span>
          <span>
            🎲 隨機基準:該 {COMBO_LABELS[k]} 組合期望出現{' '}
            <strong>{baseline.toFixed(2)}</strong> 次
          </span>
        </div>
      </div>

      {/* 結果區 */}
      <ResultList results={results} game={game} method={method} k={k} baseline={baseline} />

      {/* 免責聲明 */}
      <div className="card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200">
        <p className="font-bold mb-1">⚠️ 提醒</p>
        <p className="text-xs leading-relaxed">
          樂透為獨立隨機事件,以上演算法找出的是「歷史微小偏差」,並不能真正提高中獎率。
          隨著抽樣增加,所有組合會回歸到 1/{game.numberRange[1]} 系列的真實機率。請理性參考、量力而為。
        </p>
      </div>
    </div>
  );
}

interface ResultListProps {
  results: ComboScore[];
  game: GameConfig;
  method: RecommendMethod;
  k: ComboK;
  baseline: number;
}

function ResultList({ results, game, method, k, baseline }: ResultListProps) {
  if (results.length === 0) {
    return (
      <div className="card text-center py-6 text-gray-500">
        沒有符合條件的組合
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <h3 className="text-lg font-bold mb-3">推薦結果 ({COMBO_LABELS[k]})</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">組合</th>
            <th className="py-2 pr-2 text-right">主分數</th>
            <th className="py-2 pr-2 text-right">出現</th>
            <th className="py-2 pr-2 text-right">遺漏</th>
            <th className="py-2 pr-2 text-right hidden md:table-cell">邊際</th>
            <th className="py-2 pr-2 text-right hidden md:table-cell">Lift</th>
            <th className="py-2 pr-2 text-right hidden lg:table-cell">Markov</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => {
            const aboveBase = r.count > baseline;
            return (
              <tr
                key={r.combo.join('-')}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td className="py-2 pr-2 text-gray-400">#{i + 1}</td>
                <td className="py-2 pr-2">
                  <div className="flex gap-1 flex-wrap">
                    {r.combo.map((n) => (
                      <Ball key={n} number={n} color={game.ballColor} size="sm" />
                    ))}
                  </div>
                </td>
                <td className="py-2 pr-2 text-right font-mono font-bold text-brand">
                  {formatScore(r.score, method)}
                </td>
                <td className="py-2 pr-2 text-right">
                  {r.isObserved ? (
                    <span className={aboveBase ? 'text-red-600 font-medium' : ''}>
                      {r.count} 次
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">未出現</span>
                  )}
                </td>
                <td className="py-2 pr-2 text-right">
                  {isFinite(r.gap) ? `${r.gap} 期` : '—'}
                </td>
                <td className="py-2 pr-2 text-right hidden md:table-cell font-mono text-xs text-gray-500">
                  {(r.marginal * 100).toFixed(3)}%
                </td>
                <td className="py-2 pr-2 text-right hidden md:table-cell font-mono text-xs text-gray-500">
                  {r.lift.toFixed(2)}
                </td>
                <td className="py-2 pr-2 text-right hidden lg:table-cell font-mono text-xs text-gray-500">
                  {(r.markov * 100).toFixed(3)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatScore(score: number, method: RecommendMethod): string {
  switch (method) {
    case 'frequency':
      return score.toFixed(0);
    case 'gap':
      return `${score.toFixed(0)}`;
    case 'weighted':
      return score.toFixed(2);
    case 'marginal':
    case 'markov':
      return `${(score * 100).toFixed(3)}%`;
    case 'lift':
      return score.toFixed(2);
    case 'composite':
      return score.toFixed(3);
  }
}

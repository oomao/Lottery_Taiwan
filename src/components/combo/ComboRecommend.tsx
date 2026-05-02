import { useMemo, useState } from 'react';
import type { Draw, GameConfig } from '@/lib/types';
import {
  recommend,
  expectedRandomCount,
  COMPOSITE_WEIGHTS,
  type RecommendMethod,
  type ComboScore,
  type ComboK,
} from '@/lib/stats/recommend';
import Ball from '@/components/ui/Ball';

interface Props {
  draws: Draw[];
  game: GameConfig;
}

const COMBO_LABELS: Record<ComboK, string> = {
  1: '單號',
  2: '二合',
  3: '三合',
  4: '四合',
  5: '五合',
};

interface MethodInfo {
  key: RecommendMethod;
  label: string;
  desc: string;       // 一行短說明 (按鈕顯示)
  detail: string;     // 詳細解釋 (點選後展開)
  bestFor: string;    // 適合什麼合數
  caveat?: string;    // 注意事項
}

const METHODS: MethodInfo[] = [
  {
    key: 'composite',
    label: '🏆 綜合推薦',
    desc: '加權近期/邊際/共現/馬可夫的綜合分數 (預設)',
    detail: '把「衰減加權 30% + 邊際機率 30% + Lift 共現 20% + 馬可夫 20%」四種方法的分數標準化到 [0,1] 後加權平均。試圖避免單一方法的偏差,給出折衷推薦。',
    bestFor: '不確定該用什麼時的安全選擇',
  },
  {
    key: 'frequency',
    label: '📊 純頻率',
    desc: '歷史出現次數最多的組合',
    detail: '只算這個組合在統計範圍內出現過幾次。最簡單也最直觀,但對 4/5 合來說多數組合都是 0 次,沒鑑別力。',
    bestFor: '單號 / 二合 (有足夠樣本)',
    caveat: '對 3/4/5 合資料太稀疏',
  },
  {
    key: 'weighted',
    label: '⚡ 衰減加權',
    desc: '近期出現權重更高 (decay 0.97)',
    detail: '每出現一次給一個權重,但越久遠的權重越低 (weight = 0.97^期距)。比純頻率更關注近期表現。',
    bestFor: '單號 / 二合,想看「最近熱」的組合',
  },
  {
    key: 'gap',
    label: '⏳ 遺漏值',
    desc: '最久沒出現的組合',
    detail: '依「距離上次出現幾期」排序,最久沒開的排前面。彩迷俗稱「該開了」。',
    bestFor: '想押冷組合的玩家',
    caveat: '⚠️ 賭徒謬誤 — 過去未出現不代表下次更可能出',
  },
  {
    key: 'marginal',
    label: '🎯 邊際機率',
    desc: '依單號頻率推導,適合稀疏的四/五合',
    detail: 'P(組合) ≈ Π P(單號出現)。即使這個組合從未出現過,也能由「組成它的單號各自的頻率」估出機率。',
    bestFor: '🎉 四合 / 五合 (其他方法失效時的解法)',
  },
  {
    key: 'lift',
    label: '🔗 共現分析 (Lift)',
    desc: '組合內號碼互相正關聯的程度',
    detail: 'Lift(A,B) = P(A,B) / (P(A)×P(B))。> 1 表示 A 和 B 比獨立預期更常一起出現,< 1 表示比較少。組合分數 = 所有號碼對 lift 的幾何平均。',
    bestFor: '二合、三合 (尋找「有伴」的號碼)',
    caveat: '⚠️ 單號 (k=1) 沒有 pair,Lift 永遠 = 1 沒鑑別力',
  },
  {
    key: 'markov',
    label: '🔄 馬可夫鏈',
    desc: '給定上期開獎,預測下期條件機率',
    detail: '建立 39×39 轉移矩陣 T,T[a][b] = P(下期含 b | 本期含 a)。組合分數 = 各號碼在「上期任一號條件下」的最大條件機率連乘。',
    bestFor: '想結合「上期開了什麼」做動態預測',
    caveat: '一階馬可夫,看不到 2 期前以上的依賴',
  },
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

  const results = useMemo<ComboScore[]>(() => {
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
          <div className="flex flex-wrap gap-2">
            {([1, 2, 3, 4, 5] as ComboK[]).map((n) => (
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

          {/* 詳細說明 (依當前選擇的方法) */}
          <MethodDetail info={METHODS.find((m) => m.key === method)!} k={k} />
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
            <strong>{formatBaseline(baseline)}</strong> 次
          </span>
        </div>
      </div>

      {/* 結果區 */}
      <ResultList results={results} game={game} method={method} k={k} baseline={baseline} />

      {/* 提示使用者 ML 在哪 */}
      <div className="card bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-sm text-purple-900 dark:text-purple-200">
        <p className="font-bold mb-1">🤖 想看 ML 模型 (LSTM / XGBoost) 的推薦?</p>
        <p className="text-xs">
          切換到上方「ML 模型」分頁,可看完整評估指標、p-value、隨機基準對比、與下期 Top 10 號碼。
        </p>
      </div>

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

function MethodDetail({ info, k }: { info: MethodInfo; k: ComboK }) {
  const isComposite = info.key === 'composite';
  const w = COMPOSITE_WEIGHTS[k];

  return (
    <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm space-y-2">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="font-bold text-blue-900 dark:text-blue-200">{info.label}</p>
        <span className="text-xs text-blue-700 dark:text-blue-300">適合:{info.bestFor}</span>
      </div>
      <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
        {info.detail}
      </p>

      {/* composite 時額外顯示當前 k 的權重 */}
      {isComposite && (
        <div className="text-xs bg-white dark:bg-gray-800 rounded p-2 border border-blue-100 dark:border-blue-900">
          <p className="font-medium mb-1">
            目前 {COMBO_LABELS[k]} 的綜合權重:
          </p>
          <div className="flex flex-wrap gap-3 font-mono text-[11px]">
            <span>衰減 <strong>{(w.weighted * 100).toFixed(0)}%</strong></span>
            <span>邊際 <strong>{(w.marginal * 100).toFixed(0)}%</strong></span>
            <span>Lift <strong>{(w.lift * 100).toFixed(0)}%</strong></span>
            <span>馬可夫 <strong>{(w.markov * 100).toFixed(0)}%</strong></span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1 leading-snug">
            {k === 1 && '單號樣本最豐富,加權頻率主導;沒有 pair → Lift 不參與'}
            {k === 2 && '二合資料豐富,各方法均衡 (頻率類給高權重)'}
            {k === 3 && '三合資料中等,稍偏向可推導的邊際/Lift'}
            {k === 4 && '四合資料極稀疏,邊際機率成為主力 (55%)'}
            {k === 5 && '五合 (= 完整一期) 觀察率 < 0.2%,邊際機率完全主導 (60%)'}
          </p>
        </div>
      )}

      {info.caveat && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {info.caveat}
        </p>
      )}
      <p className="text-[11px] text-gray-500 pt-1 border-t border-blue-200 dark:border-blue-800">
        💡 想看每個方法的數學細節?到{' '}
        <a
          href="https://github.com/oomao/Lottery_Taiwan#-演算法說明"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-brand"
        >
          README 演算法章節
        </a>{' '}
        看完整說明。
      </p>
    </div>
  );
}

function formatBaseline(n: number): string {
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(3);
  if (n > 0) return n.toFixed(4);
  return '0';
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

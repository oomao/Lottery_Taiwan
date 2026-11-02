import { useMemo, useState } from 'react';
import type { Draw, GameConfig } from '@/lib/types';
import { computeDrag, type DragMode, type DragRow } from '@/lib/stats/drag';
import Ball from '@/components/ui/Ball';

interface Props {
  draws: Draw[];
  game: GameConfig;
}

const LAG_PRESETS: { label: string; from: number; to: number }[] = [
  { label: '下 1 期', from: 1, to: 1 },
  { label: '下 2 期', from: 2, to: 2 },
  { label: '下 3 期', from: 3, to: 3 },
  { label: '2 期內', from: 1, to: 2 },
  { label: '3 期內', from: 1, to: 3 },
];

const WINDOW_PRESETS = [
  { label: '近 100 期', value: 100 },
  { label: '近 300 期', value: 300 },
  { label: '近 500 期', value: 500 },
  { label: '全部', value: null as number | null },
];

// 觸發次數太少時機率不可靠
const MIN_TRIALS = 30;

export default function DragNumbers({ draws, game }: Props) {
  const [min, max] = game.numberRange;
  const allNumbers = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => i + min),
    [min, max]
  );

  const latest = useMemo(
    () => [...draws].sort((a, b) => b.drawDate.localeCompare(a.drawDate))[0],
    [draws]
  );

  // 預設帶入最新一期:直接回答「下一期拖什麼牌」
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(latest?.numbers ?? [])
  );
  const [lagIdx, setLagIdx] = useState(0);
  const [mode, setMode] = useState<DragMode>('each');
  const [windowSize, setWindowSize] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const total = draws.length;
  const lag = LAG_PRESETS[lagIdx];
  const selectedArr = useMemo(
    () => Array.from(selected).sort((a, b) => a - b),
    [selected]
  );

  const result = useMemo(() => {
    if (selectedArr.length === 0 || total === 0) return null;
    return computeDrag(draws, selectedArr, game.numberRange, {
      window: windowSize ?? undefined,
      lagFrom: lag.from,
      lagTo: lag.to,
      mode,
    });
  }, [draws, selectedArr, game.numberRange, windowSize, lag, mode, total]);

  const toggle = (n: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });

  if (total === 0) {
    return (
      <div className="card text-center py-8 text-gray-500">
        尚無資料,請先到 GitHub Actions 觸發資料抓取
      </div>
    );
  }

  const rows = result ? (showAll ? result.rows : result.rows.slice(0, 15)) : [];
  const fewTrials = result != null && result.triggerDraws < MIN_TRIALS;

  return (
    <div className="space-y-4">
      {/* 控制區 */}
      <div className="card space-y-4">
        <div>
          <h3 className="text-lg font-bold">🧲 拖牌分析</h3>
          <p className="text-xs text-gray-500 mt-1">
            某期開出你選的號碼後,下一期 / 下兩期各號碼開出的機率,並和平常的開出機率比較。
          </p>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium">
              觸發號碼{' '}
              {selectedArr.length > 0 && (
                <span className="text-gray-500">(已選 {selectedArr.length} 個)</span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => latest && setSelected(new Set(latest.numbers))}
                className="text-xs text-brand hover:underline"
              >
                帶入最新一期
              </button>
              {selectedArr.length > 0 && (
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-brand hover:underline"
                >
                  清除全部
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allNumbers.map((n) => {
              const isSel = selected.has(n);
              return (
                <button
                  key={n}
                  onClick={() => toggle(n)}
                  className={`w-9 h-9 rounded-full text-xs font-bold border-2 transition ${
                    isSel
                      ? 'bg-brand text-white border-brand shadow'
                      : 'bg-white border-gray-300 hover:border-brand dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200'
                  }`}
                >
                  {n.toString().padStart(2, '0')}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">看哪一期</label>
            <div className="flex gap-1 flex-wrap">
              {LAG_PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => setLagIdx(i)}
                  className={`px-3 py-1.5 text-sm rounded font-bold transition ${
                    lagIdx === i
                      ? 'bg-brand text-white'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {selectedArr.length > 1 && (
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">多個觸發號碼</label>
              <div className="flex gap-1">
                {(
                  [
                    { key: 'each', label: '分別算再合併' },
                    { key: 'all', label: '須同期全開' },
                  ] as { key: DragMode; label: string }[]
                ).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className={`px-2 py-1 text-xs rounded ${
                      mode === m.key
                        ? 'bg-brand text-white'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">統計範圍</label>
            <div className="flex gap-1 flex-wrap">
              {WINDOW_PRESETS.map((p) => {
                const disabled = p.value != null && p.value > total;
                return (
                  <button
                    key={p.label}
                    onClick={() => !disabled && setWindowSize(p.value)}
                    disabled={disabled}
                    className={`px-2 py-1 text-xs rounded ${
                      windowSize === p.value
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
        </div>
      </div>

      {selectedArr.length === 0 && (
        <div className="card text-center py-6 text-gray-500 text-sm">
          請至少選 1 個觸發號碼。
        </div>
      )}

      {result && (
        <>
          <div className="card text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              統計近 {result.totalDraws} 期,觸發{' '}
              <strong className="text-brand">{result.triggerDraws}</strong> 次
              {mode === 'each' && selectedArr.length > 1 && ' (各號加總)'}
            </span>
            <span>
              「機率」= 觸發後{lag.label}開出的比例;「平常」= 任意一期後{lag.label}開出的比例
            </span>
          </div>

          {fewTrials && (
            <div className="card text-center py-4 text-amber-700 dark:text-amber-300 text-sm">
              ⚠ 觸發次數只有 {result.triggerDraws} 次,樣本太少,機率參考價值很低。
              {mode === 'all' && ' 可改成「分別算再合併」或減少觸發號碼。'}
            </div>
          )}

          {result.triggerDraws > 0 && (
            <DragTable
              rows={rows}
              game={game}
              lagLabel={lag.label}
              showBreakdown={mode === 'each' && selectedArr.length > 1}
              canShowMore={result.rows.length > 15}
              showAll={showAll}
              onToggleAll={() => setShowAll((v) => !v)}
            />
          )}
        </>
      )}

      <div className="card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200">
        <p className="text-xs leading-relaxed">
          ⚠️ 拖牌是回顧統計:樂透每期獨立隨機,大部分號碼的拖牌機率都會落在「平常」附近,
          偏高多半是樣本波動。z 分數 ≥ 2 只代表在歷史上較顯著,不代表下一期更容易開出,請理性參考。
        </p>
      </div>
    </div>
  );
}

interface DragTableProps {
  rows: DragRow[];
  game: GameConfig;
  lagLabel: string;
  showBreakdown: boolean;
  canShowMore: boolean;
  showAll: boolean;
  onToggleAll: () => void;
}

function DragTable({
  rows,
  game,
  lagLabel,
  showBreakdown,
  canShowMore,
  showAll,
  onToggleAll,
}: DragTableProps) {
  const maxRate = Math.max(...rows.map((r) => r.rate), 0.0001);

  return (
    <div className="card overflow-x-auto">
      <h3 className="text-lg font-bold mb-3">{lagLabel}拖出號碼排行</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">號碼</th>
            <th className="py-2 pr-2 text-right">拖出</th>
            <th className="py-2 pr-2">機率</th>
            <th className="py-2 pr-2 text-right">平常</th>
            <th className="py-2 pr-2 text-right">倍數</th>
            <th className="py-2 pr-2 text-right hidden sm:table-cell">z</th>
            {showBreakdown && <th className="py-2 pr-2 hidden md:table-cell">各觸發號</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const strong = r.z >= 2;
            return (
              <tr
                key={r.number}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td className="py-2 pr-2 text-gray-400">#{i + 1}</td>
                <td className="py-2 pr-2">
                  <Ball number={r.number} color={game.ballColor} size="sm" />
                </td>
                <td className="py-2 pr-2 text-right text-xs text-gray-500 whitespace-nowrap">
                  {r.hits}/{r.trials}
                </td>
                <td className="py-2 pr-2 min-w-[110px]">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      <div
                        className={`h-full ${strong ? 'bg-red-500' : 'bg-brand'}`}
                        style={{ width: `${(r.rate / maxRate) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs w-11 text-right ${strong ? 'text-red-600 font-bold' : ''}`}>
                      {(r.rate * 100).toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="py-2 pr-2 text-right text-xs text-gray-500">
                  {(r.baseline * 100).toFixed(1)}%
                </td>
                <td
                  className={`py-2 pr-2 text-right text-xs ${
                    r.lift >= 1 ? 'text-red-600' : 'text-gray-500'
                  }`}
                >
                  ×{r.lift.toFixed(2)}
                </td>
                <td className="py-2 pr-2 text-right text-xs hidden sm:table-cell text-gray-500">
                  {r.z.toFixed(1)}
                </td>
                {showBreakdown && (
                  <td className="py-2 pr-2 hidden md:table-cell text-[11px] text-gray-500">
                    {r.perTrigger.map((p) => (
                      <span key={p.trigger} className="mr-2 whitespace-nowrap">
                        {p.trigger.toString().padStart(2, '0')}:{p.hits}/{p.trials}
                      </span>
                    ))}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex justify-between items-center mt-2">
        <p className="text-[11px] text-gray-400">
          「倍數」= 機率 ÷ 平常 · 紅色 = z ≥ 2 (相對平常較顯著偏高)
        </p>
        {canShowMore && (
          <button onClick={onToggleAll} className="text-xs text-brand hover:underline">
            {showAll ? '只看前 15 名' : '顯示全部號碼'}
          </button>
        )}
      </div>
    </div>
  );
}

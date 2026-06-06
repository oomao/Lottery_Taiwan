import { useMemo, useState } from 'react';
import type { Draw, GameConfig } from '@/lib/types';
import {
  queryComboHits,
  computeOverlapDistribution,
  nCk,
  type ComboHit,
} from '@/lib/stats/combo';
import { expectedRandomCount } from '@/lib/stats/recommend';
import Ball from '@/components/ui/Ball';

interface Props {
  draws: Draw[];
  game: GameConfig;
}

type K = 2 | 3 | 4 | 5;
const K_LABELS: Record<K, string> = { 2: '二合', 3: '三合', 4: '四合', 5: '五合' };

const WINDOW_PRESETS = [
  { label: '近 100 期', value: 100 },
  { label: '近 300 期', value: 300 },
  { label: '近 500 期', value: 500 },
  { label: '全部', value: null as number | null },
];

// 安全上限,避免使用者選太多號碼 + 高合數時一次枚舉爆量 (例 C(39,5)=575,757)
const MAX_COMBOS = 30000;

export default function MyNumbersLookup({ draws, game }: Props) {
  const [min, max] = game.numberRange;
  const allNumbers = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => i + min),
    [min, max]
  );

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [textInput, setTextInput] = useState('');
  const [k, setK] = useState<K>(2);
  const [windowSize, setWindowSize] = useState<number | null>(null);
  const [showMissing, setShowMissing] = useState(false);

  const total = draws.length;
  const effectiveWindow = windowSize ?? total;

  const selectedArr = useMemo(
    () => Array.from(selected).sort((a, b) => a - b),
    [selected]
  );

  const latest = useMemo(
    () => [...draws].sort((a, b) => b.drawDate.localeCompare(a.drawDate))[0],
    [draws]
  );

  // k 上限隨選號數調整;若目前 k 超出可用範圍則夾回
  const availableKs = ([2, 3, 4, 5] as K[]).filter((kk) => kk <= game.pickCount);
  const usableKs = availableKs.filter((kk) => kk <= selectedArr.length);
  const effectiveK: K = usableKs.includes(k)
    ? k
    : usableKs[usableKs.length - 1] ?? 2;

  const comboTotal = nCk(selectedArr.length, effectiveK);
  const tooMany = comboTotal > MAX_COMBOS;

  const hits = useMemo<ComboHit[]>(() => {
    if (selectedArr.length < effectiveK || tooMany || total === 0) return [];
    return queryComboHits(draws, selectedArr, effectiveK, {
      window: windowSize ?? undefined,
    });
  }, [draws, selectedArr, effectiveK, windowSize, tooMany, total]);

  const appeared = useMemo(() => hits.filter((h) => h.count > 0), [hits]);
  const shown = showMissing ? hits : appeared;

  const baseline = useMemo(
    () => expectedRandomCount(effectiveWindow, effectiveK, game),
    [effectiveWindow, effectiveK, game]
  );

  const overlap = useMemo(
    () =>
      selectedArr.length > 0 && total > 0
        ? computeOverlapDistribution(draws, selectedArr, {
            window: windowSize ?? undefined,
          })
        : null,
    [draws, selectedArr, windowSize, total]
  );

  const toggle = (n: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });

  const applyText = () => {
    const tokens = textInput.split(/[\s,，、;]+/).filter(Boolean);
    const valid = tokens
      .map((t) => Number(t))
      .filter((x) => Number.isInteger(x) && x >= min && x <= max);
    if (valid.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      valid.forEach((n) => next.add(n));
      return next;
    });
    setTextInput('');
  };

  const fillLatest = () => {
    if (latest) setSelected(new Set(latest.numbers));
  };

  const clearAll = () => setSelected(new Set());

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
        <div>
          <h3 className="text-lg font-bold">🔍 號碼查合</h3>
          <p className="text-xs text-gray-500 mt-1">
            選你想包的號碼,看這些號碼彼此的二/三/四合在歷史上同時開出過幾次。
          </p>
        </div>

        {/* 文字輸入 + 快捷 */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col flex-1 min-w-[180px]">
            <label className="text-xs text-gray-500 mb-1">
              輸入號碼 (空格或逗號分隔,例 01,03,05)
            </label>
            <div className="flex gap-1">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyText()}
                placeholder="例 1 3 5 7 9"
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-sm flex-1"
              />
              <button
                onClick={applyText}
                className="px-3 py-1 text-sm bg-brand text-white rounded whitespace-nowrap"
              >
                加入
              </button>
            </div>
          </div>
          <button
            onClick={fillLatest}
            className="px-3 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            帶入上期 ({latest?.numbers.length ?? 0} 號)
          </button>
        </div>

        {/* 號碼格 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium">
              點選號碼{' '}
              {selectedArr.length > 0 && (
                <span className="text-gray-500">(已選 {selectedArr.length} 個)</span>
              )}
            </p>
            {selectedArr.length > 0 && (
              <button onClick={clearAll} className="text-xs text-brand hover:underline">
                清除全部
              </button>
            )}
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

        {/* 合數 + 範圍 + 顯示 */}
        <div className="flex flex-wrap items-end gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">看幾合</label>
            <div className="flex gap-1">
              {availableKs.map((kk) => {
                const disabled = kk > selectedArr.length;
                return (
                  <button
                    key={kk}
                    onClick={() => !disabled && setK(kk)}
                    disabled={disabled}
                    title={disabled ? `需選至少 ${kk} 個號碼` : ''}
                    className={`px-3 py-1.5 text-sm rounded font-bold transition ${
                      effectiveK === kk && !disabled
                        ? 'bg-brand text-white'
                        : disabled
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {K_LABELS[kk]}
                  </button>
                );
              })}
            </div>
          </div>

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

          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showMissing}
              onChange={(e) => setShowMissing(e.target.checked)}
              className="accent-brand"
            />
            顯示未出現的組合
          </label>
        </div>
      </div>

      {/* 提示:選太少 / 太多 */}
      {selectedArr.length < 2 && (
        <div className="card text-center py-6 text-gray-500 text-sm">
          請至少選 2 個號碼,才能看二合。選越多號碼可看的三合 / 四合越多。
        </div>
      )}

      {tooMany && (
        <div className="card text-center py-6 text-amber-700 dark:text-amber-300 text-sm">
          ⚠ 選的號碼太多 ({selectedArr.length} 個 → {K_LABELS[effectiveK]}{' '}
          共 {comboTotal.toLocaleString()} 種組合)。請減少號碼或改看較低合數。
        </div>
      )}

      {/* 牌組命中分布 */}
      {!tooMany && overlap && selectedArr.length >= 2 && (
        <OverlapSummary
          overlap={overlap}
          selectedCount={selectedArr.length}
          pickCount={game.pickCount}
        />
      )}

      {/* 結果 */}
      {!tooMany && selectedArr.length >= effectiveK && (
        <>
          <div className="card text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              {K_LABELS[effectiveK]}共{' '}
              <strong className="text-brand">{comboTotal.toLocaleString()}</strong> 種,
              出現過{' '}
              <strong className="text-red-600">{appeared.length}</strong> 種
              {comboTotal > 0 && (
                <span>
                  {' '}
                  ({((appeared.length / comboTotal) * 100).toFixed(0)}%)
                </span>
              )}
            </span>
            <span>
              🎲 隨機基準:每種 {K_LABELS[effectiveK]} 在近 {effectiveWindow} 期期望出現{' '}
              <strong>{formatBaseline(baseline)}</strong> 次
            </span>
          </div>

          <ResultList
            rows={shown}
            game={game}
            kLabel={K_LABELS[effectiveK]}
            baseline={baseline}
            totalDraws={effectiveWindow}
            hasMissing={appeared.length < hits.length}
            showMissing={showMissing}
          />
        </>
      )}

      {/* 免責 */}
      <div className="card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200">
        <p className="text-xs leading-relaxed">
          ⚠️ 這裡呈現的是「歷史上這些號碼曾經同時開出的紀錄」,屬於回顧統計。
          樂透每期獨立隨機,過去同開不代表未來更容易再同開,請理性參考。
        </p>
      </div>
    </div>
  );
}

function OverlapSummary({
  overlap,
  selectedCount,
  pickCount,
}: {
  overlap: { totalDraws: number; counts: number[] };
  selectedCount: number;
  pickCount: number;
}) {
  const { totalDraws, counts } = overlap;
  // 最多可能同時命中 = min(選號數, 每期開幾顆)
  const maxHit = Math.min(selectedCount, pickCount);
  // 累積:至少命中 i 顆的期數
  const atLeast = (i: number) =>
    counts.slice(i).reduce((s, v) => s + v, 0);

  // 顯示 ≥2 ~ =maxHit
  const rows: { label: string; draws: number }[] = [];
  for (let i = 2; i <= maxHit; i++) {
    rows.push({
      label: i === maxHit ? `命中全部 ${i} 顆` : `命中 ≥ ${i} 顆`,
      draws: atLeast(i),
    });
  }

  return (
    <div className="card">
      <h4 className="text-sm font-bold mb-2">
        🎯 你這 {selectedCount} 支牌的歷史同開分布
        <span className="font-normal text-gray-500"> (近 {totalDraws} 期)</span>
      </h4>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => {
          const pct = totalDraws > 0 ? (r.draws / totalDraws) * 100 : 0;
          return (
            <div
              key={r.label}
              className="flex-1 min-w-[120px] rounded-lg border border-gray-200 dark:border-gray-700 p-2 text-center"
            >
              <div className="text-xs text-gray-500">{r.label}</div>
              <div className="text-xl font-bold text-brand">{r.draws}</div>
              <div className="text-[11px] text-gray-400">
                {pct.toFixed(1)}% 的期數
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ResultListProps {
  rows: ComboHit[];
  game: GameConfig;
  kLabel: string;
  baseline: number;
  totalDraws: number;
  hasMissing: boolean;
  showMissing: boolean;
}

function ResultList({
  rows,
  game,
  kLabel,
  baseline,
  totalDraws,
  hasMissing,
  showMissing,
}: ResultListProps) {
  if (rows.length === 0) {
    return (
      <div className="card text-center py-6 text-gray-500 text-sm">
        {hasMissing && !showMissing
          ? '這些號碼的這個合數在統計範圍內都沒同時開出過。勾選「顯示未出現的組合」可列出全部。'
          : '沒有符合條件的組合'}
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <h3 className="text-lg font-bold mb-3">{kLabel}同開紀錄</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">組合</th>
            <th className="py-2 pr-2 text-right">同開次數</th>
            <th className="py-2 pr-2 text-right">遺漏</th>
            <th className="py-2 pr-2 hidden sm:table-cell">最近一次</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
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
                <td className="py-2 pr-2 text-right">
                  {r.count > 0 ? (
                    <span
                      className={
                        aboveBase ? 'text-red-600 font-bold' : 'font-medium'
                      }
                    >
                      {r.count} 次
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">未出現</span>
                  )}
                </td>
                <td className="py-2 pr-2 text-right">
                  {isFinite(r.gap) ? `${r.gap} 期前` : '—'}
                </td>
                <td className="py-2 pr-2 hidden sm:table-cell text-xs text-gray-500">
                  {r.lastSeenDate ? (
                    <span>
                      {r.lastSeenDate}
                      {r.lastSeenTerm && (
                        <span className="text-gray-400"> ({r.lastSeenTerm} 期)</span>
                      )}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[11px] text-gray-400 mt-2">
        共 {rows.length} 列 · 統計近 {totalDraws} 期 · 「遺漏」= 距今幾期沒再同開
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

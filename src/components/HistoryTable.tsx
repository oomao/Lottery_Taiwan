import { useMemo, useState } from 'react';
import type { Draw, GameConfig } from '@/lib/types';
import { filterDrawsByDateRange } from '@/lib/data-loader';
import { exportDrawsToExcel } from '@/lib/export-excel';
import Ball from './ui/Ball';

interface Props {
  draws: Draw[];
  game: GameConfig;
}

const PAGE_SIZE = 20;

export default function HistoryTable({ draws, game }: Props) {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const result = filterDrawsByDateRange(draws, startDate || undefined, endDate || undefined);
    // 由新到舊
    return [...result].sort((a, b) => b.drawDate.localeCompare(a.drawDate));
  }, [draws, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExport = () => {
    if (filtered.length === 0) {
      alert('目前篩選範圍沒有資料');
      return;
    }
    exportDrawsToExcel(filtered, game, {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  };

  const presetRanges = [
    { label: '近 30 天', days: 30 },
    { label: '近 90 天', days: 90 },
    { label: '近 1 年', days: 365 },
  ];

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
    setPage(0);
  };

  const clearRange = () => {
    setStartDate('');
    setEndDate('');
    setPage(0);
  };

  return (
    <div className="card">
      <div className="flex flex-wrap gap-3 items-end mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">起始日</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(0);
            }}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">結束日</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(0);
            }}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {presetRanges.map((r) => (
            <button
              key={r.label}
              onClick={() => applyPreset(r.days)}
              className="px-3 py-1.5 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={clearRange}
            className="px-3 py-1.5 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            清除
          </button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-500">共 {filtered.length} 期</span>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-sm"
          >
            📥 匯出 Excel
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-2">期別</th>
              <th className="text-left py-2 px-2">開獎日</th>
              <th className="text-left py-2 px-2">號碼</th>
              {game.hasSecondZone && (
                <th className="text-left py-2 px-2">{game.hasSecondZone.label}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500">
                  尚無資料,請先執行資料抓取
                </td>
              </tr>
            )}
            {pageData.map((d) => (
              <tr
                key={d.drawTerm}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td className="py-2 px-2 font-mono">{d.drawTerm}</td>
                <td className="py-2 px-2">{d.drawDate}</td>
                <td className="py-2 px-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {[...d.numbers]
                      .sort((a, b) => a - b)
                      .map((n) => (
                        <Ball key={n} number={n} color={game.ballColor} size="sm" />
                      ))}
                  </div>
                </td>
                {game.hasSecondZone && (
                  <td className="py-2 px-2">
                    <div className="flex gap-1.5">
                      {d.secondZone?.map((n) => (
                        <Ball key={`s${n}`} number={n} color="yellow" size="sm" />
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
          >
            上一頁
          </button>
          <span className="text-sm text-gray-500">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
}

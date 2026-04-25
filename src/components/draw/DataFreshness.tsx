import type { Draw } from '@/lib/types';

interface Props {
  draws: Draw[];
  fetchedAt: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
}

// 顯示資料庫總期數、最新一期日期、上次抓取時間,並提供手動 refresh 按鈕
export default function DataFreshness({ draws, fetchedAt, refreshing, onRefresh }: Props) {
  const total = draws.length;
  const latestDate =
    draws.length > 0
      ? [...draws].sort((a, b) => b.drawDate.localeCompare(a.drawDate))[0].drawDate
      : null;

  const fetchedDisplay = fetchedAt
    ? fetchedAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 px-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          📚 資料庫共 <strong className="text-gray-700 dark:text-gray-200">{total}</strong> 期
        </span>
        {latestDate && (
          <span>
            🕒 資料截止 <strong className="text-gray-700 dark:text-gray-200">{latestDate}</strong>
          </span>
        )}
        <span className="hidden sm:inline">📥 抓取於 {fetchedDisplay}</span>
      </div>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-1 text-brand hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        title="跳過快取重新抓取資料"
      >
        <span className={refreshing ? 'animate-spin inline-block' : 'inline-block'}>🔄</span>
        {refreshing ? '更新中…' : '重新抓取'}
      </button>
    </div>
  );
}

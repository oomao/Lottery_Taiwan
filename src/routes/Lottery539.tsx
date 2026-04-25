import { useEffect, useState } from 'react';
import { game539 } from '@/lib/games/539.config';
import { loadDraws } from '@/lib/data-loader';
import type { Draw } from '@/lib/types';
import LatestDraw from '@/components/LatestDraw';
import HistoryTable from '@/components/HistoryTable';
import StatsPanel from '@/components/stats/StatsPanel';
import NumberPicker from '@/components/picker/NumberPicker';
import ComboRecommend from '@/components/combo/ComboRecommend';

type Tab = 'history' | 'stats' | 'combo' | 'picker';

const TABS: { key: Tab; label: string }[] = [
  { key: 'history', label: '開獎查詢' },
  { key: 'stats', label: '統計分析' },
  { key: 'combo', label: '二/三/四合' },
  { key: 'picker', label: '選號工具' },
];

export default function Lottery539() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('history');

  useEffect(() => {
    loadDraws('539')
      .then(setDraws)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const latest = [...draws].sort((a, b) => b.drawDate.localeCompare(a.drawDate))[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">{game539.name}</h1>
        <p className="text-sm text-gray-500">{game539.description}</p>
      </div>

      {loading && <div className="card text-center py-8 text-gray-500">載入中...</div>}
      {error && (
        <div className="card text-center py-8 text-red-600">
          載入失敗:{error}
          <p className="text-xs text-gray-500 mt-2">
            請先到 GitHub Actions 觸發 <code>Update Lottery Data</code>,或本機執行 <code>npm run update:all</code>
          </p>
        </div>
      )}

      {!loading && !error && (
        <>
          {latest && <LatestDraw draw={latest} game={game539} />}

          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                  tab === t.key
                    ? 'border-brand text-brand'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div>
            {tab === 'history' && <HistoryTable draws={draws} game={game539} />}
            {tab === 'stats' && <StatsPanel draws={draws} game={game539} />}
            {tab === 'combo' && <ComboRecommend draws={draws} game={game539} />}
            {tab === 'picker' && <NumberPicker draws={draws} game={game539} />}
          </div>
        </>
      )}
    </div>
  );
}

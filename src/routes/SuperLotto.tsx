import { useEffect, useState } from 'react';
import { gameSuperLotto } from '@/lib/games/superlotto.config';
import { loadDraws } from '@/lib/data-loader';
import type { Draw } from '@/lib/types';
import LatestDraw from '@/components/LatestDraw';
import HistoryTable from '@/components/HistoryTable';

export default function SuperLotto() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDraws('superlotto')
      .then(setDraws)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const latest = [...draws].sort((a, b) => b.drawDate.localeCompare(a.drawDate))[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">{gameSuperLotto.name}</h1>
        <p className="text-sm text-gray-500">{gameSuperLotto.description}</p>
        <p className="text-xs text-gray-400 mt-1">
          目前提供:上期開獎、歷史查詢、Excel 匯出。其他統計與選號工具請至 539。
        </p>
      </div>

      {loading && <div className="card text-center py-8 text-gray-500">載入中...</div>}
      {error && (
        <div className="card text-center py-8 text-red-600">
          載入失敗:{error}
          <p className="text-xs text-gray-500 mt-2">
            請先到 GitHub Actions 觸發 <code>Update Lottery Data</code>
          </p>
        </div>
      )}

      {!loading && !error && (
        <>
          {latest && <LatestDraw draw={latest} game={gameSuperLotto} />}
          <HistoryTable draws={draws} game={gameSuperLotto} />
        </>
      )}
    </div>
  );
}

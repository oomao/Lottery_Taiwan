import { gameLotto649 } from '@/lib/games/lotto649.config';
import { useDraws } from '@/lib/useDraws';
import LatestDraw from '@/components/draw/LatestDraw';
import HistoryTable from '@/components/draw/HistoryTable';
import DataFreshness from '@/components/draw/DataFreshness';

export default function Lotto649() {
  const { draws, loading, error, refreshing, refresh, fetchedAt } = useDraws('lotto649');
  const latest = [...draws].sort((a, b) => b.drawDate.localeCompare(a.drawDate))[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">{gameLotto649.name}</h1>
        <p className="text-sm text-gray-500">{gameLotto649.description}</p>
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
          <DataFreshness
            draws={draws}
            fetchedAt={fetchedAt}
            refreshing={refreshing}
            onRefresh={refresh}
          />
          {latest && <LatestDraw draw={latest} game={gameLotto649} />}
          <HistoryTable draws={draws} game={gameLotto649} />
        </>
      )}
    </div>
  );
}

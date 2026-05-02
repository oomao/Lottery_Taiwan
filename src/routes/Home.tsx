import { Link } from 'react-router-dom';
import { GAME_LIST } from '@/lib/games';

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="text-center py-8">
        <h1 className="text-4xl font-bold mb-3">台灣彩券資訊網</h1>
        <p className="text-gray-600 dark:text-gray-300">
          開獎查詢 ‧ 統計分析 ‧ 組合推薦 ‧ 對獎工具
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {GAME_LIST.map((g) => (
          <Link
            key={g.id}
            to={`/${g.id}`}
            className="card hover:shadow-lg transition cursor-pointer block"
          >
            <h3 className="text-2xl font-bold mb-2">{g.name}</h3>
            <p className="text-sm text-gray-500 mb-3">{g.description}</p>
            <p className="text-xs text-gray-400">⏰ {g.drawSchedule}</p>
          </Link>
        ))}
      </section>

      <section className="card">
        <h2 className="text-lg font-bold mb-3">關於本站</h2>
        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside">
          <li>歷史開獎查詢與期間篩選,支援匯出 Excel</li>
          <li>號碼頻率、冷熱號、遺漏值統計分析</li>
          <li>單號 / 二合 / 三合 / 四合 / 五合組合推薦 (多種演算法切換)</li>
          <li>選號工具與對獎試算 (資料儲存於本機,不上傳)</li>
          <li>資料每日從台灣彩券官網同步,中獎以官方為準</li>
        </ul>
      </section>
    </div>
  );
}

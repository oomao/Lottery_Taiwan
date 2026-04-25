import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Draw, GameConfig } from '@/lib/types';
import { computeFrequency } from '@/lib/stats/frequency';

interface Props {
  draws: Draw[];
  game: GameConfig;
  window?: number;
}

export default function FrequencyChart({ draws, game, window }: Props) {
  const stats = useMemo(
    () => computeFrequency(draws, game, { window }),
    [draws, game, window]
  );

  const counts = stats.map((s) => s.count);
  const max = Math.max(...counts, 1);
  const min = Math.min(...counts);

  const data = stats
    .map((s) => ({ number: s.number, count: s.count, gap: s.gap }))
    .sort((a, b) => a.number - b.number);

  const colorFor = (count: number) => {
    if (count === max) return '#dc2626';
    if (count === min) return '#3b82f6';
    return '#6b7280';
  };

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-lg font-bold">號碼出現頻率</h3>
        <span className="text-xs text-gray-500">
          {window ? `近 ${window} 期` : `全部 ${draws.length} 期`}
        </span>
      </div>
      <div className="w-full h-72">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="number" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(31,41,55,0.95)',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
              }}
              formatter={(v: number) => [`${v} 次`, '出現']}
              labelFormatter={(l) => `號碼 ${l}`}
            />
            <Bar dataKey="count">
              {data.map((d) => (
                <Cell key={d.number} fill={colorFor(d.count)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 text-xs text-gray-500 mt-2">
        <span><span className="inline-block w-3 h-3 bg-red-600 rounded-sm mr-1" />最熱</span>
        <span><span className="inline-block w-3 h-3 bg-blue-500 rounded-sm mr-1" />最冷</span>
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { Draw, GameConfig } from '@/lib/types';
import FrequencyChart from './FrequencyChart';
import HotColdNumbers from './HotColdNumbers';
import GapTable from './GapTable';
import TrendHeatmap from './TrendHeatmap';
import CharacteristicAnalysis from './CharacteristicAnalysis';

interface Props {
  draws: Draw[];
  game: GameConfig;
}

export default function StatsPanel({ draws, game }: Props) {
  const [window, setWindow] = useState<number | undefined>(undefined);

  const windowOptions = [
    { label: '近 30 期', value: 30 },
    { label: '近 100 期', value: 100 },
    { label: '近 300 期', value: 300 },
    { label: '全部', value: undefined },
  ];

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">統計範圍:</span>
        {windowOptions.map((o) => (
          <button
            key={o.label}
            onClick={() => setWindow(o.value)}
            className={`px-3 py-1.5 text-xs rounded ${
              window === o.value
                ? 'bg-brand text-white'
                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <FrequencyChart draws={draws} game={game} window={window} />
      <HotColdNumbers draws={draws} game={game} window={window} />
      <GapTable draws={draws} game={game} />
      <TrendHeatmap draws={draws} game={game} />
      <CharacteristicAnalysis draws={draws} game={game} window={window} />
    </div>
  );
}

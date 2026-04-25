import type { Draw, GameConfig } from '@/lib/types';
import Ball from '@/components/ui/Ball';

interface Props {
  draw: Draw;
  game: GameConfig;
}

export default function LatestDraw({ draw, game }: Props) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500">最新一期</p>
          <h2 className="text-2xl font-bold">第 {draw.drawTerm} 期</h2>
        </div>
        <p className="text-sm text-gray-500">{draw.drawDate}</p>
      </div>
      {/* 主號:flex-nowrap + 自動 wrap 的 gap,手機儘量單列並排 */}
      <div className="flex flex-nowrap gap-1.5 sm:gap-3 items-center justify-center sm:justify-start">
        {[...draw.numbers]
          .sort((a, b) => a - b)
          .map((n) => (
            <Ball key={n} number={n} color={game.ballColor} size="lg" />
          ))}
      </div>
      {game.hasSecondZone && draw.secondZone && (
        <div className="flex flex-nowrap gap-1.5 sm:gap-3 items-center justify-center sm:justify-start mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <span className="text-xs text-gray-500 mr-1">{game.hasSecondZone.label}</span>
          {draw.secondZone.map((n) => (
            <Ball key={`s${n}`} number={n} color="yellow" size="lg" />
          ))}
        </div>
      )}
    </div>
  );
}

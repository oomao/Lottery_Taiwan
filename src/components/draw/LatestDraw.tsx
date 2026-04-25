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
      <div className="flex flex-wrap gap-3 items-center">
        {[...draw.numbers]
          .sort((a, b) => a - b)
          .map((n) => (
            <Ball key={n} number={n} color={game.ballColor} size="lg" />
          ))}
        {game.hasSecondZone && draw.secondZone && (
          <>
            <span className="text-gray-400 mx-2">|</span>
            <span className="text-xs text-gray-500">{game.hasSecondZone.label}</span>
            {draw.secondZone.map((n) => (
              <Ball key={`s${n}`} number={n} color="yellow" size="lg" />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

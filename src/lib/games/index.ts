import type { GameId, GameConfig } from '../types';
import { game539 } from './539.config';
import { gameLotto649 } from './lotto649.config';
import { gameSuperLotto } from './superlotto.config';

export const GAMES: Record<GameId, GameConfig> = {
  '539': game539,
  lotto649: gameLotto649,
  superlotto: gameSuperLotto,
};

export const GAME_LIST: GameConfig[] = Object.values(GAMES);

export function getGameConfig(id: GameId): GameConfig {
  return GAMES[id];
}

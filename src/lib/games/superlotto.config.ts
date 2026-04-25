import type { GameConfig } from '../types';

export const gameSuperLotto: GameConfig = {
  id: 'superlotto',
  name: '威力彩',
  shortName: '威力彩',
  numberRange: [1, 38],
  pickCount: 6,
  hasSecondZone: {
    range: [1, 8],
    pickCount: 1,
    label: '第二區',
  },
  drawSchedule: '每週一、週四 20:30',
  ballColor: 'blue',
  description: '第一區 1–38 選 6 個,第二區 1–8 選 1 個',
};

import type { GameConfig } from '../types';

export const gameLotto649: GameConfig = {
  id: 'lotto649',
  name: '大樂透',
  shortName: '大樂透',
  numberRange: [1, 49],
  pickCount: 6,
  drawSchedule: '每週二、週五 21:00',
  ballColor: 'yellow',
  description: '從 1–49 中選 6 個號碼,每週二、週五開獎',
};

// XGBoost 特徵工程 - 必須跟 scripts/ml/feature_engineering.py 的 make_xgboost_features 完全一致
//
// 160 維 = 39 freq_ratio + 39 decayed_count + 39 gap + 39 last_multi_hot + 4 agg

import type { Draw } from '../types';

// 須跟 Python 端常數一致
const NUM_RANGE = 39;
const PICK_COUNT = 5;
const WINDOW_SIZE = 60;
const BIG_THRESHOLD = 20;
const GAP_CLAMP = 60;
const MAX_SUM = 35 + 36 + 37 + 38 + 39; // 185
const DECAY = 0.97;
export const XGB_FEATURE_DIM = NUM_RANGE * 4 + 4; // 160

export function makeXGBoostFeatures(draws: Draw[]): Float32Array {
  if (draws.length < WINDOW_SIZE) {
    throw new Error(`需要至少 ${WINDOW_SIZE} 期歷史資料,目前只有 ${draws.length}`);
  }
  const sorted = [...draws].sort((a, b) => a.drawDate.localeCompare(b.drawDate));
  const sub = sorted.slice(-WINDOW_SIZE);

  const feat = new Float32Array(XGB_FEATURE_DIM);
  const lastSeen = new Map<number, number>();

  let sumAcc = 0;
  let oddAcc = 0;
  let bigAcc = 0;
  let consecAcc = 0;

  sub.forEach((draw, i) => {
    const age = WINDOW_SIZE - 1 - i;
    const weight = Math.pow(DECAY, age);
    for (const n of draw.numbers) {
      feat[n - 1] += 1.0 / PICK_COUNT;
      feat[NUM_RANGE + (n - 1)] += weight;
      lastSeen.set(n, i);
    }
    sumAcc += draw.numbers.reduce((s, x) => s + x, 0);
    oddAcc += draw.numbers.filter((x) => x % 2 === 1).length;
    bigAcc += draw.numbers.filter((x) => x >= BIG_THRESHOLD).length;
    const sd = [...draw.numbers].sort((a, b) => a - b);
    let consec = 0;
    for (let j = 1; j < sd.length; j++) if (sd[j] - sd[j - 1] === 1) consec++;
    consecAcc += consec;
  });

  // gap
  for (let n = 1; n <= NUM_RANGE; n++) {
    const ls = lastSeen.get(n);
    const gap = ls === undefined ? GAP_CLAMP : Math.min(WINDOW_SIZE - 1 - ls, GAP_CLAMP);
    feat[NUM_RANGE * 2 + (n - 1)] = gap / GAP_CLAMP;
  }

  // 最後一期 multi-hot
  for (const n of sub[sub.length - 1].numbers) {
    feat[NUM_RANGE * 3 + (n - 1)] = 1.0;
  }

  // 4 維平均
  feat[NUM_RANGE * 4 + 0] = (sumAcc / WINDOW_SIZE) / MAX_SUM;
  feat[NUM_RANGE * 4 + 1] = (oddAcc / WINDOW_SIZE) / PICK_COUNT;
  feat[NUM_RANGE * 4 + 2] = (bigAcc / WINDOW_SIZE) / PICK_COUNT;
  feat[NUM_RANGE * 4 + 3] = (consecAcc / WINDOW_SIZE) / Math.max(1, PICK_COUNT - 1);

  return feat;
}

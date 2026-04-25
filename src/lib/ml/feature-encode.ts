// TS 版特徵工程 - 必須跟 scripts/ml/feature_engineering.py 完全一致
// 任何修改都要兩邊同步

import type { Draw } from '../types';
import type { FeatureSchema } from './types';

/**
 * 編碼一期的「非 gap」特徵 (multi-hot + sum + odd + big + consec)
 * gap 部分留 0,由序列函式統一填入
 */
function encodePerDraw(numbers: number[], schema: FeatureSchema): Float32Array {
  const feat = new Float32Array(schema.num_features);
  const { num_range, pick_count, big_threshold, max_sum } = schema;

  // multi-hot
  for (const n of numbers) {
    feat[n - 1] = 1;
  }

  const sum = numbers.reduce((s, n) => s + n, 0);
  feat[num_range] = sum / max_sum;

  const odd = numbers.filter((n) => n % 2 === 1).length;
  feat[num_range + 1] = odd / pick_count;

  const big = numbers.filter((n) => n >= big_threshold).length;
  feat[num_range + 2] = big / pick_count;

  const sortedN = [...numbers].sort((a, b) => a - b);
  let consec = 0;
  for (let i = 1; i < sortedN.length; i++) {
    if (sortedN[i] - sortedN[i - 1] === 1) consec += 1;
  }
  feat[num_range + 3] = consec / Math.max(1, pick_count - 1);

  return feat;
}

/**
 * 建構整段序列的特徵矩陣 [N, num_features]
 * 跟 Python build_sequence_features 完全對應
 */
export function buildSequenceFeatures(
  draws: Draw[],
  schema: FeatureSchema
): Float32Array[] {
  const { num_range, gap_clamp } = schema;
  const seq: Float32Array[] = [];
  const lastSeen = new Map<number, number>(); // n -> last index seen

  draws.forEach((draw, i) => {
    const feat = encodePerDraw(draw.numbers, schema);

    // gap = 進入該期前,該號上次出現距現在多少期
    for (let n = 1; n <= num_range; n++) {
      const ls = lastSeen.get(n);
      const gap = ls === undefined ? gap_clamp : Math.min(i - ls, gap_clamp);
      feat[num_range + 4 + (n - 1)] = gap / gap_clamp;
    }

    seq.push(feat);

    // 更新 lastSeen
    for (const n of draw.numbers) {
      lastSeen.set(n, i);
    }
  });

  return seq;
}

/**
 * 取最後 window 期作為推論輸入,回傳 Float32Array of length window*num_features
 * (call site 自己 reshape 成 [1, window, num_features])
 */
export function makeInferenceWindow(
  draws: Draw[],
  schema: FeatureSchema
): Float32Array {
  const { window_size, num_features } = schema;
  if (draws.length < window_size) {
    throw new Error(
      `需要至少 ${window_size} 期歷史資料,目前只有 ${draws.length}`
    );
  }
  // 依時序由舊→新排序
  const sorted = [...draws].sort((a, b) => a.drawDate.localeCompare(b.drawDate));
  const tail = sorted.slice(-window_size);
  const seq = buildSequenceFeatures(tail, schema);

  const flat = new Float32Array(window_size * num_features);
  seq.forEach((row, i) => {
    flat.set(row, i * num_features);
  });
  return flat;
}

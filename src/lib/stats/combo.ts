import type { ComboStat, Draw } from '../types';

// 從一組號碼產生所有 k-組合
export function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  const recurse = (start: number, combo: T[]) => {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      recurse(i + 1, combo);
      combo.pop();
    }
  };
  recurse(0, []);
  return result;
}

const comboKey = (combo: number[]) => combo.slice().sort((a, b) => a - b).join('-');

// 對所有期數,枚舉所有 k-組合,計算頻率/衰減/遺漏
export function computeComboStats(
  draws: Draw[],
  k: 2 | 3 | 4,
  options: { decayFactor?: number; window?: number; topN?: number } = {}
): ComboStat[] {
  const { decayFactor = 0.97, window, topN } = options;

  const sorted = [...draws].sort((a, b) => a.drawDate.localeCompare(b.drawDate));
  const subset = window != null ? sorted.slice(-window) : sorted;
  const totalDraws = subset.length;

  const map = new Map<string, ComboStat>();

  subset.forEach((draw, idx) => {
    const ageFromLatest = totalDraws - 1 - idx;
    const weight = Math.pow(decayFactor, ageFromLatest);
    const combos = combinations(draw.numbers, k);
    combos.forEach((c) => {
      const key = comboKey(c);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.weightedScore += weight;
        existing.gap = ageFromLatest;
        existing.lastSeenTerm = draw.drawTerm;
      } else {
        map.set(key, {
          combo: c.slice().sort((a, b) => a - b),
          count: 1,
          weightedScore: weight,
          gap: ageFromLatest,
          lastSeenTerm: draw.drawTerm,
        });
      }
    });
  });

  let result = Array.from(map.values()).sort(
    (a, b) => b.weightedScore - a.weightedScore
  );
  if (topN) result = result.slice(0, topN);
  return result;
}

import type { Draw, FrequencyStat, GameConfig } from '../types';

// 單號頻率統計 + 衰減加權 + 遺漏值
export function computeFrequency(
  draws: Draw[],
  game: GameConfig,
  options: { decayFactor?: number; window?: number } = {}
): FrequencyStat[] {
  const { decayFactor = 0.97, window } = options;
  const [min, max] = game.numberRange;

  // 依日期由舊到新排序
  const sorted = [...draws].sort((a, b) => a.drawDate.localeCompare(b.drawDate));
  const subset = window != null ? sorted.slice(-window) : sorted;
  const totalDraws = subset.length;

  const stats = new Map<number, FrequencyStat>();
  for (let n = min; n <= max; n++) {
    stats.set(n, { number: n, count: 0, weightedScore: 0, gap: totalDraws });
  }

  subset.forEach((draw, idx) => {
    const ageFromLatest = totalDraws - 1 - idx; // 0 = 最新
    const weight = Math.pow(decayFactor, ageFromLatest);
    draw.numbers.forEach((n) => {
      const s = stats.get(n);
      if (!s) return;
      s.count += 1;
      s.weightedScore += weight;
      // gap 是「最後一次出現距現在幾期」,所以遇到就更新成 ageFromLatest
      s.gap = ageFromLatest;
    });
  });

  return Array.from(stats.values()).sort((a, b) => b.weightedScore - a.weightedScore);
}

// 純函式:從 39 維機率向量產生 top N 的 k-合組合推薦
// 不依賴 TF.js,可直接靜態 import 不影響主 bundle

export function greedyComboFromProbs(
  probs: number[],
  k: 2 | 3 | 4,
  topN: number,
  poolSize: number = 12
): { combo: number[]; score: number }[] {
  const top = probs
    .map((p, i) => ({ number: i + 1, prob: p }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, poolSize);

  const combos: { combo: number[]; score: number }[] = [];
  const numbers = top.map((t) => t.number);
  const probMap = new Map(top.map((t) => [t.number, t.prob]));

  const combine = (start: number, current: number[]) => {
    if (current.length === k) {
      const score = current.reduce((p, n) => p * (probMap.get(n) ?? 0), 1);
      combos.push({ combo: [...current].sort((a, b) => a - b), score });
      return;
    }
    for (let i = start; i < numbers.length; i++) {
      current.push(numbers[i]);
      combine(i + 1, current);
      current.pop();
    }
  };
  combine(0, []);

  combos.sort((a, b) => b.score - a.score);
  return combos.slice(0, topN);
}

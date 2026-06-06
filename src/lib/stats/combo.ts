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

// 二項式係數 C(n, k) — 用來估算枚舉量,避免一次建出過多組合
export function nCk(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let v = 1;
  for (let i = 0; i < k; i++) v = (v * (n - i)) / (i + 1);
  return Math.round(v);
}

// 兩個已排序組合的字典序比較 (穩定排序的次要鍵)
function compareCombo(a: number[], b: number[]): number {
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

// 使用者選定號碼裡,某個 k-合的歷史同開紀錄
export interface ComboHit {
  combo: number[];          // 組合 (已排序)
  count: number;            // 歷史同時開出次數
  gap: number;              // 距今幾期 (Infinity = 從未出現)
  lastSeenTerm: string | null;
  lastSeenDate: string | null;
}

// 給定使用者選的一組號碼,枚舉其所有 k-合,
// 統計每個組合在歷史上「同一期同時開出」的次數 / 最近一次 / 遺漏期數。
// 注意:只看「完全由選定號碼組成」的組合 (包牌回測),不是含號篩選。
export function queryComboHits(
  draws: Draw[],
  selectedNumbers: number[],
  k: number,
  options: { window?: number } = {}
): ComboHit[] {
  const selected = Array.from(new Set(selectedNumbers)).sort((a, b) => a - b);
  if (selected.length < k || k < 1) return [];

  const selectedSet = new Set(selected);
  const sorted = [...draws].sort((a, b) => a.drawDate.localeCompare(b.drawDate));
  const subset = options.window != null ? sorted.slice(-options.window) : sorted;
  const total = subset.length;

  // 先把所有可能的 k-合建出來 (count=0),這樣「沒出現過」的也看得到
  const map = new Map<string, ComboHit>();
  combinations(selected, k).forEach((c) => {
    map.set(c.join('-'), {
      combo: c,
      count: 0,
      gap: Infinity,
      lastSeenTerm: null,
      lastSeenDate: null,
    });
  });

  // 由舊到新掃描;只取每期落在選定集合內的號碼再枚舉,效率高
  subset.forEach((draw, idx) => {
    const age = total - 1 - idx;
    const inter = draw.numbers.filter((n) => selectedSet.has(n));
    if (inter.length < k) return;
    combinations(inter, k).forEach((c) => {
      const hit = map.get(c.join('-'));
      if (!hit) return;
      hit.count += 1;
      hit.gap = age;                 // 迭代由舊到新,最後一次寫入即最近一期
      hit.lastSeenTerm = draw.drawTerm;
      hit.lastSeenDate = draw.drawDate;
    });
  });

  return Array.from(map.values()).sort(
    (a, b) => b.count - a.count || compareCombo(a.combo, b.combo)
  );
}

// 牌組命中分布:每一期開出的號碼,有幾顆落在使用者選的牌組裡。
// counts[i] = 剛好命中 i 顆的期數。
export function computeOverlapDistribution(
  draws: Draw[],
  selectedNumbers: number[],
  options: { window?: number } = {}
): { totalDraws: number; counts: number[] } {
  const selectedSet = new Set(selectedNumbers);
  const sorted = [...draws].sort((a, b) => a.drawDate.localeCompare(b.drawDate));
  const subset = options.window != null ? sorted.slice(-options.window) : sorted;
  const counts = new Array(selectedSet.size + 1).fill(0);

  subset.forEach((draw) => {
    let hit = 0;
    draw.numbers.forEach((n) => {
      if (selectedSet.has(n)) hit++;
    });
    counts[hit] += 1;
  });

  return { totalDraws: subset.length, counts };
}

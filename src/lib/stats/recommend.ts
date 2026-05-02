// 單號 / 二合 / 三合 / 四合 / 五合 推薦演算法集
//
// 六種方法 + 一種綜合推薦 (composite),全部回傳統一介面 ComboScore[]。
//
// 注意:
// - 對於 frequency / weighted / gap,只列出歷史曾出現過的組合 (其他無從計算)。
// - 對於 marginal / lift / markov / composite,會枚舉 *所有* C(N, k) 組合,
//   因為它們即使從未出現也能算出機率,這正是進階方法的價值。
// - 四合 (k=4) 全枚舉 = 82,251 組;五合 (k=5, 539) = 575,757 組,首次計算需數秒。
// - 單號 (k=1) 沒有 pair,lift 永遠為 1,在 composite 經標準化後自動歸零。

import type { Draw, GameConfig } from '../types';
import { combinations } from './combo';

export type ComboK = 1 | 2 | 3 | 4 | 5;

export type RecommendMethod =
  | 'composite'   // 綜合推薦 (預設,權重依 k 動態調整)
  | 'frequency'   // 純頻率
  | 'weighted'    // 衰減加權
  | 'gap'         // 遺漏值
  | 'marginal'    // 邊際機率
  | 'lift'        // Lift / 共現相對機率
  | 'markov';     // 馬可夫鏈 (給定上期)

// 綜合推薦的權重表 - 依合數調整
// 設計理念:
//   k=1 (單號): 樣本最豐富,加權頻率主導;沒有 pair 所以 lift=0
//   k=2 (二合): 已觀察組合 12+ 樣本,頻率類有意義,加權/lift/markov 同樣重要
//   k=3 (三合): 觀察樣本 ~1 次/組合,需要更倚賴可推導的方法 (marginal/lift)
//   k=4 (四合): 95% 組合是 0 次,frequency 系列徹底失效,marginal 成為主力
//   k=5 (五合): 對 539 而言一個 5-合 = 完整一期,觀察率 < 0.2%,marginal 完全主導
export const COMPOSITE_WEIGHTS: Record<ComboK, {
  weighted: number; marginal: number; lift: number; markov: number;
}> = {
  1: { weighted: 0.45, marginal: 0.30, lift: 0.00, markov: 0.25 },
  2: { weighted: 0.35, marginal: 0.20, lift: 0.25, markov: 0.20 },
  3: { weighted: 0.25, marginal: 0.30, lift: 0.25, markov: 0.20 },
  4: { weighted: 0.10, marginal: 0.55, lift: 0.20, markov: 0.15 },
  5: { weighted: 0.05, marginal: 0.60, lift: 0.20, markov: 0.15 },
};

export interface ComboScore {
  combo: number[];
  score: number;            // 主分數 (依方法不同)
  // 詳細分數 (展示用)
  count: number;
  weighted: number;
  gap: number;              // 多少期沒開過 (Infinity = 從未)
  lastSeenTerm: string | null;
  marginal: number;         // 邊際機率
  lift: number;             // 平均 pairwise lift
  markov: number;           // 給定上期的條件機率
  isObserved: boolean;
}

interface ComputeOptions {
  window?: number;          // 用多少期計算 (undefined = 全部)
  decayFactor?: number;     // 加權衰減,預設 0.97
  topN?: number;            // 只回傳前 N 組
  mustContain?: number[];   // 過濾:只保留含指定號碼的組合
}

const comboKey = (c: number[]) => c.slice().sort((a, b) => a - b).join('-');
const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// ------------- 預計算結構 -------------

interface PrecomputedStats {
  totalDraws: number;
  pickCount: number;
  // 單號出現次數 + 機率
  numberCount: Map<number, number>;
  numberProb: Map<number, number>;       // P(n) = count/(totalDraws*pickCount) 的近似 — 是「任一個位置看到 n」的機率
  numberPerDrawProb: Map<number, number>; // count / totalDraws — 「該期是否含 n」的機率
  // 已觀察的組合
  observedCombos: Map<string, ObservedCombo>;
  // 二合 lift 表 (給三/四合推導)
  pairLift: Map<string, number>;
  // 馬可夫:T[a][b] = P(下期含 b | 本期含 a)
  markov: Map<number, Map<number, number>>;
  // 最後一期的號碼 (Markov 評分用)
  lastDrawNumbers: number[];
  allNumbers: number[];
}

interface ObservedCombo {
  count: number;
  weighted: number;
  gap: number;
  lastSeenTerm: string;
}

export function precomputeStats(
  draws: Draw[],
  game: GameConfig,
  k: ComboK,
  options: ComputeOptions = {}
): PrecomputedStats {
  const { window, decayFactor = 0.97 } = options;
  const sorted = [...draws].sort((a, b) => a.drawDate.localeCompare(b.drawDate));
  const subset = window != null ? sorted.slice(-window) : sorted;
  const totalDraws = subset.length;
  const [min, max] = game.numberRange;
  const allNumbers = Array.from({ length: max - min + 1 }, (_, i) => i + min);

  const numberCount = new Map<number, number>();
  allNumbers.forEach((n) => numberCount.set(n, 0));

  const observedCombos = new Map<string, ObservedCombo>();
  const pairCount = new Map<string, number>();

  subset.forEach((draw, idx) => {
    const age = totalDraws - 1 - idx;
    const weight = Math.pow(decayFactor, age);
    draw.numbers.forEach((n) => numberCount.set(n, (numberCount.get(n) ?? 0) + 1));

    // 觀察該期的所有 k-組合
    combinations(draw.numbers, k).forEach((c) => {
      const key = comboKey(c);
      const ex = observedCombos.get(key);
      if (ex) {
        ex.count += 1;
        ex.weighted += weight;
        ex.gap = age;
        ex.lastSeenTerm = draw.drawTerm;
      } else {
        observedCombos.set(key, {
          count: 1,
          weighted: weight,
          gap: age,
          lastSeenTerm: draw.drawTerm,
        });
      }
    });

    // 二合計次 (給 lift 推導,k 不論為何都需要)
    combinations(draw.numbers, 2).forEach(([a, b]) => {
      const key = pairKey(a, b);
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
    });
  });

  // P(n) 近似:n 出現次數 / (totalDraws * pickCount)
  // 例如 n 出現 120 次,940 期,pick=5 → P(n) ≈ 120/(940*5) ≈ 2.55%
  const numberProb = new Map<number, number>();
  // P(n appears in a draw) = count / totalDraws
  const numberPerDrawProb = new Map<number, number>();
  allNumbers.forEach((n) => {
    const c = numberCount.get(n) ?? 0;
    numberProb.set(n, c / Math.max(1, totalDraws * game.pickCount));
    numberPerDrawProb.set(n, c / Math.max(1, totalDraws));
  });

  // Lift: P(A,B) / (P(A) * P(B)),用「該期是否含號」的機率
  const pairLift = new Map<string, number>();
  for (let i = 0; i < allNumbers.length; i++) {
    for (let j = i + 1; j < allNumbers.length; j++) {
      const a = allNumbers[i];
      const b = allNumbers[j];
      const k_ab = pairCount.get(pairKey(a, b)) ?? 0;
      const pAB = k_ab / Math.max(1, totalDraws);
      const pA = numberPerDrawProb.get(a)!;
      const pB = numberPerDrawProb.get(b)!;
      const denom = pA * pB;
      const lift = denom > 0 ? pAB / denom : 0;
      pairLift.set(pairKey(a, b), lift);
    }
  }

  // 馬可夫:T[a][b] = P(下期含 b | 本期含 a)
  // 統計:每對相鄰期 (subset[i], subset[i+1]) 中,a in 本期 ∧ b in 下期 的次數
  const markov = new Map<number, Map<number, number>>();
  const aOccCount = new Map<number, number>(); // 包含 a 的「本期」總數
  allNumbers.forEach((a) => {
    markov.set(a, new Map());
    aOccCount.set(a, 0);
  });
  for (let i = 0; i < subset.length - 1; i++) {
    const cur = subset[i].numbers;
    const next = subset[i + 1].numbers;
    cur.forEach((a) => {
      aOccCount.set(a, (aOccCount.get(a) ?? 0) + 1);
      const row = markov.get(a)!;
      next.forEach((b) => {
        row.set(b, (row.get(b) ?? 0) + 1);
      });
    });
  }
  // 把計數轉成機率
  markov.forEach((row, a) => {
    const total = aOccCount.get(a) ?? 0;
    if (total === 0) return;
    row.forEach((cnt, b) => row.set(b, cnt / total));
  });

  const lastDrawNumbers = subset[subset.length - 1]?.numbers ?? [];

  return {
    totalDraws,
    pickCount: game.pickCount,
    numberCount,
    numberProb,
    numberPerDrawProb,
    observedCombos,
    pairLift,
    markov,
    lastDrawNumbers,
    allNumbers,
  };
}

// ------------- 各方法的評分 -------------

function scoreMarginal(combo: number[], pre: PrecomputedStats): number {
  // 連乘每個號碼「該期是否出現」的機率
  // (假設獨立 — 真實樂透因為「不重複抽 5 顆」會有微弱負相關,但用作近似可)
  let p = 1;
  for (const n of combo) {
    p *= pre.numberPerDrawProb.get(n) ?? 0;
  }
  return p;
}

function scoreLift(combo: number[], pre: PrecomputedStats): number {
  // 所有 pairwise lift 的幾何平均 (用 log 加總避免爆掉)
  // 高 lift 表示組合內號碼互相 "正關聯"
  let logSum = 0;
  let count = 0;
  for (let i = 0; i < combo.length; i++) {
    for (let j = i + 1; j < combo.length; j++) {
      const lift = pre.pairLift.get(pairKey(combo[i], combo[j])) ?? 0;
      // log(0) → -Infinity,用一個下限避免
      logSum += Math.log(Math.max(1e-6, lift));
      count++;
    }
  }
  return Math.exp(logSum / Math.max(1, count));
}

function scoreMarkov(combo: number[], pre: PrecomputedStats): number {
  // 給定上期 L,combo 的每個 n 都用 max{l in L} P(n | l) 取最高條件機率,再連乘
  if (pre.lastDrawNumbers.length === 0) return 0;
  let p = 1;
  for (const n of combo) {
    let best = 0;
    for (const l of pre.lastDrawNumbers) {
      const v = pre.markov.get(l)?.get(n) ?? 0;
      if (v > best) best = v;
    }
    p *= best;
  }
  return p;
}

// ------------- 主入口 -------------

export function recommend(
  draws: Draw[],
  game: GameConfig,
  k: ComboK,
  method: RecommendMethod,
  options: ComputeOptions = {}
): ComboScore[] {
  const { topN = 50, mustContain } = options;
  const pre = precomputeStats(draws, game, k, options);

  if (pre.totalDraws === 0) return [];

  // 取得候選組合集合
  // - 進階方法 (marginal/lift/markov/composite) 需要枚舉所有組合
  // - 統計方法 (frequency/weighted/gap) 只能用觀察過的
  const useAllCombos = ['marginal', 'lift', 'markov', 'composite'].includes(method);
  let candidates: number[][];
  if (useAllCombos) {
    candidates = combinations(pre.allNumbers, k);
  } else {
    candidates = Array.from(pre.observedCombos.keys()).map((key) =>
      key.split('-').map(Number)
    );
  }

  // 過濾「必須包含某些號碼」
  if (mustContain && mustContain.length > 0) {
    const set = new Set(mustContain);
    candidates = candidates.filter((c) => mustContain.every((n) => c.includes(n)) || c.some((n) => set.has(n)));
  }

  // 算每個候選的詳細分數
  const scored: ComboScore[] = candidates.map((combo) => {
    const sortedCombo = combo.slice().sort((a, b) => a - b);
    const key = comboKey(sortedCombo);
    const obs = pre.observedCombos.get(key);
    const isObserved = !!obs;
    const count = obs?.count ?? 0;
    const weighted = obs?.weighted ?? 0;
    const gap = obs?.gap ?? Infinity;
    const lastSeenTerm = obs?.lastSeenTerm ?? null;
    const marginal = scoreMarginal(sortedCombo, pre);
    const lift = scoreLift(sortedCombo, pre);
    const markov = scoreMarkov(sortedCombo, pre);

    return {
      combo: sortedCombo,
      score: 0, // 下面填
      count,
      weighted,
      gap,
      lastSeenTerm,
      marginal,
      lift,
      markov,
      isObserved,
    };
  });

  // 依方法填主分數
  if (method === 'composite') {
    // 標準化每個指標到 [0,1] 再加權
    // 注意:不能用 Math.max(...vals) — k=5 時 vals.length = 575,757,會超過 JS 引擎的函式參數上限
    const norm = (vals: number[]) => {
      let max = -Infinity;
      let min = Infinity;
      for (const v of vals) {
        if (v > max) max = v;
        if (v < min) min = v;
      }
      const range = max - min;
      return range > 0 ? vals.map((v) => (v - min) / range) : vals.map(() => 0);
    };
    const wVals = norm(scored.map((s) => s.weighted));
    const mVals = norm(scored.map((s) => s.marginal));
    const lVals = norm(scored.map((s) => s.lift));
    const kVals = norm(scored.map((s) => s.markov));
    const weights = COMPOSITE_WEIGHTS[k];
    scored.forEach((s, i) => {
      s.score =
        wVals[i] * weights.weighted +
        mVals[i] * weights.marginal +
        lVals[i] * weights.lift +
        kVals[i] * weights.markov;
    });
  } else {
    scored.forEach((s) => {
      switch (method) {
        case 'frequency': s.score = s.count; break;
        case 'weighted':  s.score = s.weighted; break;
        case 'gap':       s.score = isFinite(s.gap) ? s.gap : pre.totalDraws + 1; break;
        case 'marginal':  s.score = s.marginal; break;
        case 'lift':      s.score = s.lift; break;
        case 'markov':    s.score = s.markov; break;
      }
    });
  }

  // 排序、截斷
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

// 隨機基準:某 k-合在 N 期裡的「期望出現次數」
export function expectedRandomCount(N: number, k: ComboK, game: GameConfig): number {
  const [min, max] = game.numberRange;
  const total = max - min + 1;
  const pick = game.pickCount;
  // P(任一固定 k-組合在某期被開出) = C(pick,k) / C(total,k)
  const C = (n: number, r: number) => {
    if (r > n) return 0;
    let v = 1;
    for (let i = 0; i < r; i++) v = (v * (n - i)) / (i + 1);
    return v;
  };
  const p = C(pick, k) / C(total, k);
  return N * p;
}

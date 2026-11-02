import type { Draw } from '../types';

// 拖牌統計:某期開出「觸發號碼」後,往後第 N 期 (或 N 期內) 各號碼開出的條件機率

export type DragMode = 'each' | 'all';

export interface DragOptions {
  window?: number;   // 只看最近幾期
  lagFrom: number;   // 往後第幾期起 (1 = 下一期)
  lagTo: number;     // 往後第幾期止 (lagFrom === lagTo 表示只看那一期)
  mode: DragMode;    // each = 每個觸發號碼分別算再合併; all = 觸發號碼需同期全開
}

export interface DragRow {
  number: number;
  hits: number;        // 觸發後在目標期內開出的次數
  trials: number;      // 有效觸發次數 (目標期都已開獎)
  rate: number;        // hits / trials
  baseline: number;    // 不看觸發,任意一期之後同樣期距內開出的機率
  lift: number;        // rate / baseline
  z: number;           // 相對基準的 z 分數,> 2 才算比較顯著
  perTrigger: { trigger: number; hits: number; trials: number }[];
}

export interface DragResult {
  rows: DragRow[];
  triggerDraws: number;  // 觸發的期數 (each 模式為各號加總)
  totalDraws: number;
}

export function computeDrag(
  draws: Draw[],
  triggers: number[],
  range: [number, number],
  opts: DragOptions
): DragResult {
  const sorted = [...draws].sort(
    (a, b) => a.drawDate.localeCompare(b.drawDate) || a.drawTerm.localeCompare(b.drawTerm)
  );
  const subset = opts.window != null ? sorted.slice(-opts.window) : sorted;
  const sets = subset.map((d) => new Set(d.numbers));
  const n = subset.length;
  const [min, max] = range;
  const size = max - min + 1;

  // 只取目標期都已開出的觸發位置
  const lastIdx = n - 1 - opts.lagTo;

  // 某期 i 之後目標期距內出現的號碼
  const targetSet = (i: number) => {
    const s = new Set<number>();
    for (let l = opts.lagFrom; l <= opts.lagTo; l++) sets[i + l].forEach((x) => s.add(x));
    return s;
  };

  // 基準:所有可用位置
  const baseHits = new Array<number>(size).fill(0);
  let baseTrials = 0;
  const targets: Set<number>[] = [];
  for (let i = 0; i <= lastIdx; i++) {
    const t = targetSet(i);
    targets.push(t);
    t.forEach((x) => baseHits[x - min]++);
    baseTrials++;
  }

  // 每組觸發條件分別累計
  const groups: number[][] = opts.mode === 'each' ? triggers.map((t) => [t]) : [triggers];
  const groupHits = groups.map(() => new Array<number>(size).fill(0));
  const groupTrials = groups.map(() => 0);
  for (let i = 0; i <= lastIdx; i++) {
    groups.forEach((g, gi) => {
      if (!g.every((x) => sets[i].has(x))) return;
      groupTrials[gi]++;
      targets[i].forEach((x) => groupHits[gi][x - min]++);
    });
  }

  const totalTrials = groupTrials.reduce((s, v) => s + v, 0);
  const rows: DragRow[] = [];
  for (let k = 0; k < size; k++) {
    const hits = groupHits.reduce((s, h) => s + h[k], 0);
    const baseline = baseTrials > 0 ? baseHits[k] / baseTrials : 0;
    const rate = totalTrials > 0 ? hits / totalTrials : 0;
    const expected = totalTrials * baseline;
    const sd = Math.sqrt(expected * (1 - baseline));
    rows.push({
      number: k + min,
      hits,
      trials: totalTrials,
      rate,
      baseline,
      lift: baseline > 0 ? rate / baseline : 0,
      z: sd > 0 ? (hits - expected) / sd : 0,
      perTrigger:
        opts.mode === 'each'
          ? groups.map((g, gi) => ({ trigger: g[0], hits: groupHits[gi][k], trials: groupTrials[gi] }))
          : [],
    });
  }

  rows.sort((a, b) => b.rate - a.rate || b.z - a.z || a.number - b.number);
  return { rows, triggerDraws: totalTrials, totalDraws: n };
}

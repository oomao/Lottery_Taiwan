// 預先計算統計檔
// 從 public/data/<game>/raw.json 讀資料 → 算二/三/四合 → 寫 stats-*.json

import fs from 'node:fs/promises';
import path from 'node:path';

interface Draw {
  drawTerm: string;
  drawDate: string;
  numbers: number[];
}

interface ComboStat {
  combo: number[];
  count: number;
  weightedScore: number;
  gap: number;
  lastSeenTerm?: string;
}

function combinations<T>(arr: T[], k: number): T[][] {
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

function computeCombos(draws: Draw[], k: number, decay = 0.97): ComboStat[] {
  const sorted = [...draws].sort((a, b) => a.drawDate.localeCompare(b.drawDate));
  const total = sorted.length;
  const map = new Map<string, ComboStat>();

  sorted.forEach((draw, idx) => {
    const age = total - 1 - idx;
    const weight = Math.pow(decay, age);
    combinations(draw.numbers, k).forEach((c) => {
      const sortedCombo = c.slice().sort((a, b) => a - b);
      const key = sortedCombo.join('-');
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.weightedScore += weight;
        existing.gap = age;
        existing.lastSeenTerm = draw.drawTerm;
      } else {
        map.set(key, {
          combo: sortedCombo,
          count: 1,
          weightedScore: weight,
          gap: age,
          lastSeenTerm: draw.drawTerm,
        });
      }
    });
  });

  return Array.from(map.values()).sort((a, b) => b.weightedScore - a.weightedScore);
}

async function main() {
  const game = process.argv[2] ?? '539';
  const baseDir = path.join(process.cwd(), 'public/data', game);
  const rawPath = path.join(baseDir, 'raw.json');

  let draws: Draw[] = [];
  try {
    draws = JSON.parse(await fs.readFile(rawPath, 'utf8'));
  } catch {
    console.warn(`[stats] 找不到 ${rawPath},產生空統計`);
  }

  const decay = 0.97;
  const writeStats = async (k: 2 | 3 | 4, name: string) => {
    const combos = computeCombos(draws, k, decay);
    const file = {
      generatedAt: new Date().toISOString(),
      totalDraws: draws.length,
      windowSize: null,
      decayFactor: decay,
      data: combos.slice(0, 500), // 只存前 500,前端不用全載
    };
    const out = path.join(baseDir, `stats-${name}.json`);
    await fs.writeFile(out, JSON.stringify(file, null, 2), 'utf8');
    console.log(`[stats] 寫入 ${out} (${combos.length} 組)`);
  };

  await writeStats(2, 'pair');
  await writeStats(3, 'triplet');
  await writeStats(4, 'quad');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

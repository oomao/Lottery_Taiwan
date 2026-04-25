// 共用 helper:呼叫台彩 API、合併資料、寫檔

import fs from 'node:fs/promises';
import path from 'node:path';

export interface Draw {
  drawTerm: string;
  drawDate: string;
  numbers: number[];
  secondZone?: number[];
}

const API_BASE = 'https://api.taiwanlottery.com/TLCAPIWeB/Lottery';

// 台彩 API 月份格式 yyyy-MM
function ymList(monthsBack: number): string[] {
  const list: string[] = [];
  const now = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return list;
}

interface ApiEnvelope<T> {
  rtCode: number;
  rtMsg: string | null;
  content: { totalSize: number } & T;
}

async function callApi<T>(endpoint: string, month: string): Promise<T> {
  const url = `${API_BASE}/${endpoint}?period&month=${month}&pageSize=31`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const json = (await res.json()) as ApiEnvelope<T>;
  if (json.rtCode !== 0) {
    console.warn(`[api] ${endpoint} ${month} returned rtCode=${json.rtCode}: ${json.rtMsg}`);
  }
  return json.content;
}

// ISO 日期擷取 yyyy-mm-dd
const toIsoDate = (s: string) => s.slice(0, 10);

export async function fetch539(monthsBack: number): Promise<Draw[]> {
  const months = ymList(monthsBack);
  const all: Draw[] = [];
  for (const m of months) {
    try {
      const c = await callApi<{ daily539Res?: Array<{ period: number; lotteryDate: string; drawNumberSize: number[] }> }>(
        'Daily539Result',
        m
      );
      const list = c.daily539Res ?? [];
      for (const d of list) {
        all.push({
          drawTerm: String(d.period),
          drawDate: toIsoDate(d.lotteryDate),
          numbers: [...d.drawNumberSize].sort((a, b) => a - b),
        });
      }
      console.log(`  ✓ 539 ${m}: ${list.length} 期`);
    } catch (e) {
      console.warn(`  ✗ 539 ${m}: ${(e as Error).message}`);
    }
  }
  return all;
}

export async function fetchLotto649(monthsBack: number): Promise<Draw[]> {
  const months = ymList(monthsBack);
  const all: Draw[] = [];
  for (const m of months) {
    try {
      const c = await callApi<{
        lotto649Res?: Array<{
          period: number;
          lotteryDate: string;
          drawNumberSize: number[];
        }>;
      }>('Lotto649Result', m);
      const list = c.lotto649Res ?? [];
      for (const d of list) {
        // drawNumberSize: 前 6 個是主號 (官方已排序),第 7 個是特別號
        const main = d.drawNumberSize.slice(0, 6).sort((a, b) => a - b);
        const special = d.drawNumberSize[6];
        all.push({
          drawTerm: String(d.period),
          drawDate: toIsoDate(d.lotteryDate),
          numbers: main,
          secondZone: [special],
        });
      }
      console.log(`  ✓ lotto649 ${m}: ${list.length} 期`);
    } catch (e) {
      console.warn(`  ✗ lotto649 ${m}: ${(e as Error).message}`);
    }
  }
  return all;
}

export async function fetchSuperLotto(monthsBack: number): Promise<Draw[]> {
  const months = ymList(monthsBack);
  const all: Draw[] = [];
  for (const m of months) {
    try {
      const c = await callApi<{
        superLotto638Res?: Array<{ period: number; lotteryDate: string; drawNumberSize: number[] }>;
      }>('SuperLotto638Result', m);
      const list = c.superLotto638Res ?? [];
      for (const d of list) {
        const main = d.drawNumberSize.slice(0, 6).sort((a, b) => a - b);
        const second = d.drawNumberSize.slice(6);
        all.push({
          drawTerm: String(d.period),
          drawDate: toIsoDate(d.lotteryDate),
          numbers: main,
          secondZone: second,
        });
      }
      console.log(`  ✓ superlotto ${m}: ${list.length} 期`);
    } catch (e) {
      console.warn(`  ✗ superlotto ${m}: ${(e as Error).message}`);
    }
  }
  return all;
}

export async function readExisting(filePath: string): Promise<Draw[]> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return [];
  }
}

export function mergeDraws(existing: Draw[], fresh: Draw[]): Draw[] {
  const map = new Map<string, Draw>();
  // 新的覆蓋舊的 (萬一資料修正)
  [...existing, ...fresh].forEach((d) => map.set(d.drawTerm, d));
  return Array.from(map.values()).sort((a, b) => b.drawDate.localeCompare(a.drawDate));
}

export async function writeDraws(filePath: string, draws: Draw[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(draws, null, 2), 'utf8');
}

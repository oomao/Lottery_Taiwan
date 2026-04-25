import * as XLSX from 'xlsx';
import type { Draw, GameConfig } from './types';

// 把 Draw[] 匯出成 Excel
export function exportDrawsToExcel(
  draws: Draw[],
  game: GameConfig,
  options: { startDate?: string; endDate?: string; filename?: string } = {}
): void {
  const { startDate, endDate, filename } = options;

  // 組欄位 - 動態依 pickCount + 是否有第二區
  const rows = draws.map((d) => {
    const sorted = [...d.numbers].sort((a, b) => a - b);
    const row: Record<string, string | number> = {
      期別: d.drawTerm,
      開獎日: d.drawDate,
    };
    sorted.forEach((n, i) => {
      row[`號碼${i + 1}`] = n;
    });
    if (game.hasSecondZone && d.secondZone) {
      d.secondZone.forEach((n, i) => {
        row[`${game.hasSecondZone!.label}${i + 1}`] = n;
      });
    }
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // 自動調整欄寬 (簡易版)
  const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
    wch: Math.max(key.length * 2, 10),
  }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  const sheetName = `${game.shortName}開獎紀錄`;
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // 加一張說明 sheet
  const meta = [
    { 項目: '彩種', 內容: game.name },
    { 項目: '匯出時間', 內容: new Date().toLocaleString('zh-TW') },
    { 項目: '起始日', 內容: startDate ?? '(不限)' },
    { 項目: '結束日', 內容: endDate ?? '(不限)' },
    { 項目: '總期數', 內容: draws.length },
  ];
  const metaSheet = XLSX.utils.json_to_sheet(meta);
  metaSheet['!cols'] = [{ wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(workbook, metaSheet, '匯出資訊');

  const defaultName = buildFilename(game.shortName, startDate, endDate);
  XLSX.writeFile(workbook, filename ?? defaultName);
}

function buildFilename(gameName: string, startDate?: string, endDate?: string): string {
  const parts = [gameName, '開獎紀錄'];
  if (startDate || endDate) {
    parts.push(`${startDate ?? ''}_${endDate ?? ''}`);
  } else {
    parts.push(new Date().toISOString().slice(0, 10));
  }
  return `${parts.join('_')}.xlsx`;
}

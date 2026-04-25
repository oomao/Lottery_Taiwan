// 共用型別定義

export type GameId = '539' | 'lotto649' | 'superlotto';

export interface GameConfig {
  id: GameId;
  name: string;            // 顯示名稱: "今彩 539"
  shortName: string;       // 短名稱: "539"
  numberRange: [number, number];   // 主區號碼範圍 [min, max]
  pickCount: number;                // 主區開幾顆
  hasSecondZone?: {                  // 第二區 (威力彩才有)
    range: [number, number];
    pickCount: number;
    label: string;
  };
  drawSchedule: string;             // 人類可讀的開獎時間說明
  ballColor: 'red' | 'blue' | 'yellow';
  description?: string;
}

// 一期開獎紀錄
export interface Draw {
  drawTerm: string;        // 期別 例如 "114000123"
  drawDate: string;        // ISO 日期 "2026-04-25"
  numbers: number[];       // 主區號碼,已排序
  secondZone?: number[];   // 第二區號碼 (威力彩)
}

// 統計結果通用型別
export interface ComboStat {
  combo: number[];         // 號碼組合 [3, 12]
  count: number;           // 出現次數
  weightedScore: number;   // 衰減加權分數
  gap: number;             // 距離上次出現幾期
  lastSeenTerm?: string;   // 上次出現期別
  lift?: number;           // 共現相對機率
}

export interface FrequencyStat {
  number: number;
  count: number;
  weightedScore: number;
  gap: number;
}

// 統計檔案的封裝
export interface StatsFile {
  generatedAt: string;     // 生成時間 ISO
  totalDraws: number;      // 統計期數
  windowSize: number | null; // 視窗大小 (null 表示全部)
  decayFactor: number;     // 衰減係數
  data: ComboStat[];
}

// Excel 匯出選項
export interface ExportOptions {
  startDate?: string;
  endDate?: string;
  filename?: string;
}

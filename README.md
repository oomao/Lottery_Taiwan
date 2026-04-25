# 台灣運彩資訊網

針對 **今彩 539、大樂透、威力彩** 提供開獎查詢、統計分析、組合推薦工具,純靜態部署於 GitHub Pages。

🌐 **線上網址**: https://oomao.github.io/Lottery_Taiwan/

---

## 📊 資料來源

本站所有開獎資料由 GitHub Actions 排程自動從 **台灣彩券股份有限公司官方 API** 取得:

- **API Endpoint**: `https://api.taiwanlottery.com/TLCAPIWeB/Lottery/`
  - 今彩 539: `Daily539Result`
  - 大樂透: `Lotto649Result`
  - 威力彩: `SuperLotto638Result`
- **官方網站**: https://www.taiwanlottery.com/
- **資料範圍**: 約 2023 年 5 月起至今 (官方 API 提供範圍)
- **更新頻率**: 每日台灣時間 21:30 (開獎後 1 小時) 自動同步

> ⚠️ **本站僅提供統計與查詢服務,所有中獎號碼以台灣彩券公司官方公告為準**。
> 如本站資料與官方有出入,概以官方為準。

> 📚 抓取邏輯參考自開源專案 [stu01509/TaiwanLotteryCrawler](https://github.com/stu01509/TaiwanLotteryCrawler) (Apache-2.0)。
> 本專案以 TypeScript 重新實作 fetcher,可獨立運作於 GitHub Actions。

---

## ✨ 功能總覽

### 今彩 539 (主力)
- **開獎查詢** — 上期號碼大字顯示、歷史紀錄表格、日期範圍篩選、Excel 匯出
- **統計分析** — 號碼頻率長條圖、熱門/冷門 Top 5、遺漏值表、走勢熱力圖、大小/奇偶/連號分析
- **二合 / 三合 / 四合推薦** — 7 種演算法可切換比較:
  - 🏆 綜合推薦 (預設,加權各方法)
  - 📊 純頻率
  - ⚡ 衰減加權
  - ⏳ 遺漏值
  - 🎯 邊際機率
  - 🔗 共現分析 (Lift)
  - 🔄 馬可夫鏈
- **選號工具** — 純隨機 / 熱號加權 / 冷號加權 / 遺漏值加權,可排除指定號碼
- **守號清單** — localStorage 儲存,純前端不上傳

### 大樂透 / 威力彩
- 上期開獎、歷史紀錄查詢、Excel 匯出
- 與 539 共用同一套架構,進階功能可日後擴充

### 通用
- 🌗 亮 / 暗 / 跟隨系統 三種主題
- 📱 完整響應式設計
- 📦 PWA 離線可用 (歷史資料快取)

---

## 🛠️ 技術選型

| 類別 | 技術 |
|---|---|
| 前端 | Vite + React 18 + TypeScript |
| 樣式 | Tailwind CSS |
| 路由 | React Router (HashRouter,適配 Pages 靜態部署) |
| 圖表 | Recharts |
| Excel 匯出 | SheetJS (xlsx) |
| 資料管線 | Node.js + tsx + 台彩官方 API |
| CI/CD | GitHub Actions (排程資料更新 + 自動部署 Pages) |

---

## 📁 目錄結構

```
.
├── .github/workflows/
│   ├── update-data.yml          # 每日 21:30 排程 + 手動觸發抓資料
│   └── deploy-pages.yml         # Push 自動部署 Pages
├── public/data/<game>/          # 預先計算的 JSON 資料,前端 fetch
│   ├── raw.json                 # 開獎原始資料
│   └── stats-{pair,triplet,quad}.json
├── scripts/
│   ├── fetchers/                # 各彩種 fetcher (呼叫官方 API)
│   ├── stats/                   # 預算統計
│   └── update-all.ts            # 一鍵更新入口
├── src/
│   ├── components/              # UI 元件
│   │   ├── stats/               # B 系列統計分析
│   │   ├── combo/               # 二/三/四合推薦
│   │   ├── picker/              # 選號工具
│   │   └── ui/Ball.tsx          # 號碼球
│   ├── lib/
│   │   ├── games/               # 三個彩種設定
│   │   ├── stats/               # 演算法 (frequency/combo/recommend)
│   │   ├── data-loader.ts
│   │   ├── export-excel.ts
│   │   └── theme.ts
│   └── routes/                  # 各頁面
└── docs/
    └── ML_FUTURE_PLAN.md        # ML (LSTM/XGBoost) 階段未來規劃
```

---

## 🚀 開發

```bash
npm install
npm run dev          # 開發伺服器 → http://localhost:5173
npm run build        # 產生 dist/
npm run update:all   # 抓真實資料 + 算統計 (本機測試)
```

### 環境變數
- `MONTHS_BACK`:回填多少個月歷史 (1-36,預設 12)
  - 範例:`MONTHS_BACK=36 npm run update:all` (抓滿 3 年)

---

## 🌍 部署 (GitHub Pages)

### 一次性設定
1. Settings → Pages → Source 選 `GitHub Actions`
2. Settings → Actions → General → Workflow permissions 改 `Read and write permissions`

### 自動運作
- **資料更新**:每日台灣時間 21:30 自動跑 → commit → push
- **網站部署**:Push 觸發 `deploy-pages.yml` → 自動 build & 部署
- **手動補資料**:Actions 分頁 → `Update Lottery Data` → `Run workflow` → 可選 `months_back` 1-36

### 防 60 天無活動停用
Workflow 內含 heartbeat 機制,即使資料未變也會 commit 時間戳,確保排程永不停用。

---

## 🧮 演算法說明

詳見 [src/lib/stats/recommend.ts](src/lib/stats/recommend.ts) 的註解。簡述如下:

| 方法 | 公式 | 適合 |
|---|---|---|
| 純頻率 | `count` | 二合 |
| 衰減加權 | `Σ count × 0.97^age` | 二合、三合 |
| 遺漏值 | `期距上次出現幾期` | 各合(賭徒謬誤,僅參考) |
| 邊際機率 | `Π P(n)` | **四合** (稀疏資料的解法) |
| Lift | `geomean(P(A,B) / (P(A)P(B)))` | 二合、三合 |
| 馬可夫鏈 | `Π max_l P(n \| l)` | 給定上期的條件預測 |
| 綜合推薦 | `0.3·weighted + 0.3·marginal + 0.2·lift + 0.2·markov` (各標準化) | 預設首選 |

### 隨機基準
為了避免使用者誤判,UI 會同時顯示 **「該組合在 N 期裡的隨機期望出現次數」**:

```
P(任一固定 k-合在某期出現) = C(pickCount, k) / C(numberCount, k)
期望次數 = N × P
```

例:539 抽 5,二合的隨機基準 = 10/741 ≈ 1.35%/期。907 期約期望 12 次。

---

## 🔮 未來規劃

詳見 [docs/ML_FUTURE_PLAN.md](docs/ML_FUTURE_PLAN.md):

- LSTM (TensorFlow.js) 時序模型
- LSTM + XGBoost 混合架構
- GitHub Actions 訓練 pipeline
- 前端推論部署

目前專案以**統計演算法為主軸**,ML 階段保留架構彈性、可日後接入。

---

## ⚠️ 免責聲明

1. 本站為**個人興趣製作**,非台灣彩券公司官方網站。
2. **所有中獎號碼以台灣彩券公司公告為準**,本站資料如有誤差概以官方為準。
3. 樂透為**獨立隨機事件**,任何統計或推薦演算法找出的「規律」都是歷史微小偏差,**不能真正提高中獎率**。請理性參考、量力而為。
4. 本站無投注功能,僅提供查詢與分析。

---

## 📜 授權

MIT License (除引用之第三方資源以其原始授權為準)。

資料來源:[台灣彩券公司](https://www.taiwanlottery.com/) ‧ Crawler 邏輯參考:[stu01509/TaiwanLotteryCrawler](https://github.com/stu01509/TaiwanLotteryCrawler)

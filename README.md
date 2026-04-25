# 台灣彩券資訊網

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

本站的「二/三/四合推薦」頁提供 7 種演算法,可即時切換。每種有其數學基礎、適用場景與限制。

> 程式實作位於 [src/lib/stats/recommend.ts](src/lib/stats/recommend.ts)

### 速查表

| 方法 | 核心公式 | 計算範圍 | 最適合 | 備註 |
|---|---|---|---|---|
| 🏆 綜合推薦 | `0.3·w + 0.3·m + 0.2·l + 0.2·k` (標準化後) | 全部 C(39,k) | 不確定該用哪個時 | 預設,折衷 |
| 📊 純頻率 | `count` | 已觀察組合 | 二合 | 對 4 合無鑑別力 |
| ⚡ 衰減加權 | `Σ 0.97^age` | 已觀察組合 | 二合、三合 | 強調近期 |
| ⏳ 遺漏值 | `current - last_seen` | 已觀察組合 | 想押冷組合 | ⚠️ 賭徒謬誤 |
| 🎯 邊際機率 | `Π P(n)` | 全部 C(39,k) | **四合** | 稀疏資料救星 |
| 🔗 共現 (Lift) | `geomean(Lift(a,b))` | 全部 C(39,k) | 二合、三合 | 找「有伴」的號 |
| 🔄 馬可夫鏈 | `Π max_l P(n\|l)` | 全部 C(39,k) | 結合上期動態 | 一階轉移矩陣 |

---

### 1. 純頻率 (Frequency)

**公式**:`score = count(組合在 N 期內出現幾次)`

**白話**:就是數這個組合在統計範圍內被開出來幾次。

**適合**:
- ✅ 二合 (907 期可累積到 12+ 次,有統計意義)
- ❌ 三合 (平均 ~1 次,鑑別力低)
- ❌ 四合 (95% 組合是 0 次,完全無意義)

**注意**:即使 12 次也只是樣本估計,真實機率仍是固定的 1.35%。看到「出現 20 次」不代表這組合更容易中。

---

### 2. 衰減加權 (Time Decay Weighted)

**公式**:`score = Σ 0.97^age`,其中 `age` = 該期距今多少期

**白話**:每出現一次給一個權重,但越久遠權重越小。最新一期權重 1.0,30 期前 ~0.4,100 期前 ~0.05。

**設計理念**:如果樂透機本身有微小偏差(例如某顆球磨損),那「近期出現多」應該比「遠古出現多」更有訊息。

**適合**:二合,想偏向「最近熱」的組合。

**參數**:衰減係數 `decay = 0.97` 在 [src/lib/stats/recommend.ts](src/lib/stats/recommend.ts) 可調。

---

### 3. 遺漏值 (Gap / Cold Reversal)

**公式**:`score = 距離上次出現的期數`

**白話**:越久沒開的組合排越前面。

**注意 ⚠️**:這是**賭徒謬誤**的數學包裝。樂透為 IID(獨立同分布),過去未出現不代表下次更可能出。

**為什麼還做**:很多老彩迷愛看「遺漏值表」,有娛樂價值。本站誠實標註其限制。

**有趣的事實**:在 907 期裡,某組合「平均應該每 74 期出現一次」(對二合而言),但實際分布是泊松,有些組合可能 200 期沒出 — 不代表它「該開了」。

---

### 4. 邊際機率 (Marginal Probability)

**公式**:`P(combo) ≈ P(n₁) × P(n₂) × ... × P(nₖ)`

其中 `P(n) = (n 出現次數) / 總期數`

**白話**:假設「組合內每個號碼是否出現」彼此獨立,那組合機率就是各自單號機率的連乘。

**這個方法的核心優勢**:就算這組合**從未出現過**,也能由「組成它的單號各自的頻率」估出機率。

**適合**:🎉 **四合**。當其他方法因資料稀疏而失效,這個方法仍能排序所有 82,251 種組合。

**注意**:
- 「獨立」是近似,實際上 539 是「不重複抽 5 顆」,有微弱負相關 (一顆出來其他顆機率被排擠)
- 精確版本應用「不重複抽樣的超幾何分布」,本站用獨立近似為了計算效率

---

### 5. 共現分析 (Lift / Co-occurrence)

**公式**(對二合):
```
Lift(A, B) = P(A 和 B 同期出現) / (P(A) × P(B))
```
- Lift = 1: 獨立 (剛好等於隨機預期)
- Lift > 1: 正相關 (常一起出現)
- Lift < 1: 負相關 (很少一起出現)

對三合、四合,用所有號碼對的 lift 取**幾何平均** (避免一個極小值毀掉整個分數):
```
score(combo) = exp(mean(log(Lift(aᵢ, aⱼ)))) for all pairs in combo
```

**白話**:找「互相帶」的號碼組合 — 如果 7 跟 23 異常常一起出現,Lift 會 > 1,這個組合排序就會往前。

**適合**:二合、三合 (要有足夠樣本才有統計意義)

**注意**:對小資料,Lift 可能因偶然極端 (例如某對只出現 2 次但其他都沒出現),要看樣本量。

---

### 6. 馬可夫鏈 (Markov Chain)

**公式**:
```
T[a][b] = P(下期含號碼 b | 本期含號碼 a)
       = (本期含 a 且下期含 b 的次數) / (本期含 a 的次數)

score(combo, lastDraw) = Π_{n in combo} max_{l in lastDraw} T[l][n]
```

**白話**:統計「某號出現後下期某號跟著出現」的條件機率,然後給定上期實際開的 5 個號,預測下期最可能出的組合。

**適合**:結合「上期開了什麼」做動態預測,尤其在開獎當天看當期下注靈感。

**注意**:這是**一階馬可夫**(只看前 1 期)。理論上可以做高階(看前 5 期、10 期),但資料量會不夠。

---

### 7. 綜合推薦 (Composite Ensemble)

**公式**(每個分數先標準化到 [0,1]):
```
composite_score = 0.3 × weighted_norm
                + 0.3 × marginal_norm
                + 0.2 × lift_norm
                + 0.2 × markov_norm
```

**白話**:把上面四種方法各自標準化後加權平均,試圖避免單一方法的偏差。

**權重選擇理由**:
- weighted (近期表現) 跟 marginal (理論機率) 各佔 30% — 兩個最穩的指標
- lift 跟 markov 各 20% — 試圖加進「組合內互動」的資訊但不過度依賴

**為什麼是預設**:對使用者來說最不容易誤導 — 不會偏向任何單一假設。

---

### 隨機基準 (Random Baseline)

為了避免使用者誤把「Top 5 推薦」當成「中獎機率較高」,UI 會同時顯示**任一固定組合在 N 期裡的隨機期望出現次數**:

```
P(某固定 k-合在某期出現) = C(pickCount, k) / C(numberRange, k)
期望次數 = N × P
```

對 539 (range 39, pick 5):
| 合數 | 隨機機率/期 | 907 期期望次數 |
|---|---|---|
| 二合 | 10/741 ≈ 1.35% | ~12 次 |
| 三合 | 10/9139 ≈ 0.11% | ~1 次 |
| 四合 | 5/82251 ≈ 0.006% | ~0.05 次 |

**怎麼解讀**:如果某二合出現 15 次,只比平均 12 次多 25%,在 907 樣本下這個差距大概率是抽樣雜訊,不是真訊號。

---

### 🤖 LSTM 模型 (ML 階段)

獨立的「ML 模型」分頁提供:
- **Bidirectional LSTM** (60 期窗口 → 39 維 sigmoid 機率)
- 82 維特徵 / 期 (39 multi-hot + 4 統計 + 39 各號遺漏值)
- **顯著性測試**: 配對 t-test 比較模型 vs 隨機基準
- **完整對比**: model_avg_hits / random_hits / improvement / p-value / 95% CI

預期結果(誠實版): 樂透為 IID,模型表現應**接近隨機基準** (p > 0.05),這證明抽獎是公平的。

詳細實作細節見 [docs/ML_FUTURE_PLAN.md](docs/ML_FUTURE_PLAN.md) 與 [scripts/ml/](scripts/ml/)。

---

## 🔮 未來規劃 / 維運手冊

> 不確定怎麼做的時候,先看這裡。每個情境都有獨立文件可參考。

### 📌 情境速查

| 我想... | 看哪個文件 |
|---|---|
| **🛑 停止每天自動抓資料** (要省事 / 不再用 / 改回只手動) | → [docs/HOW_TO_DISABLE_SCHEDULE.md](docs/HOW_TO_DISABLE_SCHEDULE.md) |
| **🤖 加強 ML 模型** (LSTM/XGBoost 混合、Hybrid、其他模型) | → [docs/ML_FUTURE_PLAN.md](docs/ML_FUTURE_PLAN.md) |
| **🔄 改變抓取頻率** (每週、每小時、每月某天) | → [docs/HOW_TO_DISABLE_SCHEDULE.md](docs/HOW_TO_DISABLE_SCHEDULE.md) 「重新開啟自動排程」段落 |
| **📊 加新彩種** (3 星彩、4 星彩...) | 在 [src/lib/games/](src/lib/games/) 新增 config,在 [scripts/fetchers/](scripts/fetchers/) 寫 fetcher |
| **🎨 改主題色** | 編輯 [tailwind.config.js](tailwind.config.js) 的 `brand` 色 |

### 🛑 停用自動排程 (3 種做法摘要)

完整步驟見 → **[docs/HOW_TO_DISABLE_SCHEDULE.md](docs/HOW_TO_DISABLE_SCHEDULE.md)**

| 場景 | 做法 | 是否可逆 |
|---|---|---|
| 暫停 1-2 週 | GitHub 網頁直接 Disable workflow | ✅ 隨時 Enable 回來 |
| 改成只能手動觸發 | 改 YAML 移除 `schedule:` 區塊 | ✅ 加回來就好 |
| 完全不想用了 | `git rm .github/workflows/update-data.yml` | ✅ 但要重寫 |

### 🤖 機器學習延伸

完整 roadmap 見 → **[docs/ML_FUTURE_PLAN.md](docs/ML_FUTURE_PLAN.md)**

目前已實作 (階段 D-基礎):
- ✅ LSTM (TensorFlow.js) 時序模型 + WASM 後端
- ✅ GitHub Actions 訓練 pipeline (`workflow_dispatch` 觸發)
- ✅ 前端動態 import 推論
- ✅ p-value + 95% CI 對比隨機基準

未來可擴充:
- LSTM + XGBoost Hybrid (PDF 推薦組合)
- 大樂透 / 威力彩 各自的模型
- 線上微調 (使用者可自選超參數)

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

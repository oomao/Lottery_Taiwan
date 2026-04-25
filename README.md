# 台灣運彩資訊網

539、大樂透、威力彩 開獎查詢、統計分析、組合推薦工具,純靜態部署於 GitHub Pages。

## 技術選型

- **前端**:Vite + React + TypeScript + Tailwind CSS
- **路由**:React Router (HashRouter,適配 Pages 靜態部署)
- **圖表**:Recharts
- **Excel 匯出**:SheetJS (xlsx)
- **資料管線**:Node.js + tsx scripts,GitHub Actions 手動觸發

## 目錄結構

```
.
├── public/data/<game>/   # 預先計算好的 JSON,前端 fetch
├── scripts/              # 抓資料 + 預算統計
├── src/
│   ├── components/       # UI 元件
│   ├── lib/              # 型別、遊戲設定、統計演算法
│   └── routes/           # 頁面
└── .github/workflows/    # CI:更新資料、部署 Pages
```

## 開發

```bash
npm install
npm run dev          # 開發伺服器
npm run build        # 產生 dist/
npm run update:all   # 抓資料 + 算統計 (本機測試)
```

## 部署 (GitHub Pages)

1. Push 到 GitHub `main` branch
2. Settings → Pages → Source 選 `GitHub Actions`
3. Settings → Actions → General → Workflow permissions 改 `Read and write`
4. `deploy-pages.yml` 會自動部署
5. 想更新資料時,Actions 分頁 → `Update Lottery Data` → `Run workflow`

## 已實作

- [x] 專案骨架 + 路由
- [x] 遊戲設定抽象化 (539 / 大樂透 / 威力彩 共用)
- [x] 開獎查詢頁面 (期間篩選、分頁、Excel 匯出)
- [x] 統計演算法 (頻率、衰減加權、遺漏值、二/三/四合)
- [x] 手動觸發 + Pages 自動部署 workflow

## 待辦

- [ ] 539 實際 parser (待確認台彩 API/HTML 結構)
- [ ] 統計分析頁面 (頻率圖、冷熱號)
- [ ] 組合推薦頁面 (二/三/四合切換)
- [ ] 選號工具 (隨機 / 加權 / 排除)
- [ ] 對獎工具 (localStorage 投注紀錄)
- [ ] ML 預測模型 (TensorFlow.js,實驗性質)
- [ ] 大樂透 / 威力彩 頁面實作

## 免責聲明

本站為統計工具,中獎號碼以台灣彩券公告為準。樂透為獨立隨機事件,任何統計或預測都不能提高中獎率,僅供參考。

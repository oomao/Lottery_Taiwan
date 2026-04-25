# 如何停用 / 重啟資料更新排程

> 目前設定:每日台灣時間 21:30 自動跑 `Update Lottery Data` workflow,從台彩官方 API 抓最新資料。

依「想停多久 / 停多徹底」三種做法:

---

## 方法 1:GitHub 網頁直接停用 (最快、可逆)

**適用情境**:臨時停用一陣子,之後可能還想跑回來。**不改任何程式碼。**

### 步驟
1. 開 https://github.com/oomao/Lottery_Taiwan/actions
2. 左側選單點 **`Update Lottery Data`** workflow
3. 右上角 `···` (三個點) → **Disable workflow**

### 效果
- 排程跟手動觸發**同時暫停**
- 想開回來:同一個位置點 **Enable workflow**
- repo 和程式碼**完全不變**

✅ 推薦先用這個 — 最沒壓力、隨時可逆

---

## 方法 2:只關掉排程,保留手動觸發 (改 code)

**適用情境**:不想每天自動跑,但偶爾想手動補資料時還能用按鈕。

### 步驟
編輯 [.github/workflows/update-data.yml](../.github/workflows/update-data.yml),把 `schedule:` 那 3 行刪掉:

```yaml
on:
  schedule:                        # ← 刪除這行
    - cron: '30 13 * * *'          # ← 刪除這行 (從這個 - 開始整行)
  workflow_dispatch:               # ← 保留
    inputs:
      ...
```

改完應該長這樣:
```yaml
on:
  workflow_dispatch:
    inputs:
      months_back:
        ...
```

然後 commit + push:
```bash
git add .github/workflows/update-data.yml
git commit -m "chore: stop auto schedule, keep manual only"
git push
```

### 效果
- 排程停止
- Actions 分頁仍可手動 `Run workflow`(就是回到我們最早的設計)

---

## 方法 3:完全刪除整個 workflow (永久)

**適用情境**:整個專案不再更新資料,或要砍掉重練。

### 步驟
```bash
git rm .github/workflows/update-data.yml
git commit -m "chore: remove auto-update workflow"
git push
```

### 效果
- 從此 repo 不再有「更新資料」的 workflow
- 想跑要重新建一個檔案
- 已抓的歷史資料(`public/data/`)**仍保留**,網站還是看得到

---

## 注意事項

### 60 天無活動會自動停用
如果用 **方法 1 (Disable)** 停用排程超過 60 天,GitHub 會把整個 schedule 永久停掉。需要時記得回去 Enable 並推一次任意 commit。

### 我的建議
- **暫停 1 週內**:方法 1
- **不再每天跑、改成有需要才按**:方法 2
- **整個功能都不要了**:方法 3

---

## 重新開啟自動排程

如果你之前用方法 2 把 schedule 拿掉了,想再加回來:

編輯 `.github/workflows/update-data.yml`,在 `on:` 底下加回:

```yaml
on:
  schedule:
    - cron: '30 13 * * *'   # 台灣時間 21:30
  workflow_dispatch:
    inputs:
      ...
```

可調整 cron 時間(線上工具:https://crontab.guru/),例如:
- `'0 13 * * *'` → 台灣 21:00
- `'0 14 * * 1-6'` → 台灣 22:00 但只有週一到週六
- `'0 */6 * * *'` → 每 6 小時跑一次(對 539 過於頻繁,不建議)

push 後,排程會自動生效,**第一次觸發可能需要等到下一個整點**。

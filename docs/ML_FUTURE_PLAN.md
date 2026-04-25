# 機器學習階段 (D) — 未來規劃

> 本文件規劃如何在現有架構上加入 LSTM / XGBoost / 混合模型,於 GitHub Pages 提供前端推論。
> 對應使用者文件 [機器學習預測今彩539機率.pdf] 中的方法 4 (LSTM)、方法 5 (Hybrid)。

## 為何放未來規劃,不立即做

1. **效益不確定**:樂透是 IID 隨機事件 (官方使用機械開獎、通過公正性驗證),理論上 ML 模型表現會收斂到隨機基準。可能花數天訓練,結果跟階段 A+B+C 的統計法一樣甚至更差。
2. **Bundle 體積**:TF.js core ~1MB + 模型檔 2-5MB,首次載入體驗會降。
3. **訓練 pipeline 複雜**:需 Python 環境、Colab 或 Actions 排程,跨語言。
4. **目前統計法已足夠展示**:階段 A+B+C 已經提供 6 種演算法,使用者可自行切換比較。

## 何時值得做

✅ **學習目的** — 想跑完整 ML pipeline 練習(資料工程 → 訓練 → 部署 → 前端推論)
✅ **Portfolio 加分** — 能在面試誠實地說「我做了個 ML 樂透預測,結論是樂透真的隨機」反而很有說服力
✅ **互動展示** — 大家點「ML 推薦」看跟其他方法的差異,UI 上很吸睛

❌ **不該做的理由**:期待真的提高中獎率

## 完整 Pipeline 設計

```
┌─────────────────────────────────────────────────────────┐
│  GitHub Actions: Train ML Model (workflow_dispatch)     │
├─────────────────────────────────────────────────────────┤
│  1. Setup Python 3.10 + numpy/pandas/sklearn/tensorflow │
│  2. Read public/data/539/raw.json                        │
│  3. Feature engineering (滑動窗口/和值/奇偶/遺漏值)        │
│  4. Train LSTM (Keras) on train/val split                │
│  5. Evaluate on holdout test set                         │
│  6. Convert to TF.js: tensorflowjs_converter             │
│  7. Output: public/models/539/{model.json, *.bin}       │
│  8. Auto commit + push                                   │
└─────────────────────────────────────────────────────────┘
                          ↓
            (GitHub Pages auto deploy)
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Browser: Frontend Inference                            │
├─────────────────────────────────────────────────────────┤
│  1. tf.loadLayersModel('models/539/model.json')          │
│  2. Build input from latest 60 draws → tf.tensor3d       │
│  3. model.predict() → [batch, 39] softmax                │
│  4. Greedy combo: top-K numbers → 二/三/四合 候選          │
│  5. UI: 列在 ComboRecommend 旁邊一個新方法 "ML 推薦"        │
└─────────────────────────────────────────────────────────┘
```

## 模型架構建議 (依 PDF)

```python
# scripts/ml/train_lstm.py (示意)
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout, Bidirectional

model = Sequential([
    Bidirectional(LSTM(64, return_sequences=True), input_shape=(60, 39 + extras)),
    Dropout(0.3),
    Bidirectional(LSTM(32, return_sequences=False)),
    Dropout(0.3),
    Dense(64, activation='relu'),
    Dense(39, activation='sigmoid')  # 39 個獨立 binary head:每號是否會出
])
model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
```

### 輸入特徵 (per timestep)
- 39 維 multi-hot:該期是否出現該號
- + sum (該期 5 號和值,正規化)
- + odd_count、big_count
- + days since last draw of each number (正規化)
→ 共 ~80 維

### 訓練/驗證/測試切分
- 訓練 70% (約 630 期)
- 驗證 15% (約 135 期)
- 測試 15% (約 135 期) ← **不可碰**,最後驗收

### 評估指標
- 命中率 = 模型 top-5 預測中,有幾個出現在實際開獎
- 隨機基準:5/39 ≈ 12.8%(每號)
- 模型若顯著 > 隨機基準 → 有訊號 (大概率不會)
- 同時顯示 p-value,避免抽樣雜訊誤判

## 進階方案:LSTM + XGBoost 混合

依 PDF 章節「方案四」建議:

1. LSTM 學序列特徵,匯出隱藏層 embedding (64 維)
2. 工程特徵 (頻率、遺漏、Lift) 約 100 維
3. concat 起來丟 XGBoost (39 個 one-vs-all 分類器)
4. PDF 範例:RMSE 80.2 → 55.1 (31.3% 改善)

複雜度高,建議純 LSTM 先做完再考慮。

## 部署考量

### Bundle 大小
- TF.js core (lazy import): ~1MB gzip
- LSTM 模型 (估): 2-5MB
- 對策:
  - 用 `import('@tensorflow/tfjs')` 動態載入,只在使用者切到「ML 推薦」分頁才下載
  - 模型分片: `tensorflowjs_converter --weight_shard_size_bytes=5000000`
  - Service Worker 已設定快取,第二次載入秒開

### 後端引擎選擇
依 PDF benchmark,LSTM 在前端應選 **WASM** 不選 WebGPU:
- WebGPU 因 GPU↔JS 資料來回 (`dataSync()`),對序列模型反而慢
- WASM 比純 JS CPU 快 10-30 倍

```ts
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';

await tf.setBackend('wasm');
await tf.ready();
```

## 預估工時

| 任務 | 工時 |
|---|---|
| 特徵工程腳本 | 4-6h |
| 訓練腳本 + 超參調整 | 6-10h |
| GitHub Actions 訓練 workflow | 2-3h |
| TF.js 前端載入 + tensor 轉換 | 4-6h |
| 推論 + 組合排序 UI | 4h |
| 隨機基準對比視覺化 | 2-3h |
| **總計** | **22-32 小時** |

## 啟動清單 (真要做時)

```bash
# 1. 建立 ML 訓練資料夾結構
mkdir -p scripts/ml
mkdir -p public/models/539

# 2. 寫訓練腳本
touch scripts/ml/train_lstm.py
touch scripts/ml/feature_engineering.py
touch scripts/ml/convert_to_tfjs.py

# 3. requirements
echo "tensorflow>=2.15
tensorflowjs>=4.0
pandas
numpy
scikit-learn" > scripts/ml/requirements.txt

# 4. 加 workflow
touch .github/workflows/train-model.yml

# 5. 前端依賴
npm install @tensorflow/tfjs @tensorflow/tfjs-backend-wasm

# 6. 新元件
mkdir -p src/components/ml
touch src/components/ml/MLRecommend.tsx
touch src/lib/ml/inference.ts
```

## 替代方案 (更輕量)

如果不想跑 LSTM,可考慮純前端 ML:
- **TensorFlow.js 直接訓練** (前端訓練) — 把訓練也放瀏覽器,不需 Python
- **brain.js** — 純 JS 神經網路
- **ml5.js** — 包裝 TF.js 的高階 API

優點:無 Python pipeline、Actions 不用編譯
缺點:訓練在使用者瀏覽器跑,慢且每次都要等

## 結論

**目前不做,但保留架構彈性**。階段 A+B+C 已涵蓋 6 種統計演算法,對 539 來說從可解釋性、計算成本、誠實展示「樂透是隨機」的角度,反而比 ML 更務實。

當未來想擴充時,本文件提供完整 roadmap。

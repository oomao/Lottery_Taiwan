"""訓練 LSTM 模型 + 評估 + 匯出 TF.js 格式 + metadata.json

流程:
1. 讀 public/data/539/raw.json (依時序由舊→新)
2. 特徵工程 → (X, y) 切 train 70% / val 15% / test 15%
3. 訓練 Bidirectional LSTM,Adam, binary_crossentropy
4. 在 test set 做評估:
   - 模型 Top-5 平均命中
   - 隨機基準 (5 * 5 / 39 = 0.641 顆/期)
   - 配對 t-test 算 p-value
5. 用 tensorflowjs_converter 匯出到 public/models/539/
6. 寫 metadata.json (含特徵 schema、評估結果、訓練資訊)

執行:python scripts/ml/train_lstm.py 539
"""

import argparse
import json
import sys
import os
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import (
    Bidirectional,
    LSTM,
    Dense,
    Dropout,
    Input,
)
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from scipy import stats

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "ml"))

from feature_engineering import (  # noqa: E402
    NUM_RANGE,
    PICK_COUNT,
    WINDOW_SIZE,
    NUM_FEATURES,
    feature_constants,
    make_xy,
)


def load_draws(game: str) -> list[list[int]]:
    raw_path = ROOT / "public" / "data" / game / "raw.json"
    data = json.loads(raw_path.read_text(encoding="utf-8"))
    # 由舊 → 新 排序
    data.sort(key=lambda d: d["drawDate"])
    return [d["numbers"] for d in data]


def build_model() -> tf.keras.Model:
    model = Sequential(
        [
            Input(shape=(WINDOW_SIZE, NUM_FEATURES)),
            Bidirectional(LSTM(64, return_sequences=True)),
            Dropout(0.3),
            Bidirectional(LSTM(32, return_sequences=False)),
            Dropout(0.3),
            Dense(64, activation="relu"),
            Dense(NUM_RANGE, activation="sigmoid"),
        ]
    )
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="binary_crossentropy",
        metrics=["binary_accuracy"],
    )
    return model


def evaluate_top_k(
    model: tf.keras.Model, X_test: np.ndarray, y_test: np.ndarray, k: int = PICK_COUNT
) -> dict:
    preds = model.predict(X_test, verbose=0)  # [N, 39]

    # 對每個樣本取預測機率最高的 k 個號 (0-indexed,要 +1 才是真實號碼)
    model_hits = []
    for i in range(len(preds)):
        top_k_idx = np.argsort(preds[i])[-k:]
        actual_idx = np.where(y_test[i] > 0.5)[0]
        hits = len(set(top_k_idx) & set(actual_idx))
        model_hits.append(hits)

    model_hits = np.array(model_hits, dtype=np.float32)

    # 隨機基準:從 39 中均勻抽 5 個的期望命中數 = 5 * 5 / 39
    random_baseline = (k * PICK_COUNT) / NUM_RANGE
    # 模擬隨機抽,跟模型做配對 t-test
    rng = np.random.default_rng(42)
    random_hits = []
    for i in range(len(preds)):
        random_pick = rng.choice(NUM_RANGE, size=k, replace=False)
        actual_idx = np.where(y_test[i] > 0.5)[0]
        hits = len(set(random_pick) & set(actual_idx))
        random_hits.append(hits)
    random_hits = np.array(random_hits, dtype=np.float32)

    # 配對 t-test
    diff = model_hits - random_hits
    if np.std(diff) > 1e-9:
        t_stat, p_val = stats.ttest_rel(model_hits, random_hits)
    else:
        t_stat, p_val = 0.0, 1.0

    # 95% CI
    se = np.std(diff, ddof=1) / np.sqrt(len(diff)) if len(diff) > 1 else 0
    ci_low = float(np.mean(diff) - 1.96 * se)
    ci_high = float(np.mean(diff) + 1.96 * se)

    return {
        "test_size": int(len(preds)),
        "k": k,
        "model_avg_hits": float(np.mean(model_hits)),
        "random_baseline_theoretical": float(random_baseline),
        "random_simulated_avg_hits": float(np.mean(random_hits)),
        "improvement_vs_random": float(np.mean(model_hits) - np.mean(random_hits)),
        "t_statistic": float(t_stat),
        "p_value": float(p_val),
        "is_significant_at_0.05": bool(p_val < 0.05),
        "confidence_interval_95": [ci_low, ci_high],
        "model_hits_distribution": {
            str(h): int(np.sum(model_hits == h)) for h in range(k + 1)
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("game", default="539", nargs="?")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--patience", type=int, default=15)
    args = parser.parse_args()

    game = args.game
    print(f"[train] Game: {game}, Epochs: {args.epochs}")

    draws = load_draws(game)
    print(f"[train] Loaded {len(draws)} draws")

    if len(draws) < WINDOW_SIZE + 50:
        print(f"[train] 資料太少 ({len(draws)} < {WINDOW_SIZE + 50}),跳過訓練")
        return

    X, y = make_xy(draws, WINDOW_SIZE)
    print(f"[train] X shape: {X.shape}, y shape: {y.shape}")

    # 時序切分: 70/15/15
    n = len(X)
    n_train = int(n * 0.70)
    n_val = int(n * 0.15)
    X_train, X_val, X_test = X[:n_train], X[n_train : n_train + n_val], X[n_train + n_val :]
    y_train, y_val, y_test = y[:n_train], y[n_train : n_train + n_val], y[n_train + n_val :]
    print(f"[train] Split sizes: train={len(X_train)} val={len(X_val)} test={len(X_test)}")

    model = build_model()
    model.summary()

    callbacks = [
        EarlyStopping(monitor="val_loss", patience=args.patience, restore_best_weights=True),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=5, min_lr=1e-5),
    ]

    history = model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch,
        callbacks=callbacks,
        verbose=2,
    )

    print("[train] Evaluating on test set...")
    eval_result = evaluate_top_k(model, X_test, y_test, k=PICK_COUNT)
    print(json.dumps(eval_result, indent=2))

    # 儲存 Keras 模型 (給轉檔用)
    out_dir = ROOT / "public" / "models" / game
    out_dir.mkdir(parents=True, exist_ok=True)
    keras_path = out_dir / "_keras_model.h5"
    model.save(str(keras_path))
    print(f"[train] Saved Keras model to {keras_path}")

    # 寫 metadata.json
    metadata = {
        "version": "1.0",
        "game": game,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_data": {
            "total_draws": len(draws),
            "first_term_date": draws and "—",
            "window_size": WINDOW_SIZE,
            "train_samples": int(len(X_train)),
            "val_samples": int(len(X_val)),
            "test_samples": int(len(X_test)),
        },
        "model": {
            "architecture": "Bidirectional LSTM (64) -> Dropout -> Bidirectional LSTM (32) -> Dropout -> Dense(64) -> Dense(39, sigmoid)",
            "total_params": int(model.count_params()),
            "input_shape": [WINDOW_SIZE, NUM_FEATURES],
            "output_shape": [NUM_RANGE],
            "epochs_trained": int(len(history.history["loss"])),
            "best_val_loss": float(min(history.history["val_loss"])),
            "final_train_loss": float(history.history["loss"][-1]),
        },
        "feature_schema": feature_constants(),
        "evaluation": eval_result,
    }

    metadata_path = out_dir / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[train] Wrote metadata to {metadata_path}")
    print("[train] Done. Run convert_to_tfjs.py next.")


if __name__ == "__main__":
    main()

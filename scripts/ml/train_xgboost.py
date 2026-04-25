"""訓練 XGBoost (39 個 binary classifier) + 評估 + 匯出 JSON 給前端 JS 用

每個號碼 1..39 訓練獨立的 binary classifier (該號是否在下期出現)。
最終:39 個模型,每個約 100-200 棵深度 4 的樹。
匯出格式為 JSON 樹結構,前端用純 JS 實作 tree traversal,不需要任何 ML 執行庫。

執行:python scripts/ml/train_xgboost.py 539
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import xgboost as xgb
from scipy import stats

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "ml"))

from feature_engineering import (  # noqa: E402
    NUM_RANGE,
    PICK_COUNT,
    WINDOW_SIZE,
    XGB_FEATURE_DIM,
    make_xgboost_xy,
    xgboost_feature_constants,
)


def load_draws(game: str) -> list[list[int]]:
    raw_path = ROOT / "public" / "data" / game / "raw.json"
    data = json.loads(raw_path.read_text(encoding="utf-8"))
    data.sort(key=lambda d: d["drawDate"])
    return [d["numbers"] for d in data]


def train_one(X_train, y_train_n, X_val, y_val_n, n_estimators, max_depth, lr):
    """訓練單一號碼的 binary classifier"""
    model = xgb.XGBClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        learning_rate=lr,
        objective="binary:logistic",
        eval_metric="logloss",
        early_stopping_rounds=15,
        verbosity=0,
        n_jobs=1,
    )
    model.fit(X_train, y_train_n, eval_set=[(X_val, y_val_n)], verbose=False)
    return model


def predict_all(models, X):
    """39 個 binary classifier 各自預測機率,組成 [N, 39] 矩陣"""
    out = np.zeros((len(X), NUM_RANGE), dtype=np.float32)
    for i, m in enumerate(models):
        if m is None:
            out[:, i] = 0.5  # 沒訓練的號 (極端情況),給中性值
            continue
        out[:, i] = m.predict_proba(X)[:, 1]
    return out


def evaluate_top_k(models, X_test, y_test, k=PICK_COUNT):
    preds = predict_all(models, X_test)
    model_hits = []
    for i in range(len(preds)):
        top_k_idx = np.argsort(preds[i])[-k:]
        actual_idx = np.where(y_test[i] > 0.5)[0]
        hits = len(set(top_k_idx) & set(actual_idx))
        model_hits.append(hits)
    model_hits = np.array(model_hits, dtype=np.float32)

    # 隨機基準
    rng = np.random.default_rng(42)
    random_hits = []
    for i in range(len(preds)):
        random_pick = rng.choice(NUM_RANGE, size=k, replace=False)
        actual_idx = np.where(y_test[i] > 0.5)[0]
        hits = len(set(random_pick) & set(actual_idx))
        random_hits.append(hits)
    random_hits = np.array(random_hits, dtype=np.float32)

    diff = model_hits - random_hits
    if np.std(diff) > 1e-9:
        t_stat, p_val = stats.ttest_rel(model_hits, random_hits)
    else:
        t_stat, p_val = 0.0, 1.0

    se = np.std(diff, ddof=1) / np.sqrt(len(diff)) if len(diff) > 1 else 0
    ci_low = float(np.mean(diff) - 1.96 * se)
    ci_high = float(np.mean(diff) + 1.96 * se)

    return {
        "test_size": int(len(preds)),
        "k": k,
        "model_avg_hits": float(np.mean(model_hits)),
        "random_baseline_theoretical": float((k * PICK_COUNT) / NUM_RANGE),
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


def export_to_json(models, base_score=0.5):
    """
    把 39 個 XGBoost 模型匯出成前端可以用的 JSON。
    格式:{ "num_classes": 39, "feature_dim": 160, "trees_per_class": [...], "models": [...] }
    每個 model = { "trees": [tree_json, ...], "base_score": float }
    """
    out = {
        "num_classes": NUM_RANGE,
        "feature_dim": XGB_FEATURE_DIM,
        "models": [],
    }
    for i, m in enumerate(models):
        if m is None:
            out["models"].append({"trees": [], "base_score": base_score})
            continue
        # XGBoost dump_model 回傳 list[str],每個 str 是一棵樹的 JSON
        trees_json = m.get_booster().get_dump(dump_format="json")
        trees = [json.loads(t) for t in trees_json]
        out["models"].append({"trees": trees, "base_score": base_score})
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("game", default="539", nargs="?")
    parser.add_argument("--n_estimators", type=int, default=200)
    parser.add_argument("--max_depth", type=int, default=4)
    parser.add_argument("--lr", type=float, default=0.05)
    args = parser.parse_args()

    game = args.game
    print(f"[xgb] Game: {game}, n_estimators: {args.n_estimators}, depth: {args.max_depth}")

    draws = load_draws(game)
    print(f"[xgb] Loaded {len(draws)} draws")

    if len(draws) < WINDOW_SIZE + 50:
        print(f"[xgb] 資料太少,跳過")
        return

    X, y = make_xgboost_xy(draws, WINDOW_SIZE)
    print(f"[xgb] X shape: {X.shape}, y shape: {y.shape}")

    n = len(X)
    n_train = int(n * 0.70)
    n_val = int(n * 0.15)
    X_train, X_val, X_test = X[:n_train], X[n_train : n_train + n_val], X[n_train + n_val :]
    y_train, y_val, y_test = y[:n_train], y[n_train : n_train + n_val], y[n_train + n_val :]
    print(f"[xgb] Split sizes: train={len(X_train)} val={len(X_val)} test={len(X_test)}")

    models = []
    for n_idx in range(NUM_RANGE):
        n_num = n_idx + 1
        if y_train[:, n_idx].sum() == 0 or y_train[:, n_idx].sum() == len(y_train):
            print(f"[xgb] Number {n_num}: all-{y_train[:, n_idx][0]:.0f}, skipping")
            models.append(None)
            continue
        m = train_one(
            X_train, y_train[:, n_idx],
            X_val, y_val[:, n_idx],
            args.n_estimators, args.max_depth, args.lr,
        )
        models.append(m)
        if (n_num) % 10 == 0:
            print(f"[xgb] Trained classifier for number {n_num}/39")

    print("[xgb] Evaluating on test set...")
    eval_result = evaluate_top_k(models, X_test, y_test, k=PICK_COUNT)
    print(json.dumps(eval_result, indent=2))

    out_dir = ROOT / "public" / "models" / game
    out_dir.mkdir(parents=True, exist_ok=True)

    # 匯出模型 JSON
    export = export_to_json(models)
    model_path = out_dir / "xgboost.json"
    model_path.write_text(json.dumps(export, separators=(",", ":")), encoding="utf-8")
    size_kb = model_path.stat().st_size / 1024
    print(f"[xgb] Wrote model to {model_path} ({size_kb:.1f} KB)")

    # metadata
    metadata = {
        "version": "1.0",
        "game": game,
        "model_type": "xgboost",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_data": {
            "total_draws": len(draws),
            "window_size": WINDOW_SIZE,
            "train_samples": int(len(X_train)),
            "val_samples": int(len(X_val)),
            "test_samples": int(len(X_test)),
        },
        "model": {
            "architecture": f"39 個獨立 XGBoost binary classifier (n_estimators={args.n_estimators}, max_depth={args.max_depth}, lr={args.lr})",
            "n_estimators": args.n_estimators,
            "max_depth": args.max_depth,
            "learning_rate": args.lr,
            "feature_dim": XGB_FEATURE_DIM,
        },
        "feature_schema": xgboost_feature_constants(),
        "evaluation": eval_result,
    }
    metadata_path = out_dir / "xgboost-metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[xgb] Wrote metadata to {metadata_path}")
    print("[xgb] Done.")


if __name__ == "__main__":
    main()

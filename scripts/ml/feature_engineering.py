"""特徵工程 - Python 與 TS 必須完全一致

每 timestep 82 維特徵:
  [0..38]  multi-hot (39 維): 該期是否出現號碼 n
  [39]     和值 / MAX_SUM
  [40]     奇數個數 / pickCount
  [41]     大號(>=BIG_THRESHOLD)個數 / pickCount
  [42]     連號對數 / (pickCount-1)
  [43..81] 各號距上次出現期數 / GAP_CLAMP (39 維)

normalisation 常數寫進 metadata.json,讓前端可以讀取對齊。
"""

import numpy as np
from typing import List, Dict, Any

# 共用常數 (對應 539: range 1-39, pick 5)
NUM_RANGE = 39
PICK_COUNT = 5
WINDOW_SIZE = 60
BIG_THRESHOLD = 20      # >= 20 算大
GAP_CLAMP = 60          # 距上次出現多少期之上一律截掉
MAX_SUM = sum(range(NUM_RANGE - PICK_COUNT + 1, NUM_RANGE + 1))  # 35+36+37+38+39 = 185
NUM_FEATURES = NUM_RANGE + 4 + NUM_RANGE  # 39 + 4 + 39 = 82


def feature_constants() -> Dict[str, Any]:
    return {
        "num_range": NUM_RANGE,
        "pick_count": PICK_COUNT,
        "window_size": WINDOW_SIZE,
        "big_threshold": BIG_THRESHOLD,
        "gap_clamp": GAP_CLAMP,
        "max_sum": MAX_SUM,
        "num_features": NUM_FEATURES,
        "feature_layout": [
            {"start": 0, "end": NUM_RANGE, "name": "multi_hot"},
            {"start": NUM_RANGE, "end": NUM_RANGE + 1, "name": "sum_norm"},
            {"start": NUM_RANGE + 1, "end": NUM_RANGE + 2, "name": "odd_norm"},
            {"start": NUM_RANGE + 2, "end": NUM_RANGE + 3, "name": "big_norm"},
            {"start": NUM_RANGE + 3, "end": NUM_RANGE + 4, "name": "consec_norm"},
            {"start": NUM_RANGE + 4, "end": NUM_FEATURES, "name": "gap_per_number"},
        ],
    }


def encode_per_draw(numbers: List[int]) -> np.ndarray:
    """將單期 5 個號碼編碼成 [NUM_FEATURES] 但 gap 部分留空 (0),由 sequence 階段填入"""
    feat = np.zeros(NUM_FEATURES, dtype=np.float32)

    # multi-hot
    for n in numbers:
        feat[n - 1] = 1.0

    s = sum(numbers)
    feat[NUM_RANGE] = s / MAX_SUM
    odd_count = sum(1 for n in numbers if n % 2 == 1)
    feat[NUM_RANGE + 1] = odd_count / PICK_COUNT
    big_count = sum(1 for n in numbers if n >= BIG_THRESHOLD)
    feat[NUM_RANGE + 2] = big_count / PICK_COUNT

    sorted_nums = sorted(numbers)
    consec = sum(1 for i in range(1, len(sorted_nums)) if sorted_nums[i] - sorted_nums[i - 1] == 1)
    feat[NUM_RANGE + 3] = consec / max(1, PICK_COUNT - 1)

    # gap 留 0,由 build_sequence_features 計算
    return feat


def build_sequence_features(draws: List[List[int]]) -> np.ndarray:
    """
    輸入:依時序排列(舊→新)的 [N 期][5 號] 二維 list
    輸出:[N, NUM_FEATURES] ndarray,gap 維度被正確填入
    """
    N = len(draws)
    seq = np.zeros((N, NUM_FEATURES), dtype=np.float32)
    last_seen = {n: -1 for n in range(1, NUM_RANGE + 1)}  # -1 表示從未出現

    for i, draw in enumerate(draws):
        seq[i] = encode_per_draw(draw)

        # 計算當期前的 gap (用 last_seen 在進入這期前的狀態)
        for n in range(1, NUM_RANGE + 1):
            ls = last_seen[n]
            gap = i - ls if ls >= 0 else GAP_CLAMP
            gap = min(gap, GAP_CLAMP)
            seq[i, NUM_RANGE + 4 + (n - 1)] = gap / GAP_CLAMP

        # 更新 last_seen (放在最後,gap 是「進入這期前」的狀態)
        for n in draw:
            last_seen[n] = i

    return seq


def make_xy(
    draws: List[List[int]], window: int = WINDOW_SIZE
) -> tuple[np.ndarray, np.ndarray]:
    """
    建立訓練樣本:
      X[i] = seq_features[i:i+window]  (60 期窗口)
      y[i] = multi-hot of draws[i+window]  (下期 39 維 binary)
    回傳 (X, y) 兩個 ndarray
    """
    seq = build_sequence_features(draws)
    Xs = []
    ys = []
    for i in range(len(draws) - window):
        Xs.append(seq[i : i + window])
        target = np.zeros(NUM_RANGE, dtype=np.float32)
        for n in draws[i + window]:
            target[n - 1] = 1.0
        ys.append(target)
    return np.array(Xs), np.array(ys)


def make_inference_window(draws: List[List[int]], window: int = WINDOW_SIZE) -> np.ndarray:
    """取最後 window 期作為推論輸入,回傳 [1, window, NUM_FEATURES]"""
    if len(draws) < window:
        raise ValueError(f"需要至少 {window} 期歷史資料,目前只有 {len(draws)}")
    seq = build_sequence_features(draws[-window:])
    return seq.reshape(1, window, NUM_FEATURES)


# ============================================================
# XGBoost 用的 tabular 特徵 (跟 LSTM 不同 - 不吃序列,要 flatten)
#
# 設計:給定過去 window 期,建構 fixed-size 向量
#   - 39 維: 該號在 window 內出現次數 / pickCount (頻率比)
#   - 39 維: 衰減加權出現分數 (0.97^age)
#   - 39 維: 距離上次出現的期數 / GAP_CLAMP
#   - 39 維: window 最後一期的 multi-hot
#   - 4 維 : window 內平均 sum/odd/big/consec
# 共 160 維
# ============================================================

XGB_FEATURE_DIM = NUM_RANGE * 4 + 4  # 156 + 4 = 160


def make_xgboost_features(draws: List[List[int]], window: int = WINDOW_SIZE) -> np.ndarray:
    """
    輸入:過去 window 期 (時序由舊→新)
    輸出:[XGB_FEATURE_DIM] 一維向量
    """
    if len(draws) < window:
        raise ValueError(f"需要至少 {window} 期歷史資料,目前只有 {len(draws)}")
    sub = draws[-window:]

    feat = np.zeros(XGB_FEATURE_DIM, dtype=np.float32)
    decay = 0.97
    last_seen = {n: -1 for n in range(1, NUM_RANGE + 1)}

    sum_acc = 0
    odd_acc = 0
    big_acc = 0
    consec_acc = 0

    for i, d in enumerate(sub):
        age = (window - 1) - i  # 0 = 最新期
        weight = decay ** age
        # 號碼計數 + 加權
        for n in d:
            feat[n - 1] += 1.0 / PICK_COUNT  # 頻率比
            feat[NUM_RANGE + (n - 1)] += weight  # 衰減加權
            last_seen[n] = i
        # 統計累加
        sum_acc += sum(d)
        odd_acc += sum(1 for n in d if n % 2 == 1)
        big_acc += sum(1 for n in d if n >= BIG_THRESHOLD)
        sd = sorted(d)
        consec_acc += sum(1 for j in range(1, len(sd)) if sd[j] - sd[j - 1] == 1)

    # gap (距上次出現)
    for n in range(1, NUM_RANGE + 1):
        ls = last_seen[n]
        gap = (window - 1 - ls) if ls >= 0 else GAP_CLAMP
        feat[NUM_RANGE * 2 + (n - 1)] = min(gap, GAP_CLAMP) / GAP_CLAMP

    # 最後一期 multi-hot
    for n in sub[-1]:
        feat[NUM_RANGE * 3 + (n - 1)] = 1.0

    # 4 維平均
    feat[NUM_RANGE * 4 + 0] = (sum_acc / window) / MAX_SUM
    feat[NUM_RANGE * 4 + 1] = (odd_acc / window) / PICK_COUNT
    feat[NUM_RANGE * 4 + 2] = (big_acc / window) / PICK_COUNT
    feat[NUM_RANGE * 4 + 3] = (consec_acc / window) / max(1, PICK_COUNT - 1)

    return feat


def make_xgboost_xy(
    draws: List[List[int]], window: int = WINDOW_SIZE
) -> tuple[np.ndarray, np.ndarray]:
    """
    建立 XGBoost 訓練樣本:
      X[i] = make_xgboost_features(draws[i:i+window])  # 160 維
      y[i] = multi-hot of draws[i+window]               # 39 維 binary
    """
    Xs = []
    ys = []
    for i in range(len(draws) - window):
        Xs.append(make_xgboost_features(draws[i : i + window], window))
        target = np.zeros(NUM_RANGE, dtype=np.float32)
        for n in draws[i + window]:
            target[n - 1] = 1.0
        ys.append(target)
    return np.array(Xs), np.array(ys)


def xgboost_feature_constants() -> dict:
    return {
        "feature_dim": XGB_FEATURE_DIM,
        "window_size": WINDOW_SIZE,
        "decay": 0.97,
        "feature_layout": [
            {"start": 0, "end": NUM_RANGE, "name": "freq_ratio"},
            {"start": NUM_RANGE, "end": NUM_RANGE * 2, "name": "decayed_count"},
            {"start": NUM_RANGE * 2, "end": NUM_RANGE * 3, "name": "gap_per_number"},
            {"start": NUM_RANGE * 3, "end": NUM_RANGE * 4, "name": "last_period_multi_hot"},
            {"start": NUM_RANGE * 4, "end": NUM_RANGE * 4 + 4, "name": "agg_sum_odd_big_consec"},
        ],
    }

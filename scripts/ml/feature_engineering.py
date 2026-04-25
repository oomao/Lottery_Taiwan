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

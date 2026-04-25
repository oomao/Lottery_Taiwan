"""把 Keras .h5 轉成 TF.js 格式 (model.json + weight shards)

執行:python scripts/ml/convert_to_tfjs.py 539
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("game", default="539", nargs="?")
    args = parser.parse_args()

    game = args.game
    out_dir = ROOT / "public" / "models" / game
    keras_path = out_dir / "_keras_model.h5"
    if not keras_path.exists():
        print(f"找不到 {keras_path},先跑 train_lstm.py")
        sys.exit(1)

    # 先清掉舊的 model.json + bin 檔
    for f in out_dir.iterdir():
        if f.name.startswith("model") or f.name.startswith("group1-shard"):
            f.unlink()
            print(f"  removed {f.name}")

    # 呼叫 tensorflowjs_converter
    cmd = [
        "tensorflowjs_converter",
        "--input_format=keras",
        "--output_format=tfjs_layers_model",
        "--weight_shard_size_bytes=5000000",  # 5 MB shards
        str(keras_path),
        str(out_dir),
    ]
    print(f"[convert] {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(result.stdout)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        sys.exit(result.returncode)

    # 移除 .h5 (太大,不需要進 repo)
    keras_path.unlink()
    print(f"[convert] removed intermediate {keras_path.name}")
    print(f"[convert] Done. Files in {out_dir}:")
    for f in sorted(out_dir.iterdir()):
        size_kb = f.stat().st_size / 1024
        print(f"  {f.name}  ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()

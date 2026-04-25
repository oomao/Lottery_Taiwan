// LSTM 推論流程 - 動態 import TF.js 避免主 bundle 變肥
// 流程:loadModel → makeInferenceWindow → predict → 解析機率 → 組合貪婪

import type { Draw, GameId } from '../types';
import type { ModelMetadata, MLPrediction } from './types';
import { makeInferenceWindow } from './feature-encode';

const base = import.meta.env.BASE_URL;
const modelUrl = (game: GameId) => `${base}models/${game}/model.json`.replace(/\/+/g, '/');
const metadataUrl = (game: GameId) => `${base}models/${game}/metadata.json`.replace(/\/+/g, '/');

interface LoadedModel {
  // any: TF.js 的 LayersModel 型別,用 any 避免在主 bundle 引入 tfjs 型別
  // 真正的型別檢查留在 inference.ts 內部 dynamic import 時做
  model: unknown;
  metadata: ModelMetadata;
  tf: typeof import('@tensorflow/tfjs');
}

let cached: LoadedModel | null = null;
let cachedGame: GameId | null = null;

export async function loadMLModel(game: GameId): Promise<LoadedModel> {
  if (cached && cachedGame === game) return cached;

  // 1. 先驗證 metadata 存在 (失敗就直接 throw,讓上層顯示「尚未訓練」)
  const metaRes = await fetch(metadataUrl(game));
  if (!metaRes.ok) {
    throw new Error(`模型尚未訓練 (找不到 metadata.json),請先到 GitHub Actions 觸發 Train ML Model`);
  }
  const metadata = (await metaRes.json()) as ModelMetadata;

  // 2. 動態載入 TF.js (這是主 bundle 拆分的關鍵)
  const [tf, _wasm] = await Promise.all([
    import('@tensorflow/tfjs'),
    import('@tensorflow/tfjs-backend-wasm'),
  ]);

  // 設定 WASM 後端 (PDF 推薦,LSTM 序列模型 WASM 比 WebGPU 快)
  // wasmPath 指向 unpkg CDN 預載 (不放進 bundle)
  try {
    const wasmModule = await import('@tensorflow/tfjs-backend-wasm');
    if (wasmModule.setWasmPaths) {
      wasmModule.setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.20.0/dist/');
    }
    await tf.setBackend('wasm');
  } catch {
    // wasm 載入失敗時 fallback 到預設後端
    await tf.setBackend('cpu');
  }
  await tf.ready();

  // 3. 載入模型
  const model = await tf.loadLayersModel(modelUrl(game));

  cached = { model, metadata, tf };
  cachedGame = game;
  return cached;
}

/**
 * 對最新一期之後的「下一期」做預測
 */
export async function predictNext(
  game: GameId,
  draws: Draw[]
): Promise<MLPrediction> {
  const { model, metadata, tf } = await loadMLModel(game);
  const schema = metadata.feature_schema;

  const flat = makeInferenceWindow(draws, schema);
  const inputTensor = tf.tensor3d(
    Array.from(flat),
    [1, schema.window_size, schema.num_features]
  );

  // model is unknown above, cast for predict call
  const m = model as { predict: (x: unknown) => unknown };
  const out = m.predict(inputTensor) as { dataSync: () => Float32Array; dispose: () => void };
  const probs = Array.from(out.dataSync());

  inputTensor.dispose();
  out.dispose();

  const topNumbers = probs
    .map((p, i) => ({ number: i + 1, prob: p }))
    .sort((a, b) => b.prob - a.prob);

  return { numberProbs: probs, topNumbers };
}

/**
 * 從預測機率產生 k-合的 top N 推薦組合
 * 用 greedy:先取機率前 M 個號,再列舉 C(M, k)
 */
export function greedyComboFromProbs(
  probs: number[],
  k: 2 | 3 | 4,
  topN: number,
  poolSize: number = 12
): { combo: number[]; score: number }[] {
  const top = probs
    .map((p, i) => ({ number: i + 1, prob: p }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, poolSize);

  const combos: { combo: number[]; score: number }[] = [];
  const numbers = top.map((t) => t.number);
  const probMap = new Map(top.map((t) => [t.number, t.prob]));

  // 列舉 C(poolSize, k) 組合
  const combine = (start: number, current: number[]) => {
    if (current.length === k) {
      const score = current.reduce((p, n) => p * (probMap.get(n) ?? 0), 1);
      combos.push({ combo: [...current].sort((a, b) => a - b), score });
      return;
    }
    for (let i = start; i < numbers.length; i++) {
      current.push(numbers[i]);
      combine(i + 1, current);
      current.pop();
    }
  };
  combine(0, []);

  combos.sort((a, b) => b.score - a.score);
  return combos.slice(0, topN);
}

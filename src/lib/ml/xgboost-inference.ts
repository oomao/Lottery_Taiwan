// XGBoost 完整推論流程 (前端)
// 不依賴 TF.js,純 JS,可直接 import (bundle 影響很小,~5KB)

import type { Draw, GameId } from '../types';
import type { ModelMetadata, MLPrediction } from './types';
import { makeXGBoostFeatures } from './xgboost-features';
import { predictAllClasses, type XGBoostModelDump } from './xgboost-predictor';

const base = import.meta.env.BASE_URL;
const modelUrl = (game: GameId) => `${base}models/${game}/xgboost.json`.replace(/\/+/g, '/');
const metadataUrl = (game: GameId) =>
  `${base}models/${game}/xgboost-metadata.json`.replace(/\/+/g, '/');

interface LoadedXGBoost {
  dump: XGBoostModelDump;
  metadata: ModelMetadata;
}

let cached: LoadedXGBoost | null = null;
let cachedGame: GameId | null = null;

export async function loadXGBoostModel(game: GameId): Promise<LoadedXGBoost> {
  if (cached && cachedGame === game) return cached;

  const [metaRes, modelRes] = await Promise.all([
    fetch(metadataUrl(game)),
    fetch(modelUrl(game)),
  ]);

  if (!metaRes.ok || !modelRes.ok) {
    throw new Error('XGBoost 模型尚未訓練,請到 Actions 觸發 Train ML Model (選 xgboost 或 both)');
  }

  const metadata = (await metaRes.json()) as ModelMetadata;
  const dump = (await modelRes.json()) as XGBoostModelDump;

  cached = { dump, metadata };
  cachedGame = game;
  return cached;
}

export async function predictNextXGBoost(
  game: GameId,
  draws: Draw[]
): Promise<MLPrediction> {
  const { dump } = await loadXGBoostModel(game);
  const features = makeXGBoostFeatures(draws);
  const probs = predictAllClasses(dump, features);

  const topNumbers = probs
    .map((p, i) => ({ number: i + 1, prob: p }))
    .sort((a, b) => b.prob - a.prob);

  return { numberProbs: probs, topNumbers };
}

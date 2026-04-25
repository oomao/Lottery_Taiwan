import { useEffect, useState } from 'react';
import type { Draw, GameConfig } from '@/lib/types';
import type { ModelMetadata, MLPrediction } from '@/lib/ml/types';
import Ball from '@/components/ui/Ball';

interface Props {
  draws: Draw[];
  game: GameConfig;
}

type ModelKind = 'lstm' | 'xgboost';

type LoadState =
  | { status: 'idle' }
  | { status: 'loading'; phase: string }
  | { status: 'ready'; metadata: ModelMetadata; prediction: MLPrediction }
  | { status: 'error'; message: string };

const MODEL_INFO: Record<ModelKind, { label: string; emoji: string; desc: string }> = {
  lstm: {
    label: 'LSTM',
    emoji: '🧠',
    desc: 'Bidirectional LSTM 神經網路 - 學序列模式 (60 期窗口)',
  },
  xgboost: {
    label: 'XGBoost',
    emoji: '🌲',
    desc: '梯度提升樹 - 39 個獨立 binary classifier (tabular 特徵)',
  },
};

export default function MLPanel({ draws, game }: Props) {
  const [activeModel, setActiveModel] = useState<ModelKind>('lstm');
  const [states, setStates] = useState<Record<ModelKind, LoadState>>({
    lstm: { status: 'idle' },
    xgboost: { status: 'idle' },
  });

  const setState = (kind: ModelKind, s: LoadState) =>
    setStates((prev) => ({ ...prev, [kind]: s }));

  const startLSTM = async () => {
    setState('lstm', { status: 'loading', phase: '載入 metadata...' });
    try {
      const inf = await import('@/lib/ml/inference');
      setState('lstm', { status: 'loading', phase: '載入 TensorFlow.js (~1.7MB)...' });
      const m = await inf.loadMLModel(game.id);
      setState('lstm', { status: 'loading', phase: '推論...' });
      const prediction = await inf.predictNext(game.id, draws);
      setState('lstm', { status: 'ready', metadata: m.metadata, prediction });
    } catch (e) {
      setState('lstm', { status: 'error', message: (e as Error).message });
    }
  };

  const startXGBoost = async () => {
    setState('xgboost', { status: 'loading', phase: '載入 XGBoost JSON...' });
    try {
      const inf = await import('@/lib/ml/xgboost-inference');
      const m = await inf.loadXGBoostModel(game.id);
      setState('xgboost', { status: 'loading', phase: '推論...' });
      const prediction = await inf.predictNextXGBoost(game.id, draws);
      setState('xgboost', { status: 'ready', metadata: m.metadata, prediction });
    } catch (e) {
      setState('xgboost', { status: 'error', message: (e as Error).message });
    }
  };

  useEffect(() => {
    if (activeModel === 'lstm' && states.lstm.status === 'idle') startLSTM();
    if (activeModel === 'xgboost' && states.xgboost.status === 'idle') startXGBoost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModel]);

  const state = states[activeModel];
  const info = MODEL_INFO[activeModel];

  return (
    <div className="space-y-4">
      {/* 模型切換 tabs */}
      <div className="card">
        <div className="flex flex-wrap gap-2 mb-2">
          {(['lstm', 'xgboost'] as ModelKind[]).map((m) => (
            <button
              key={m}
              onClick={() => setActiveModel(m)}
              className={`px-4 py-2 rounded-lg font-bold transition ${
                activeModel === m
                  ? 'bg-brand text-white shadow'
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {MODEL_INFO[m].emoji} {MODEL_INFO[m].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">{info.desc}</p>
      </div>

      {/* 各模型載入狀態 */}
      {state.status === 'loading' && (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3 animate-pulse">{info.emoji}</div>
          <p className="text-gray-600 dark:text-gray-300">{state.phase}</p>
          {activeModel === 'lstm' && (
            <p className="text-xs text-gray-400 mt-3">
              第一次會下載 TF.js + 模型 (~3-5MB),Service Worker 會快取
            </p>
          )}
        </div>
      )}

      {state.status === 'error' && (
        <div className="card text-center py-8">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-600 mb-3">{state.message}</p>
          <button
            onClick={() => (activeModel === 'lstm' ? startLSTM() : startXGBoost())}
            className="px-4 py-2 bg-brand text-white rounded text-sm"
          >
            重試
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <ModelDetail
          info={info}
          metadata={state.metadata}
          prediction={state.prediction}
          game={game}
        />
      )}

      {/* 雙模型對比 (兩個都載完才顯示) */}
      {states.lstm.status === 'ready' && states.xgboost.status === 'ready' && (
        <ComparisonCard
          lstm={states.lstm.metadata}
          xgboost={states.xgboost.metadata}
        />
      )}

      {/* 通用免責 */}
      <div className="card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200">
        <p className="font-bold mb-1">⚠️ 完整聲明</p>
        <ul className="text-xs leading-relaxed list-disc list-inside space-y-1">
          <li>不論 LSTM 或 XGBoost,在 IID 隨機資料上**都不能真正提高中獎率**</li>
          <li>p-value 通常不顯著 — 這正好證明抽獎是公平的</li>
          <li>請以 p-value 判讀:不顯著時當「跟隨機差不多」</li>
          <li>樂透為獨立隨機事件,中獎號碼以官方公告為準</li>
        </ul>
      </div>
    </div>
  );
}

function ModelDetail({
  info,
  metadata,
  prediction,
  game,
}: {
  info: { label: string; emoji: string };
  metadata: ModelMetadata;
  prediction: MLPrediction;
  game: GameConfig;
}) {
  const evalResult = metadata.evaluation;
  const trainedDate = new Date(metadata.trained_at).toLocaleDateString('zh-TW');

  return (
    <>
      {/* 模型資訊 */}
      <div className="card">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
          <h3 className="text-lg font-bold">
            {info.emoji} {info.label} 模型資訊
          </h3>
          <span className="text-xs text-gray-500">訓練於 {trainedDate}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="訓練期數" value={`${metadata.training_data.train_samples}`} />
          <Stat label="測試期數" value={`${metadata.training_data.test_samples}`} />
          {'epochs_trained' in (metadata.model as Record<string, unknown>) && (
            <Stat
              label="訓練 epoch"
              value={`${(metadata.model as { epochs_trained?: number }).epochs_trained ?? '—'}`}
            />
          )}
          {'n_estimators' in (metadata.model as Record<string, unknown>) && (
            <Stat
              label="樹數量"
              value={`${(metadata.model as { n_estimators?: number }).n_estimators ?? '—'}`}
            />
          )}
          {(metadata.model as { total_params?: number }).total_params && (
            <Stat
              label="參數量"
              value={`${(metadata.model as { total_params: number }).total_params.toLocaleString()}`}
            />
          )}
        </div>
        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
          架構:{metadata.model.architecture}
        </p>
      </div>

      {/* 評估對比 */}
      <div className="card">
        <h3 className="text-lg font-bold mb-3">
          📊 模型表現 vs 隨機基準 (測試集 {evalResult.test_size} 期)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <ScoreCard
            label={`${info.emoji} 模型平均命中`}
            value={evalResult.model_avg_hits.toFixed(3)}
            unit="顆/期"
            color="text-brand"
          />
          <ScoreCard
            label="🎲 隨機抽樣命中"
            value={evalResult.random_simulated_avg_hits.toFixed(3)}
            unit="顆/期"
            color="text-gray-500"
          />
          <ScoreCard
            label="📈 改善幅度"
            value={
              (evalResult.improvement_vs_random > 0 ? '+' : '') +
              evalResult.improvement_vs_random.toFixed(3)
            }
            unit="顆/期"
            color={
              evalResult['is_significant_at_0.05'] ? 'text-green-600' : 'text-gray-500'
            }
          />
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3 text-sm space-y-1">
          <p>
            <strong>p-value:</strong>{' '}
            <code className="font-mono">{evalResult.p_value.toFixed(4)}</code>{' '}
            {evalResult['is_significant_at_0.05'] ? (
              <span className="text-green-600">✓ 統計上顯著 (p &lt; 0.05)</span>
            ) : (
              <span className="text-gray-500">✗ 統計上不顯著 — 可能是抽樣雜訊</span>
            )}
          </p>
          <p>
            <strong>95% 信賴區間:</strong>{' '}
            [{evalResult.confidence_interval_95[0].toFixed(3)},{' '}
            {evalResult.confidence_interval_95[1].toFixed(3)}] 顆/期
          </p>
          <p className="text-xs text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-600">
            💡 解讀:539 為 IID 隨機事件,隨機基準 ≈{' '}
            {evalResult.random_baseline_theoretical.toFixed(3)} 顆/期。
            若模型未顯著超過隨機,表示資料中沒有可學的訊號 — 這是預期結果,代表抽獎是公平的。
          </p>
        </div>

        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">
            模型 Top-{evalResult.k} 命中分布:
          </p>
          <div className="flex gap-1">
            {Object.entries(evalResult.model_hits_distribution).map(([hits, count]) => {
              const total = evalResult.test_size;
              const pct = (count / total) * 100;
              return (
                <div
                  key={hits}
                  className="flex-1 text-center"
                  title={`命中 ${hits} 顆: ${count} 期 (${pct.toFixed(1)}%)`}
                >
                  <div
                    className="bg-brand/30 dark:bg-brand/40 rounded-t"
                    style={{ height: `${Math.max(2, pct * 2)}px` }}
                  />
                  <div className="text-[10px] text-gray-500 mt-1">{hits}</div>
                  <div className="text-[10px] font-bold">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 下期預測 */}
      <div className="card">
        <h3 className="text-lg font-bold mb-3">🎯 下期號碼機率 (Top 10)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {prediction.topNumbers.slice(0, 10).map((t, i) => (
            <div
              key={t.number}
              className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded"
            >
              <span className="text-xs text-gray-400 w-5">#{i + 1}</span>
              <Ball number={t.number} color={game.ballColor} size="sm" />
              <span className="text-xs font-mono ml-auto">
                {(t.prob * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ComparisonCard({
  lstm,
  xgboost,
}: {
  lstm: ModelMetadata;
  xgboost: ModelMetadata;
}) {
  const lstmEval = lstm.evaluation;
  const xgbEval = xgboost.evaluation;

  return (
    <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
      <h3 className="text-lg font-bold mb-3">⚔️ LSTM vs XGBoost 直接對比</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blue-200 dark:border-blue-800 text-left">
              <th className="py-2 pr-2">指標</th>
              <th className="py-2 pr-2 text-right">🧠 LSTM</th>
              <th className="py-2 pr-2 text-right">🌲 XGBoost</th>
              <th className="py-2 pr-2 text-right">🎲 隨機</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            <Row
              label="平均命中 (顆/期)"
              lstm={lstmEval.model_avg_hits.toFixed(3)}
              xgb={xgbEval.model_avg_hits.toFixed(3)}
              rand={lstmEval.random_simulated_avg_hits.toFixed(3)}
            />
            <Row
              label="vs 隨機"
              lstm={(lstmEval.improvement_vs_random > 0 ? '+' : '') + lstmEval.improvement_vs_random.toFixed(3)}
              xgb={(xgbEval.improvement_vs_random > 0 ? '+' : '') + xgbEval.improvement_vs_random.toFixed(3)}
              rand="—"
            />
            <Row
              label="p-value"
              lstm={lstmEval.p_value.toFixed(4)}
              xgb={xgbEval.p_value.toFixed(4)}
              rand="—"
            />
            <Row
              label="統計顯著?"
              lstm={lstmEval['is_significant_at_0.05'] ? '✓' : '✗'}
              xgb={xgbEval['is_significant_at_0.05'] ? '✓' : '✗'}
              rand="—"
            />
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-300 mt-3 leading-relaxed">
        💡 兩個 ML 方法用的特徵不同(LSTM 吃序列,XGBoost 吃聚合特徵),
        但對 IID 隨機資料的結論一樣:都打不贏隨機。這正是統計學期望中的結果。
      </p>
    </div>
  );
}

function Row({
  label,
  lstm,
  xgb,
  rand,
}: {
  label: string;
  lstm: string;
  xgb: string;
  rand: string;
}) {
  return (
    <tr className="border-b border-blue-100 dark:border-blue-900">
      <td className="py-2 pr-2 font-sans">{label}</td>
      <td className="py-2 pr-2 text-right">{lstm}</td>
      <td className="py-2 pr-2 text-right">{xgb}</td>
      <td className="py-2 pr-2 text-right text-gray-500">{rand}</td>
    </tr>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="text-center p-3 border border-gray-200 dark:border-gray-700 rounded">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500">{unit}</div>
    </div>
  );
}

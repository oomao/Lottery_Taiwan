import { useEffect, useState } from 'react';
import type { Draw, GameConfig } from '@/lib/types';
import type { ModelMetadata, MLPrediction } from '@/lib/ml/types';
import Ball from '@/components/ui/Ball';

interface Props {
  draws: Draw[];
  game: GameConfig;
}

type LoadState =
  | { status: 'idle' }
  | { status: 'loading'; phase: string }
  | { status: 'ready'; metadata: ModelMetadata; prediction: MLPrediction }
  | { status: 'error'; message: string };

export default function MLPanel({ draws, game }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'idle' });

  const start = async () => {
    setState({ status: 'loading', phase: '載入 metadata...' });
    try {
      const inference = await import('@/lib/ml/inference');
      setState({ status: 'loading', phase: '載入 TensorFlow.js (~1MB)...' });
      // loadMLModel 會 cache,連續呼叫只下載一次
      const _model = await inference.loadMLModel(game.id);

      setState({ status: 'loading', phase: '建構特徵 + 推論...' });
      const prediction = await inference.predictNext(game.id, draws);

      setState({
        status: 'ready',
        metadata: _model.metadata,
        prediction,
      });
    } catch (e) {
      setState({ status: 'error', message: (e as Error).message });
    }
  };

  // 自動嘗試載入 (使用者進這個 tab 才會跑)
  useEffect(() => {
    if (state.status === 'idle') start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="card text-center py-12">
        <div className="text-4xl mb-3 animate-pulse">🤖</div>
        <p className="text-gray-600 dark:text-gray-300">{state.phase}</p>
        <p className="text-xs text-gray-400 mt-3">第一次會下載 TF.js + 模型檔 (約 3-5MB),之後會由 SW 快取</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="card text-center py-8">
        <div className="text-3xl mb-2">⚠️</div>
        <p className="text-red-600 mb-3">{state.message}</p>
        <button onClick={start} className="px-4 py-2 bg-brand text-white rounded text-sm">
          重試
        </button>
      </div>
    );
  }

  if (state.status === 'idle') return null;

  const { metadata, prediction } = state;
  const evalResult = metadata.evaluation;
  const trainedDate = new Date(metadata.trained_at).toLocaleDateString('zh-TW');

  return (
    <div className="space-y-4">
      {/* 模型卡片 */}
      <div className="card">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
          <h3 className="text-lg font-bold">🤖 LSTM 模型資訊</h3>
          <span className="text-xs text-gray-500">訓練於 {trainedDate}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="參數量" value={metadata.model.total_params.toLocaleString()} />
          <Stat label="訓練期數" value={`${metadata.training_data.train_samples}`} />
          <Stat label="測試期數" value={`${metadata.training_data.test_samples}`} />
          <Stat label="訓練 epoch" value={`${metadata.model.epochs_trained}`} />
        </div>
        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
          架構:{metadata.model.architecture}
        </p>
      </div>

      {/* 評估對比 (核心) */}
      <div className="card">
        <h3 className="text-lg font-bold mb-3">📊 模型表現 vs 隨機基準 (測試集 {evalResult.test_size} 期)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <ScoreCard
            label="🤖 模型平均命中"
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
            value={(evalResult.improvement_vs_random > 0 ? '+' : '') + evalResult.improvement_vs_random.toFixed(3)}
            unit="顆/期"
            color={
              evalResult['is_significant_at_0.05']
                ? 'text-green-600'
                : 'text-gray-500'
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
              <span className="text-gray-500">✗ 統計上不顯著 (p ≥ 0.05) — 可能是抽樣雜訊</span>
            )}
          </p>
          <p>
            <strong>95% 信賴區間:</strong>{' '}
            [{evalResult.confidence_interval_95[0].toFixed(3)},{' '}
            {evalResult.confidence_interval_95[1].toFixed(3)}] 顆/期
          </p>
          <p className="text-xs text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-600">
            💡 解讀:539 為 IID 隨機事件,隨機基準 ≈ {evalResult.random_baseline_theoretical.toFixed(3)} 顆/期。
            若模型未顯著超過隨機,表示資料中沒有可學的訊號 — 這是預期結果,代表抽獎是公平的。
          </p>
        </div>

        {/* 命中分布 */}
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">模型 Top-{evalResult.k} 命中分布:</p>
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
          <p className="text-[10px] text-gray-400 text-center mt-1">命中顆數 / 期數</p>
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
        <p className="text-xs text-gray-500 mt-3">
          機率為 sigmoid 輸出的「下期該號出現」獨立估計,5 個一抽限制下實際機率會被微幅抑制。
        </p>
      </div>

      {/* 免責聲明 */}
      <div className="card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200">
        <p className="font-bold mb-1">⚠️ 完整聲明</p>
        <ul className="text-xs leading-relaxed list-disc list-inside space-y-1">
          <li>本模型僅為 ML pipeline 學習展示,**不能真正提高中獎率**</li>
          <li>訓練資料只有約 900 期,任何「規律」高機率為抽樣雜訊</li>
          <li>請以 p-value 判讀:不顯著時請當作「跟隨機差不多」</li>
          <li>樂透為獨立隨機事件,中獎號碼以官方公告為準</li>
        </ul>
      </div>
    </div>
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

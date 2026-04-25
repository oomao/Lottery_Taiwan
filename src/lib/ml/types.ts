// 對應 Python feature_engineering.feature_constants() 的型別

export interface FeatureSchema {
  num_range: number;
  pick_count: number;
  window_size: number;
  big_threshold: number;
  gap_clamp: number;
  max_sum: number;
  num_features: number;
  feature_layout: { start: number; end: number; name: string }[];
}

export interface ModelEvaluation {
  test_size: number;
  k: number;
  model_avg_hits: number;
  random_baseline_theoretical: number;
  random_simulated_avg_hits: number;
  improvement_vs_random: number;
  t_statistic: number;
  p_value: number;
  'is_significant_at_0.05': boolean;
  confidence_interval_95: [number, number];
  model_hits_distribution: Record<string, number>;
}

export interface ModelMetadata {
  version: string;
  game: string;
  trained_at: string;
  training_data: {
    total_draws: number;
    window_size: number;
    train_samples: number;
    val_samples: number;
    test_samples: number;
  };
  model: {
    architecture: string;
    total_params: number;
    input_shape: [number, number];
    output_shape: [number];
    epochs_trained: number;
    best_val_loss: number;
    final_train_loss: number;
  };
  feature_schema: FeatureSchema;
  evaluation: ModelEvaluation;
}

export interface MLPrediction {
  numberProbs: number[];   // 39 維,index = number-1
  topNumbers: { number: number; prob: number }[];   // 排序後 top
}

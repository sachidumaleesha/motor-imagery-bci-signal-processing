export type PredictionLabel = "left" | "right" | "rest";

export type DatasetCapabilities = {
  waveform: boolean;
  annotations: boolean;
  verifiedPredictions: boolean;
  measuredLatency: boolean;
};

export type DatasetMetadata = {
  id: string;
  name: string;
  subject: string;
  subjectCode: string;
  run: number;
  role:
    | "verified-replay"
    | "training"
    | "calibration"
    | "exploration"
    | "upload";
  description: string;
  sourceFile: string;
  sampleRateHz: number;
  frameIntervalMs: number;
  durationSeconds: number;
  frameCount: number;
  channels: string[];
  capabilities: DatasetCapabilities;
  dataUrl?: string;
};

export type TrialEvent = {
  onset: number;
  duration: number;
  label: Exclude<PredictionLabel, "rest">;
};

export type ReplayFrame = {
  t: number;
  signal: number[];
  power: [number, number, number, number];
  groundTruth: PredictionLabel;
  rawPrediction: number | null;
  smoothedPrediction: number | null;
  latencyMs: number | null;
  queueDrop: boolean | null;
};

export type ReplayDataset = DatasetMetadata & {
  trials: TrialEvent[];
  frames: ReplayFrame[];
};

export type DashboardManifest = {
  schemaVersion: number;
  datasets: DatasetMetadata[];
};

type ModelSummary = {
  accuracy: number;
  roc_auc: number;
  fold_accuracy_sd: number;
  confusion_matrix: number[][];
};

export type DashboardAnalysis = {
  cv: { LDA: ModelSummary; SVM: ModelSummary };
  timing: {
    chunks: number;
    decisions: number;
    mean_ms: number;
    p95_ms: number;
    max_ms: number;
    simulated_queue_drops: number;
    strict_latency_pass: boolean;
  };
  stream: {
    held_out_run: number;
    trial_count: number;
    overlapping_window_accuracy: number;
    trial_accuracy: number;
    idealized_ITR_bits_per_min: number;
  };
  alphaErd: Array<{
    channel: string;
    class: string;
    paired_trials: number;
    mean_alpha_ERD_percent: number;
  }>;
  bandComparison: Array<{
    band: string;
    components: string;
    features: string;
    empirical_normalized_variance_ratio: string;
    manual_target: string;
  }>;
  notes: { replay: string; brain: string; csp: string };
};

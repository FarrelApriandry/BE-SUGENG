/**
 * SUGENG AI Engine — Academic Evaluation & Statistical Metrics
 * Menghitung MAE, RMSE, R² Score, dan MAPE untuk validasi model regresi (Model 1),
 * serta Confusion Matrix, Accuracy, Precision, Recall, dan F1-Score untuk model klasifikasi (Model 2).
 */

import type {
  ClassPerformanceMetrics,
  ClassificationEvaluationMetrics,
  ConfusionMatrix,
  HazardClass,
  ModelEvaluationMetrics,
} from "./types";

// ==============================================================================
// 1. Evaluasi Model Regresi (Model 1 - TTO)
// ==============================================================================

/**
 * Menghitung metrik evaluasi regresi antara nilai aktual (yTrue) dan nilai prediksi (yPred)
 */
export function calculateRegressionMetrics(
  yTrue: number[],
  yPred: number[]
): ModelEvaluationMetrics {
  const n = yTrue.length;
  if (n === 0 || n !== yPred.length) {
    throw new Error("Panjang array yTrue dan yPred harus sama dan tidak boleh kosong.");
  }

  let sumAbsoluteError = 0;
  let sumSquaredError = 0;
  let sumPercentageError = 0;
  let validMapeCount = 0;

  // Hitung rata-rata yTrue untuk kalkulasi R²
  const meanYTrue = yTrue.reduce((acc, val) => acc + val, 0) / n;
  let totalSumOfSquares = 0;

  for (let i = 0; i < n; i++) {
    const error = yTrue[i] - yPred[i];
    sumAbsoluteError += Math.abs(error);
    sumSquaredError += error * error;
    totalSumOfSquares += (yTrue[i] - meanYTrue) * (yTrue[i] - meanYTrue);

    if (Math.abs(yTrue[i]) > 0.1) {
      sumPercentageError += Math.abs(error / yTrue[i]);
      validMapeCount++;
    }
  }

  const mae = sumAbsoluteError / n;
  const rmse = Math.sqrt(sumSquaredError / n);
  const r2Score = totalSumOfSquares > 0 ? 1 - sumSquaredError / totalSumOfSquares : 1.0;
  const mape = validMapeCount > 0 ? (sumPercentageError / validMapeCount) * 100 : 0;

  return {
    mae: Number(mae.toFixed(3)),
    rmse: Number(rmse.toFixed(3)),
    r2Score: Number(Math.max(0, Math.min(1.0, r2Score)).toFixed(4)),
    mape: Number(mape.toFixed(2)),
    sampleEvaluated: n,
  };
}

/**
 * Format laporan ringkas metrik regresi untuk konsol atau laporan tugas
 */
export function formatMetricsReport(
  metrics: ModelEvaluationMetrics,
  modelName = "SUGENG Diurnal TTO Regressor"
): string {
  return [
    `══════════════════════════════════════════════════════════════════`,
    `  📊 LAPORAN EVALUASI MODEL REGRESI: ${modelName}`,
    `══════════════════════════════════════════════════════════════════`,
    `  • Jumlah Data Sampel Uji  : ${metrics.sampleEvaluated} records`,
    `  • R² Score (Koefisien Det): ${(metrics.r2Score * 100).toFixed(2)}% (${metrics.r2Score})`,
    `  • MAE (Mean Absolute Error): ${metrics.mae}% volume`,
    `  • RMSE (Root Mean Sq Error): ${metrics.rmse}% volume`,
    `  • MAPE (Mean Abs Pct Error): ${metrics.mape}%`,
    `  • Status Kelaikan Model    : ${metrics.r2Score >= 0.85 ? "SANGAT BAIK / MEMENUHI SYARAT" : "CUKUP"}`,
    `══════════════════════════════════════════════════════════════════`,
  ].join("\n");
}

// ==============================================================================
// 2. Evaluasi Model Klasifikasi Multi-Sensor (Model 2 - Hazard)
// ==============================================================================

export const ALL_HAZARD_CLASSES: HazardClass[] = [
  "NORMAL",
  "ACTIVE_DECOMPOSITION",
  "METHANE_HAZARD",
  "SENSOR_ANOMALY",
];

/**
 * Menghitung Confusion Matrix, Akurasi, Presisi, Recall, dan F1-Score
 */
export function calculateClassificationMetrics(
  yTrue: HazardClass[],
  yPred: HazardClass[]
): ClassificationEvaluationMetrics {
  const n = yTrue.length;
  if (n === 0 || n !== yPred.length) {
    throw new Error("Panjang array yTrue dan yPred klasifikasi harus sama.");
  }

  const classIndices: Record<HazardClass, number> = {
    NORMAL: 0,
    ACTIVE_DECOMPOSITION: 1,
    METHANE_HAZARD: 2,
    SENSOR_ANOMALY: 3,
  };

  // Inisialisasi matriks 4x4
  const matrix: number[][] = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];

  let correctCount = 0;

  for (let i = 0; i < n; i++) {
    const actualIdx = classIndices[yTrue[i]];
    const predIdx = classIndices[yPred[i]];
    matrix[actualIdx][predIdx]++;

    if (actualIdx === predIdx) {
      correctCount++;
    }
  }

  const accuracy = Number((correctCount / n).toFixed(4));
  const classMetrics: Record<HazardClass, ClassPerformanceMetrics> = {} as any;

  let sumF1 = 0;
  let weightedSumF1 = 0;

  ALL_HAZARD_CLASSES.forEach((cls) => {
    const idx = classIndices[cls];
    const tp = matrix[idx][idx];

    let rowSum = 0; // actual count (support)
    for (let c = 0; c < 4; c++) rowSum += matrix[idx][c];

    let colSum = 0; // predicted count
    for (let r = 0; r < 4; r++) colSum += matrix[r][idx];

    const precision = colSum > 0 ? tp / colSum : 1.0;
    const recall = rowSum > 0 ? tp / rowSum : 1.0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    classMetrics[cls] = {
      precision: Number(precision.toFixed(3)),
      recall: Number(recall.toFixed(3)),
      f1Score: Number(f1.toFixed(3)),
      support: rowSum,
    };

    sumF1 += f1;
    weightedSumF1 += f1 * rowSum;
  });

  const macroF1Score = Number((sumF1 / 4).toFixed(4));
  const weightedF1Score = Number((weightedSumF1 / n).toFixed(4));

  const confusionMatrix: ConfusionMatrix = {
    classes: ALL_HAZARD_CLASSES,
    matrix,
    totalSamples: n,
  };

  return {
    accuracy,
    macroF1Score,
    weightedF1Score,
    classMetrics,
    confusionMatrix,
    sampleEvaluated: n,
  };
}

/**
 * Format laporan ringkas Confusion Matrix & Metrik Klasifikasi untuk Laporan Skripsi/Tugas
 */
export function formatClassificationReport(
  metrics: ClassificationEvaluationMetrics,
  modelName = "SUGENG Multi-Sensor Hazard Classifier"
): string {
  const m = metrics.confusionMatrix.matrix;
  return [
    `══════════════════════════════════════════════════════════════════`,
    `  🎯 LAPORAN EVALUASI MODEL KLASIFIKASI: ${modelName}`,
    `══════════════════════════════════════════════════════════════════`,
    `  • Jumlah Data Sampel Uji  : ${metrics.sampleEvaluated} records`,
    `  • Overall Accuracy        : ${(metrics.accuracy * 100).toFixed(2)}% (${metrics.accuracy})`,
    `  • Macro F1-Score          : ${(metrics.macroF1Score * 100).toFixed(2)}% (${metrics.macroF1Score})`,
    `  • Weighted F1-Score       : ${(metrics.weightedF1Score * 100).toFixed(2)}%`,
    `──────────────────────────────────────────────────────────────────`,
    `  📋 PER-CLASS PERFORMANCE METRICS:`,
    `  [0] NORMAL       : Prec=${(metrics.classMetrics.NORMAL.precision * 100).toFixed(1)}% | Rec=${(metrics.classMetrics.NORMAL.recall * 100).toFixed(1)}% | F1=${metrics.classMetrics.NORMAL.f1Score} (N=${metrics.classMetrics.NORMAL.support})`,
    `  [1] DEKOMPOSISI  : Prec=${(metrics.classMetrics.ACTIVE_DECOMPOSITION.precision * 100).toFixed(1)}% | Rec=${(metrics.classMetrics.ACTIVE_DECOMPOSITION.recall * 100).toFixed(1)}% | F1=${metrics.classMetrics.ACTIVE_DECOMPOSITION.f1Score} (N=${metrics.classMetrics.ACTIVE_DECOMPOSITION.support})`,
    `  [2] GAS METANA   : Prec=${(metrics.classMetrics.METHANE_HAZARD.precision * 100).toFixed(1)}% | Rec=${(metrics.classMetrics.METHANE_HAZARD.recall * 100).toFixed(1)}% | F1=${metrics.classMetrics.METHANE_HAZARD.f1Score} (N=${metrics.classMetrics.METHANE_HAZARD.support})`,
    `  [3] ANOMALI SENSOR: Prec=${(metrics.classMetrics.SENSOR_ANOMALY.precision * 100).toFixed(1)}% | Rec=${(metrics.classMetrics.SENSOR_ANOMALY.recall * 100).toFixed(1)}% | F1=${metrics.classMetrics.SENSOR_ANOMALY.f1Score} (N=${metrics.classMetrics.SENSOR_ANOMALY.support})`,
    `──────────────────────────────────────────────────────────────────`,
    `  🔍 CONFUSION MATRIX (Actual \\ Predicted):`,
    `                 Pred: [0]  [1]  [2]  [3]`,
    `  Actual [0] Normal   : ${String(m[0][0]).padStart(3, " ")}  ${String(m[0][1]).padStart(3, " ")}  ${String(m[0][2]).padStart(3, " ")}  ${String(m[0][3]).padStart(3, " ")}`,
    `  Actual [1] Dekomp   : ${String(m[1][0]).padStart(3, " ")}  ${String(m[1][1]).padStart(3, " ")}  ${String(m[1][2]).padStart(3, " ")}  ${String(m[1][3]).padStart(3, " ")}`,
    `  Actual [2] Metana   : ${String(m[2][0]).padStart(3, " ")}  ${String(m[2][1]).padStart(3, " ")}  ${String(m[2][2]).padStart(3, " ")}  ${String(m[2][3]).padStart(3, " ")}`,
    `  Actual [3] Anomali  : ${String(m[3][0]).padStart(3, " ")}  ${String(m[3][1]).padStart(3, " ")}  ${String(m[3][2]).padStart(3, " ")}  ${String(m[3][3]).padStart(3, " ")}`,
    `══════════════════════════════════════════════════════════════════`,
  ].join("\n");
}

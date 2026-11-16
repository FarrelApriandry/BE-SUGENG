/**
 * SUGENG AI Engine — Academic Evaluation & Statistical Metrics
 * Menghitung MAE, RMSE, R² Score, dan MAPE untuk validasi model regresi
 */

import type { ModelEvaluationMetrics } from "./types";

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
 * Format laporan ringkas metrik untuk konsol atau laporan tugas
 */
export function formatMetricsReport(metrics: ModelEvaluationMetrics, modelName = "SUGENG Diurnal TTO Regressor"): string {
  return [
    `══════════════════════════════════════════════════════════════════`,
    `  📊 LAPORAN EVALUASI AKADEMIK MODEL AI: ${modelName}`,
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

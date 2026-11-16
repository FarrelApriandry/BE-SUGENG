/**
 * SUGENG AI Engine — CLI Training & Academic Evaluation Script
 * Menjalankan pembuatan dataset dummy, pelatihan model regresi diurnal,
 * kalkulasi metrik akademik (MAE, RMSE, R²), dan ekspor bobot model.
 *
 * Cara menjalankan:
 * bun run src/ai/train.ts
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { formatMetricsReport } from "./evaluation";
import { exportDatasetToCSV, generateSyntheticTelemetryDataset } from "./generator";
import { trainDiurnalModel } from "./model";
import { AIPredictionService, setActiveModelWeights } from "./service";

async function main() {
  console.log("\n🌿 ===================================================================");
  console.log("   SUGENG SMART WASTE AI ENGINE — PELATIHAN & EVALUASI REGRESI TTO");
  console.log("   Studi Kasus: Tempat Penampungan Sementara (TPS) Kota Magelang");
  console.log("===================================================================\n");

  // 1. Pastikan folder data tersedia
  const dataDir = join(process.cwd(), "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // 2. Generate Dataset Telemetri Diurnal Realistis (14 Hari / 1.344 Data Poin)
  console.log("⏳ [1/4] Mengenerate dataset telemetri diurnal 14 hari Kota Magelang...");
  const dataset = generateSyntheticTelemetryDataset({
    nodeId: "NODE-MGL-05", // TPS Kampus Tuguran UNTIDAR
    days: 14,
    intervalMinutes: 15,
  });

  const csvContent = exportDatasetToCSV(dataset);
  const csvPath = join(dataDir, "dataset_telemetry_magelang.csv");
  writeFileSync(csvPath, csvContent, "utf-8");
  console.log(`✅ Berhasil membuat dataset: ${dataset.length} baris rekaman.`);
  console.log(`📁 File tersimpan di: data/dataset_telemetry_magelang.csv (Siap untuk laporan/Excel)\n`);

  // 3. Latih Model Regresi Deret Waktu (Train-Test Split: 80% Train, 20% Test)
  console.log("🧠 [2/4] Melatih Model Diurnal Time-Series Regressor & TTO...");
  const modelWeights = trainDiurnalModel(dataset, 0.2);
  setActiveModelWeights(modelWeights);

  // 4. Tampilkan Laporan Evaluasi Akademik (Untuk Skripsi / Laporan Tugas Kuliah)
  console.log("📊 [3/4] Menghitung Metrik Evaluasi Akademik...");
  const report = formatMetricsReport(modelWeights.metrics);
  console.log(report);

  // Simpan bobot model ke JSON
  const weightsPath = join(dataDir, "tto_model_weights.json");
  writeFileSync(weightsPath, JSON.stringify(modelWeights, null, 2), "utf-8");
  console.log(`💾 Bobot model diekspor ke: data/tto_model_weights.json\n`);

  // 5. Demonstrasi Pengujian 3 Skenario Kondisi Riil
  console.log("🔬 [4/4] Simulasi Pengujian 3 Skenario Kondisi TPS di Magelang:\n");

  const scenarios = [
    {
      name: "Skenario 1: Pagi Sibuk di TPS Tuguran (Peak Hour)",
      volume: 72.0,
      hour: 8, // 08:00 WIB
      rate: 15.0, // laju pembuangan cepat
    },
    {
      name: "Skenario 2: Siang Hari di TPS Alun-Alun (Moderate)",
      volume: 48.0,
      hour: 13, // 13:00 WIB
      rate: 6.0, // laju normal
    },
    {
      name: "Skenario 3: Malam Hari di TPS Rejowinangun (Dormant)",
      volume: 25.0,
      hour: 23, // 23:00 WIB
      rate: 0.8, // aktivitas malam sepi
    },
  ];

  for (const sc of scenarios) {
    const result = AIPredictionService.simulatePrediction(sc.volume, sc.hour, sc.rate);
    console.log(`──────────────────────────────────────────────────────────────────`);
    console.log(`📌 ${sc.name}`);
    console.log(`   • Volume Saat Ini        : ${result.currentVolumePercent}% (${result.currentDistanceCm} cm)`);
    console.log(`   • Jam Pengukuran         : Pukul ${sc.hour.toString().padStart(2, "0")}:00 WIB`);
    console.log(`   • Laju Pengisian         : +${result.estimatedFillingRatePerHour}% / jam`);
    console.log(
      `   • Estimasi Waktu Kritis  : ${
        result.minutesToWarning !== null ? `Tersisa ${result.minutesToWarning} menit` : "Sudah Kritis"
      }`
    );
    console.log(
      `   • Estimasi Penuh (TTO)   : ${
        result.minutesToOverflow !== null ? `Tersisa ${result.minutesToOverflow} menit (${result.predictedOverflowTime?.slice(11, 16)} WIB)` : "Sudah Penuh"
      }`
    );
    console.log(`   • Status Urgensi AI      : [${result.urgencyLevel}]`);
    console.log(`   • Rekomendasi Tindakan   : ${result.recommendation}`);
    console.log(`   • Proyeksi 3 Jam Depan   : ${result.hourlyForecast.slice(0, 3).map((f) => `${f.targetHour}: ${f.predictedVolumePercent}%`).join("  ──>  ")}`);
  }

  console.log(`\n──────────────────────────────────────────────────────────────────`);
  console.log("✨ Pengujian dan pelatihan AI selesai dengan sukses 100%!\n");
}

main().catch((err) => {
  console.error("❌ Terjadi kegagalan pelatihan AI:", err);
  process.exit(1);
});

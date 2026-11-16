/**
 * SUGENG AI Engine — Dual-Model Training & Academic Evaluation Script
 * Menjalankan pembuatan dataset dummy, pelatihan model regresi diurnal (Model 1),
 * pelatihan model klasifikasi bahaya multi-sensor (Model 2), kalkulasi metrik akademik
 * (MAE, RMSE, R², Accuracy, F1-Score, Confusion Matrix), dan ekspor bobot model.
 *
 * Cara menjalankan:
 * bun run src/ai/train.ts
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  classifyMultiSensorHazard,
  setActiveClassifierWeights,
  trainHazardClassifier,
} from "./classifier";
import {
  formatClassificationReport,
  formatMetricsReport,
} from "./evaluation";
import {
  exportDatasetToCSV,
  exportHazardDatasetToCSV,
  generateSyntheticHazardDataset,
  generateSyntheticTelemetryDataset,
} from "./generator";
import { trainDiurnalModel } from "./model";
import { AIPredictionService, setActiveModelWeights } from "./service";

async function main() {
  console.log("\n🌿 ===================================================================");
  console.log("   SUGENG SMART WASTE AI ENGINE — DUAL-MODEL TRAINING & VALIDATION");
  console.log("   Model 1: Diurnal Time-Series Regressor & Time-to-Overflow (TTO)");
  console.log("   Model 2: Multi-Sensor Hazard & Decomposition Classifier");
  console.log("   Studi Kasus: Tempat Penampungan Sementara (TPS) Kota Magelang");
  console.log("===================================================================\n");

  const dataDir = join(process.cwd(), "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // ==============================================================================
  // BAGIAN 1: MODEL 1 (REGRESI WAKTU PENUH / TTO)
  // ==============================================================================
  console.log("⏳ [1/5] Mengenerate dataset telemetri diurnal 14 hari Kota Magelang...");
  const datasetTTO = generateSyntheticTelemetryDataset({
    nodeId: "NODE-MGL-05",
    days: 14,
    intervalMinutes: 15,
  });

  const csvTTOPath = join(dataDir, "dataset_telemetry_magelang.csv");
  writeFileSync(csvTTOPath, exportDatasetToCSV(datasetTTO), "utf-8");
  console.log(`✅ Dataset TTO: ${datasetTTO.length} baris rekaman tersimpan di data/dataset_telemetry_magelang.csv`);

  console.log("🧠 [2/5] Melatih Model 1: Diurnal Time-Series Regressor...");
  const modelWeightsTTO = trainDiurnalModel(datasetTTO, 0.2);
  setActiveModelWeights(modelWeightsTTO);

  const reportTTO = formatMetricsReport(modelWeightsTTO.metrics);
  console.log(reportTTO);

  const weightsTTOPath = join(dataDir, "tto_model_weights.json");
  writeFileSync(weightsTTOPath, JSON.stringify(modelWeightsTTO, null, 2), "utf-8");
  console.log(`💾 Bobot Model 1 diekspor ke: data/tto_model_weights.json\n`);

  // ==============================================================================
  // BAGIAN 2: MODEL 2 (KLASIFIKASI BAHAYA & DEKOMPOSISI MULTI-SENSOR)
  // ==============================================================================
  console.log("⏳ [3/5] Mengenerate dataset klasifikasi bahaya multi-sensor (1.000 sampel)...");
  const datasetHazard = generateSyntheticHazardDataset(1000);

  const csvHazardPath = join(dataDir, "dataset_hazard_classification.csv");
  writeFileSync(csvHazardPath, exportHazardDatasetToCSV(datasetHazard), "utf-8");
  console.log(`✅ Dataset Hazard: ${datasetHazard.length} baris rekaman tersimpan di data/dataset_hazard_classification.csv`);

  console.log("🧠 [4/5] Melatih Model 2: Multi-Sensor Hazard & Decomposition Classifier...");
  const modelWeightsHazard = trainHazardClassifier(datasetHazard, 0.2);
  setActiveClassifierWeights(modelWeightsHazard);

  const reportHazard = formatClassificationReport(modelWeightsHazard.metrics);
  console.log(reportHazard);

  const weightsHazardPath = join(dataDir, "hazard_classifier_weights.json");
  writeFileSync(weightsHazardPath, JSON.stringify(modelWeightsHazard, null, 2), "utf-8");
  console.log(`💾 Bobot Model 2 diekspor ke: data/hazard_classifier_weights.json\n`);

  // ==============================================================================
  // BAGIAN 3: SIMULASI PENGUJIAN 4 KASUS KONDISI RIIL (DUAL-AI)
  // ==============================================================================
  console.log("🔬 [5/5] Demonstrasi Pengujian 4 Skenario Kondisi Riil di Kota Magelang:\n");

  const scenarios = [
    {
      title: "Kasus 1: Sampah Rumah Tangga Normal / Segar (Pagi Hari)",
      volume: 35.0,
      hour: 7,
      rate: 11.5,
      ammonia: 22.0, // MQ-135 normal
      methane: 35.0, // MQ-4 normal
      temp: 26.5, // DHT22 sejuk
      humidity: 62.0,
    },
    {
      title: "Kasus 2: Sampah Pasar Tradisional Busuk / Bau Amonia Tinggi (Siang Panas)",
      volume: 48.0, // Belum penuh tapi busuk menyengat!
      hour: 12,
      rate: 6.5,
      ammonia: 82.0, // MQ-135 tinggi (amonia pembusukan)
      methane: 55.0, // MQ-4 normal
      temp: 31.5, // DHT22 hangat
      humidity: 84.0, // DHT22 lembab (organik basah)
    },
    {
      title: "Kasus 3: Bahaya Akumulasi Gas Metana / Rawan Kebakaran K3 (Sore Terik)",
      volume: 82.0, // Volume kritis
      hour: 16,
      rate: 13.0,
      ammonia: 32.0,
      methane: 380.0, // MQ-4 kritis (bahaya percikan api)
      temp: 38.5, // DHT22 sangat panas terik
      humidity: 38.0, // DHT22 kering
    },
    {
      title: "Kasus 4: Anomali Sensor Fisik / Sensor Jarak Tertutup Sampah Plastik",
      volume: 88.0,
      hour: 10,
      rate: 5.0,
      ammonia: 20.0,
      methane: 30.0,
      temp: 28.0,
      humidity: 60.0,
      distance: 93.5, // Diskrepansi: volume 88% tapi jarak baca 93.5 cm (seolah kosong!)
    },
  ];

  for (const sc of scenarios) {
    const result = AIPredictionService.simulatePrediction(sc.volume, sc.hour, sc.rate, {
      ammoniaIndexMQ135: sc.ammonia,
      methanePpmMQ4: sc.methane,
      temperatureCelsius: sc.temp,
      humidityPercent: sc.humidity,
    });

    const hz = result.hazardAssessment;

    console.log(`──────────────────────────────────────────────────────────────────`);
    console.log(`📌 ${sc.title}`);
    console.log(`   • Telemetri 4 Sensor     : Vol ${result.currentVolumePercent}% | MQ135 ${sc.ammonia}/100 | MQ4 ${sc.methane} ppm | T ${sc.temp}°C | RH ${sc.humidity}%`);
    console.log(`   • [Model 1 Regresi TTO]  : Estimasi Penuh ${result.minutesToOverflow !== null ? `±${result.minutesToOverflow} menit (${result.predictedOverflowTime?.slice(11, 16)} WIB)` : "Sudah Penuh"}`);
    console.log(`   • [Model 2 Klasifikasi]  : KELAS = [${hz.hazardClass}] · ${hz.classLabelIndonesian}`);
    console.log(`   • Tingkat Keparahan (K3) : [${hz.severityLevel}] (Confidence ${(hz.confidenceScore * 100).toFixed(1)}%)`);
    console.log(`   • Peringatan Keselamatan : ${hz.fireSafetyAlert ? "⚠️ BAHAYA KEBAKARAN METANA AKTIF" : hz.disinfectionRequired ? "☣️ PERLU SEMPROT DISINFEKTAN AMONIA" : "✓ Sanitasi Aman"}`);
    console.log(`   • Instruksi Operasional  : ${hz.operationalAction}`);
  }

  console.log(`\n──────────────────────────────────────────────────────────────────`);
  console.log("✨ Pengujian dan pelatihan Dual-AI (Regresi + Klasifikasi) selesai 100%!\n");
}

main().catch((err) => {
  console.error("❌ Terjadi kegagalan pelatihan AI:", err);
  process.exit(1);
});

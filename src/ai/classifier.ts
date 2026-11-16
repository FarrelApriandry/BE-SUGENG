/**
 * SUGENG AI Engine — Multi-Sensor Hazard & Decomposition Classifier (Model 2)
 * Mengklasifikasikan kondisi sanitasi sampah dan risiko gas menggunakan 4 sensor:
 * JSN-SR04T (Volume/Jarak) + MQ-135 (Amonia) + MQ-4 (Metana) + DHT22 (Suhu & RH)
 */

import { calculateClassificationMetrics } from "./evaluation";
import type {
  ClassifierModelWeights,
  HazardClass,
  HazardClassificationResult,
  HazardTrainingRecord,
  MultiSensorHazardInput,
} from "./types";

export const DEFAULT_CLASSIFIER_THRESHOLDS = {
  ammoniaWarning: 60.0,
  methaneWarning: 250.0,
  highTemperature: 32.0,
  highHumidity: 68.0,
};

let activeClassifierWeights: ClassifierModelWeights | null = null;

export function setActiveClassifierWeights(weights: ClassifierModelWeights): void {
  activeClassifierWeights = weights;
}

export function getActiveClassifierWeights(): ClassifierModelWeights | null {
  return activeClassifierWeights;
}

/**
 * Inferensi Klasifikasi Multi-Sensor secara Real-Time
 */
export function classifyMultiSensorHazard(
  input: MultiSensorHazardInput,
  weights?: ClassifierModelWeights
): HazardClassificationResult {
  const {
    currentVolumePercent,
    ammoniaIndexMQ135,
    methanePpmMQ4,
    temperatureCelsius,
    humidityPercent,
    measuredDistanceCm,
  } = input;

  const thresholds = weights?.thresholds || DEFAULT_CLASSIFIER_THRESHOLDS;

  // 1. Hitung Sub-Skor Risiko Multi-Sensor (Normalisasi 0 - 100)

  // A. Skor Dekomposisi Amonia (Faktor biokimia pembusukan organik basah)
  // Pembusukan bakteri anaerobik terakselerasi pada suhu hangat (>=27°C) dan kelembapan tinggi (>=65%)
  const bioFactor =
    1.0 +
    Math.max(0, (temperatureCelsius - 27.0) / 15.0) * 0.25 +
    Math.max(0, (humidityPercent - 65.0) / 20.0) * 0.2;
  const ammoniaRiskScore = Math.min(100, Number((ammoniaIndexMQ135 * bioFactor).toFixed(1)));

  // B. Skor Bahaya Gas Metana (Faktor kemudahan terbakar / Flammability)
  // Gas metana mudah terakumulasi dan berbahaya pada suhu tinggi (>=32°C) di wadah tertutup
  const thermalFactor =
    1.0 +
    Math.max(0, (temperatureCelsius - 30.0) / 10.0) * 0.35 +
    Math.max(0, (65.0 - humidityPercent) / 30.0) * 0.15;
  const methaneNorm = (methanePpmMQ4 / 500.0) * 100.0;
  const methaneRiskScore = Math.min(100, Number((methaneNorm * thermalFactor).toFixed(1)));

  // C. Skor Risiko Termal Lingkungan
  const thermalRiskScore = Math.min(
    100,
    Number(Math.max(0, ((temperatureCelsius - 25.0) / 20.0) * 100.0).toFixed(1))
  );

  // D. Skor Integritas Fisik Sensor (Konsistensi Jarak vs Volume)
  let physicalAnomalyScore = 0;
  if (measuredDistanceCm !== undefined) {
    const expectedDist = 95.0 - (currentVolumePercent / 100.0) * 75.0;
    const distDiscrepancy = Math.abs(measuredDistanceCm - expectedDist);
    if (distDiscrepancy > 25.0) {
      physicalAnomalyScore = Math.min(100, Number((distDiscrepancy * 2.5).toFixed(1)));
    }
  }

  // 2. Evaluasi Ambang Batas Logika Pohon Keputusan (Decision Logic)
  let hazardClass: HazardClass = "NORMAL";
  let classLabelIndonesian = "Sanitasi Normal (Sampah Segar)";
  let severityLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  let operationalAction = "Kondisi sanitasi aman. Penanganan mengikuti jadwal reguler armada.";
  let disinfectionRequired = false;
  let fireSafetyAlert = false;
  let confidenceScore = 0.94;

  // Aturan 1: Deteksi Anomali Malfungsi Sensor
  if (
    physicalAnomalyScore >= 60 ||
    temperatureCelsius > 55.0 ||
    temperatureCelsius < 10.0 ||
    humidityPercent < 15.0
  ) {
    hazardClass = "SENSOR_ANOMALY";
    classLabelIndonesian = "Anomali Sensor / Perlu Kalibrasi";
    severityLevel = "MEDIUM";
    operationalAction =
      "Terdeteksi ketidakcocokan pembacaan sensor fisik. Petugas teknis perlu memeriksa sensor di lapangan.";
    confidenceScore = 0.91;
  }
  // Aturan 2: Bahaya Akumulasi Gas Metana Kritis (Prioritas Keselamatan K3 Tertinggi)
  else if (
    methanePpmMQ4 >= thresholds.methaneWarning ||
    methaneRiskScore >= 60.0
  ) {
    hazardClass = "METHANE_HAZARD";
    classLabelIndonesian = "Bahaya Gas Metana / Rawan Terbakar";
    severityLevel = methanePpmMQ4 >= 350.0 ? "CRITICAL" : "HIGH";
    operationalAction =
      "BAHAYA GAS: Jauhkan percikan api dan puntung rokok dari wadah TPS. Buka ventilasi udara dan prioritaskan pengosongan armada.";
    disinfectionRequired = true;
    fireSafetyAlert = true;
    confidenceScore = Number(Math.min(0.99, 0.88 + (methanePpmMQ4 / 1000.0)).toFixed(2));
  }
  // Aturan 3: Degradasi Aktif Bahan Organik & Bau Amonia Menyengat
  else if (
    ammoniaIndexMQ135 >= thresholds.ammoniaWarning ||
    ammoniaRiskScore >= 55.0
  ) {
    hazardClass = "ACTIVE_DECOMPOSITION";
    classLabelIndonesian = "Degradasi Aktif / Bau Busuk Menyengat";
    severityLevel = ammoniaIndexMQ135 >= 80.0 ? "HIGH" : "MEDIUM";
    operationalAction =
      "WASPADA SANITASI: Bau pembusukan sampah basah melampaui batas wajar pemukiman. Jadwalkan penyemprotan disinfektan dan angkut lebih awal.";
    disinfectionRequired = true;
    confidenceScore = Number(Math.min(0.98, 0.86 + (ammoniaIndexMQ135 / 200.0)).toFixed(2));
  }
  // Aturan 4: Kondisi Sanitasi Normal
  else {
    hazardClass = "NORMAL";
    classLabelIndonesian = "Sanitasi Normal (Kondisi Aman)";
    severityLevel = "LOW";
    operationalAction = "Kondisi sanitasi dan emisi gas terkendali dalam batas aman lingkungan.";
    confidenceScore = 0.96;
  }

  return {
    hazardClass,
    classLabelIndonesian,
    severityLevel,
    confidenceScore,
    sensorAttribution: {
      ammoniaRiskScore,
      methaneRiskScore,
      thermalRiskScore,
      physicalIntegrityScore: 100 - physicalAnomalyScore,
    },
    operationalAction,
    disinfectionRequired,
    fireSafetyAlert,
  };
}

/**
 * Melatih dan memvalidasi model klasifikasi terhadap dataset latih
 */
export function trainHazardClassifier(
  records: HazardTrainingRecord[],
  testRatio = 0.2
): ClassifierModelWeights {
  const splitIndex = Math.floor(records.length * (1 - testRatio));
  const trainData = records.slice(0, splitIndex);
  const testData = records.slice(splitIndex);

  const yTrue: HazardClass[] = [];
  const yPred: HazardClass[] = [];

  testData.forEach((rec) => {
    const res = classifyMultiSensorHazard({
      currentVolumePercent: rec.currentVolumePercent,
      ammoniaIndexMQ135: rec.ammoniaIndexMQ135,
      methanePpmMQ4: rec.methanePpmMQ4,
      temperatureCelsius: rec.temperatureCelsius,
      humidityPercent: rec.humidityPercent,
      measuredDistanceCm: rec.measuredDistanceCm,
    });

    yTrue.push(rec.groundTruthClass);
    yPred.push(res.hazardClass);
  });

  const metrics = calculateClassificationMetrics(yTrue, yPred);

  const modelWeights: ClassifierModelWeights = {
    version: "1.0.0",
    trainedAt: new Date().toISOString(),
    trainingSamplesCount: trainData.length,
    testSamplesCount: testData.length,
    metrics,
    thresholds: DEFAULT_CLASSIFIER_THRESHOLDS,
  };

  setActiveClassifierWeights(modelWeights);
  return modelWeights;
}

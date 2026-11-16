/**
 * SUGENG AI Engine — Type Definitions
 * Dual-Model AI Architecture:
 * - Model 1: Diurnal Time-Series Regressor & Time-to-Overflow (TTO) Predictor
 * - Model 2: Multi-Sensor Hazard & Decomposition Classifier (JSN-SR04T + MQ-135 + MQ-4 + DHT22)
 * Studi Kasus: TPS Kota Magelang & TPSA Banyuurip
 */

// ==============================================================================
// 1. Tipe Data Model 1: Regresi Deret Waktu Diurnal (TTO)
// ==============================================================================

export interface TelemetryTrainingRecord {
  timestamp: string;
  nodeId: string;
  hourOfDay: number;
  dayOfWeek: number; // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  currentVolumePercent: number;
  measuredDistanceCm: number;
  temperatureCelsius: number;
  humidityPercent: number;
  fillingRatePerHour: number;
  isPeakHour: boolean;
  isEmptyingEvent: boolean;
}

export interface DiurnalHourlyProfile {
  hour: number;
  averageRatePerHour: number;
  standardDeviation: number;
  sampleCount: number;
}

export interface ModelWeights {
  version: string;
  trainedAt: string;
  trainingSamplesCount: number;
  testSamplesCount: number;
  metrics: ModelEvaluationMetrics;
  diurnalHourlyProfile: Record<number, number>; // hour (0-23) -> avg filling rate (%/hr)
  globalAverageRatePerHour: number;
  polynomialCoefficients: [number, number, number]; // [a, b, c] for a*t^2 + b*t + c
}

export interface ModelEvaluationMetrics {
  mae: number; // Mean Absolute Error (% volume)
  rmse: number; // Root Mean Square Error (% volume)
  r2Score: number; // Coefficient of Determination (0.0 to 1.0)
  mape: number; // Mean Absolute Percentage Error (%)
  sampleEvaluated: number;
}

export type UrgencyLevel =
  | "SAFE_STABLE" // Laju rendah, aman > 6 jam
  | "MODERATE_FILLING" // Laju normal, penuh dalam 3 - 6 jam
  | "RAPID_FILLING" // Laju cepat (peak hour), penuh dalam 1 - 3 jam
  | "CRITICAL_IMMINENT" // Volume >= 80% atau penuh dalam < 1 jam
  | "ALREADY_FULL"; // Volume >= 98%

export interface HourlyForecastPoint {
  targetTimestamp: string;
  targetHour: string; // format "HH:00"
  predictedVolumePercent: number;
  confidenceLower: number; // batas bawah 95% CI
  confidenceUpper: number; // batas atas 95% CI
}

// ==============================================================================
// 2. Tipe Data Model 2: Multi-Sensor Hazard & Decomposition Classifier
// ==============================================================================

export type HazardClass =
  | "NORMAL" // Kelas 0: Normal / Sampah Segar (Aman)
  | "ACTIVE_DECOMPOSITION" // Kelas 1: Degradasi Aktif / Bau Amonia Menyengat
  | "METHANE_HAZARD" // Kelas 2: Risiko Gas Metana / Bahaya Terbakar K3
  | "SENSOR_ANOMALY"; // Kelas 3: Anomali Bacaan Fisik / Malfungsi Sensor

export interface MultiSensorHazardInput {
  currentVolumePercent: number; // 0 - 100% (JSN-SR04T)
  ammoniaIndexMQ135: number; // 0 - 100 atau ppm (MQ-135)
  methanePpmMQ4: number; // 0 - 500 ppm (MQ-4)
  temperatureCelsius: number; // 20 - 45 °C (DHT22)
  humidityPercent: number; // 30 - 100 % (DHT22)
  measuredDistanceCm?: number; // Jarak cm sensor JSN-SR04T
}

export interface HazardTrainingRecord extends MultiSensorHazardInput {
  recordId: string;
  timestamp: string;
  groundTruthClass: HazardClass;
  isSimulatedScenario: string;
}

export interface HazardClassificationResult {
  hazardClass: HazardClass;
  classLabelIndonesian: string;
  severityLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidenceScore: number; // 0.0 to 1.0 (probabilitas)
  sensorAttribution: {
    ammoniaRiskScore: number; // 0 - 100
    methaneRiskScore: number; // 0 - 100
    thermalRiskScore: number; // 0 - 100
    physicalIntegrityScore: number; // 0 - 100
  };
  operationalAction: string;
  disinfectionRequired: boolean;
  fireSafetyAlert: boolean;
}

export interface ConfusionMatrix {
  classes: HazardClass[];
  matrix: number[][]; // [actual][predicted]
  totalSamples: number;
}

export interface ClassPerformanceMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  support: number;
}

export interface ClassificationEvaluationMetrics {
  accuracy: number; // Overall accuracy (0.0 to 1.0)
  macroF1Score: number;
  weightedF1Score: number;
  classMetrics: Record<HazardClass, ClassPerformanceMetrics>;
  confusionMatrix: ConfusionMatrix;
  sampleEvaluated: number;
}

export interface ClassifierModelWeights {
  version: string;
  trainedAt: string;
  trainingSamplesCount: number;
  testSamplesCount: number;
  metrics: ClassificationEvaluationMetrics;
  thresholds: {
    ammoniaWarning: number;
    methaneWarning: number;
    highTemperature: number;
    highHumidity: number;
  };
}

// ==============================================================================
// 3. Payload Respons Terpadu (Dual-AI Integrated Response)
// ==============================================================================

export interface PredictionResult {
  nodeId: string;
  nodeName: string;
  calculatedAt: string;
  currentVolumePercent: number;
  currentDistanceCm: number;
  estimatedFillingRatePerHour: number;
  minutesToWarning: number | null; // menit sampai 75%
  predictedWarningTime: string | null;
  minutesToOverflow: number | null; // menit sampai 100%
  predictedOverflowTime: string | null;
  urgencyLevel: UrgencyLevel;
  recommendation: string;
  hourlyForecast: HourlyForecastPoint[];
  hazardAssessment: HazardClassificationResult; // Integrasi Model 2
  modelInfo: {
    modelName: string;
    r2Score: number;
    mae: number;
    rmse: number;
    classifierAccuracy: number;
    classifierF1Score: number;
    isUsingLiveSensorSlope: boolean;
  };
}

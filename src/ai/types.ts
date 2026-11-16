/**
 * SUGENG AI Engine — Type Definitions
 * Model: Diurnal Time-Series Regressor & Time-to-Overflow (TTO) Predictor
 * Studi Kasus: TPS Kota Magelang & TPSA Banyuurip
 */

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

export interface PredictionResult {
  nodeId: string;
  nodeName: string;
  calculatedAt: string;
  currentVolumePercent: number;
  currentDistanceCm: number;
  estimatedFillingRatePerHour: number;
  minutesToWarning: number | null; // menit sampai 75% (null jika sudah >= 75%)
  predictedWarningTime: string | null;
  minutesToOverflow: number | null; // menit sampai 100% (null jika sudah 100%)
  predictedOverflowTime: string | null;
  urgencyLevel: UrgencyLevel;
  recommendation: string;
  hourlyForecast: HourlyForecastPoint[];
  modelInfo: {
    modelName: string;
    r2Score: number;
    mae: number;
    rmse: number;
    isUsingLiveSensorSlope: boolean;
  };
}

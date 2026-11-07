/**
 * Tipe Data & Domain Model SUGENG
 */

export type VolumeStatus = "SAFE" | "WARNING" | "CRITICAL";
export type GasLevel = "SAFE" | "WARNING" | "CRITICAL";

/**
 * Payload mentah dari firmware ESP32 DevKit V1
 */
export interface TelemetryPayload {
  nodeId: string;
  temperatureCelsius: number;
  humidityPercent: number;
  measuredDistanceCm: number;
  currentVolumePercent: number;
  gasPpmMQ135: number;
  methanePpmMQ4: number;
  mq135Adc: number;
  mq4Adc: number;
  mq135Pct: number;
  mq4Pct: number;
  uptimeSec: number;
}

/**
 * Hasil evaluasi ambang batas gas
 */
export interface GasEvaluation {
  gasAlert: boolean;
  ammoniaLevel: GasLevel;
  methaneLevel: GasLevel;
}

/**
 * Data telemetri lengkap yang telah diperkaya status ambang batas
 */
export interface ProcessedTelemetry extends TelemetryPayload {
  volumeStatus: VolumeStatus;
  gasAlert: boolean;
  ammoniaLevel: GasLevel;
  methaneLevel: GasLevel;
  calculatedAt: string;
}

/**
 * Titik Lokasi Tempat Penampungan Sementara (TPS)
 */
export interface TPSNode {
  nodeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacityLiters: number;
  volumeStatus?: VolumeStatus;
  lastVolumePercent?: number;
  lastGasAlert?: boolean;
  lastTemperature?: number;
  lastHumidity?: number;
  lastUpdated?: string;
}

/**
 * Format Standar Response API
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code: number;
  timestamp: string;
}

import { config } from "../config/env";
import type { GasEvaluation, GasLevel, ProcessedTelemetry, TelemetryPayload, VolumeStatus } from "../types/telemetry";

/**
 * Menghitung status volume bak sampah berdasarkan persentase keterisian
 * - SAFE: < 50.0%
 * - WARNING: 50.0% - 74.9%
 * - CRITICAL: >= 75.0%
 */
export function calculateVolumeStatus(volumePercent: number): VolumeStatus {
  if (volumePercent >= 75.0) {
    return "CRITICAL";
  }
  if (volumePercent >= 50.0) {
    return "WARNING";
  }
  return "SAFE";
}

/**
 * Mengevaluasi kadar gas amonia (MQ-135) dan metana (MQ-4)
 * - Gas Alert bernilai true jika gasPpmMQ135 >= 60.0 ATAU methanePpmMQ4 >= 250.0
 * - Amonia: Safe (<30), Warning (30-59.9), Critical (>=60)
 * - Metana: Safe (<100), Warning (100-249.9), Critical (>=250)
 */
export function evaluateGasLevels(
  gasPpmMQ135: number,
  methanePpmMQ4: number
): GasEvaluation {
  let ammoniaLevel: GasLevel = "SAFE";
  if (gasPpmMQ135 >= 60.0) {
    ammoniaLevel = "CRITICAL";
  } else if (gasPpmMQ135 >= 30.0) {
    ammoniaLevel = "WARNING";
  }

  let methaneLevel: GasLevel = "SAFE";
  if (methanePpmMQ4 >= 250.0) {
    methaneLevel = "CRITICAL";
  } else if (methanePpmMQ4 >= 100.0) {
    methaneLevel = "WARNING";
  }

  const gasAlert = gasPpmMQ135 >= 60.0 || methanePpmMQ4 >= 250.0;

  return {
    gasAlert,
    ammoniaLevel,
    methaneLevel,
  };
}

/**
 * Menghitung persentase volume dari jarak ultrasonik berdasarkan dimensi bak 120L
 * Formula: v = (H_TOTAL - d) / (H_TOTAL - S_BLIND) * 100
 */
export function computeVolumeFromDistance(
  distanceCm: number,
  fallbackVolumePct: number = 0
): number {
  if (distanceCm < 0) {
    // Sensor out of range / error -> gunakan fallback
    return fallbackVolumePct;
  }

  const { totalHeightCm, blindDistanceCm } = config.binConstants;
  const effectiveHeight = totalHeightCm - blindDistanceCm;

  if (effectiveHeight <= 0) return fallbackVolumePct;

  let vol = ((totalHeightCm - distanceCm) / effectiveHeight) * 100.0;
  if (vol < 0) vol = 0;
  if (vol > 100) vol = 100;

  return Number(vol.toFixed(1));
}

/**
 * Sanitasi & pengayaan payload mentah menjadi ProcessedTelemetry
 */
export function processTelemetryPayload(
  payload: TelemetryPayload,
  fallbackVolume?: number
): ProcessedTelemetry {
  let currentVolume = payload.currentVolumePercent;

  // Jika jarak invalid (-1) dan volume bernilai 0 atau tidak realistis, gunakan fallback jika ada
  if (payload.measuredDistanceCm < 0 && fallbackVolume !== undefined) {
    currentVolume = fallbackVolume;
  }

  // Batasi volume di rentang 0-100%
  const sanitizedVolume = Math.min(100, Math.max(0, currentVolume));

  const volumeStatus = calculateVolumeStatus(sanitizedVolume);
  const gasEval = evaluateGasLevels(payload.gasPpmMQ135, payload.methanePpmMQ4);

  return {
    ...payload,
    currentVolumePercent: sanitizedVolume,
    volumeStatus,
    gasAlert: gasEval.gasAlert,
    ammoniaLevel: gasEval.ammoniaLevel,
    methaneLevel: gasEval.methaneLevel,
    calculatedAt: new Date().toISOString(),
  };
}

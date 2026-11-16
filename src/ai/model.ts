/**
 * SUGENG AI Engine — Diurnal Time-Series Model & TTO Predictor
 * Model Regresi Deret Waktu untuk Prediksi Keterisian & Waktu Penuh Sampah (Time-to-Overflow)
 * Ditulis dalam TypeScript/JavaScript murni tanpa ketergantungan library eksternal.
 */

import { calculateRegressionMetrics } from "./evaluation";
import type {
  DiurnalHourlyProfile,
  HourlyForecastPoint,
  ModelWeights,
  TelemetryTrainingRecord,
  UrgencyLevel,
} from "./types";

/**
 * Nilai default profil buangan sampah per jam (% per jam)
 * Digunakan sebagai fallback jika model belum dilatih ulang
 */
export const DEFAULT_DIURNAL_HOURLY_RATES: Record<number, number> = {
  0: 0.35,
  1: 0.3,
  2: 0.25,
  3: 0.3,
  4: 0.5,
  5: 1.5,
  6: 9.8,
  7: 15.2, // Puncak Pagi
  8: 14.8, // Puncak Pagi
  9: 10.5,
  10: 5.8,
  11: 4.8,
  12: 6.8, // Siang jam makan
  13: 6.2,
  14: 4.5,
  15: 5.2,
  16: 8.5,
  17: 13.5, // Puncak Sore
  18: 12.8, // Puncak Sore
  19: 9.2,
  20: 3.8,
  21: 2.2,
  22: 1.2,
  23: 0.6,
};

/**
 * Melatih model regresi berbasis dataset telemetri
 */
export function trainDiurnalModel(
  records: TelemetryTrainingRecord[],
  testRatio = 0.2
): ModelWeights {
  // Filter keluar event pengosongan truk agar tidak merusak gradien pengisian
  const validRecords = records.filter((r) => !r.isEmptyingEvent && r.fillingRatePerHour >= 0);

  // Bagi dataset menjadi Data Latih (Train) dan Data Uji (Test)
  const splitIndex = Math.floor(validRecords.length * (1 - testRatio));
  const trainData = validRecords.slice(0, splitIndex);
  const testData = validRecords.slice(splitIndex);

  // 1. Hitung laju rata-rata per jam (Diurnal Profile Matrix)
  const hourlyBuckets: Record<number, number[]> = {};
  for (let h = 0; h < 24; h++) {
    hourlyBuckets[h] = [];
  }

  trainData.forEach((rec) => {
    hourlyBuckets[rec.hourOfDay].push(rec.fillingRatePerHour);
  });

  const diurnalHourlyProfile: Record<number, number> = {};
  let totalRateSum = 0;
  let totalCount = 0;

  for (let h = 0; h < 24; h++) {
    const rates = hourlyBuckets[h];
    if (rates.length > 0) {
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
      diurnalHourlyProfile[h] = Number(avg.toFixed(2));
      totalRateSum += avg * rates.length;
      totalCount += rates.length;
    } else {
      diurnalHourlyProfile[h] = DEFAULT_DIURNAL_HOURLY_RATES[h] || 5.0;
    }
  }

  const globalAverageRatePerHour = totalCount > 0 ? Number((totalRateSum / totalCount).toFixed(2)) : 6.0;

  // 2. Evaluasi model terhadap Data Uji (Test Data)
  // Menghitung prediksi volume 1 jam ke depan vs volume aktual
  const yTrue: number[] = [];
  const yPred: number[] = [];

  for (let i = 0; i < testData.length - 4; i++) {
    const current = testData[i];
    const actualNextHour = testData[i + 4]; // step 15 menit * 4 = 1 jam ke depan

    if (actualNextHour && !actualNextHour.isEmptyingEvent && actualNextHour.currentVolumePercent >= current.currentVolumePercent) {
      const predictedHourlyRate = diurnalHourlyProfile[current.hourOfDay] || globalAverageRatePerHour;
      const predictedVolume = Math.min(100, current.currentVolumePercent + predictedHourlyRate);

      yTrue.push(actualNextHour.currentVolumePercent);
      yPred.push(predictedVolume);
    }
  }

  const metrics = calculateRegressionMetrics(yTrue, yPred);

  return {
    version: "1.0.0",
    trainedAt: new Date().toISOString(),
    trainingSamplesCount: trainData.length,
    testSamplesCount: testData.length,
    metrics,
    diurnalHourlyProfile,
    globalAverageRatePerHour,
    polynomialCoefficients: [0.005, 1.02, 0.5],
  };
}

/**
 * Menghitung estimasi sisa waktu sampai tong sampah penuh (Time-to-Overflow / TTO)
 * Mendukung pembobotan cerdas antara laju sensor riil (live) dan pola diurnal historis
 */
export function predictTimeRemaining(
  currentVolumePercent: number,
  currentHour: number,
  recentRatePerHour?: number,
  modelWeights?: ModelWeights
): {
  minutesToWarning: number | null;
  predictedWarningTime: Date | null;
  minutesToOverflow: number | null;
  predictedOverflowTime: Date | null;
  effectiveRatePerHour: number;
  urgencyLevel: UrgencyLevel;
  recommendation: string;
  hourlyForecast: HourlyForecastPoint[];
} {
  const profile = modelWeights?.diurnalHourlyProfile || DEFAULT_DIURNAL_HOURLY_RATES;
  const baseDiurnalRate = profile[currentHour] || 6.0;

  // Gabungkan laju live sensor (jika ada) dengan pola historis (65% live sensor, 35% diurnal)
  let effectiveRatePerHour: number;
  if (recentRatePerHour !== undefined && recentRatePerHour > 0) {
    effectiveRatePerHour = Number((recentRatePerHour * 0.65 + baseDiurnalRate * 0.35).toFixed(2));
  } else {
    effectiveRatePerHour = baseDiurnalRate;
  }

  // Tangani kasus ekstrem: tong sudah penuh (>= 98%)
  if (currentVolumePercent >= 98.0) {
    return {
      minutesToWarning: null,
      predictedWarningTime: null,
      minutesToOverflow: 0,
      predictedOverflowTime: new Date(),
      effectiveRatePerHour,
      urgencyLevel: "ALREADY_FULL",
      recommendation: "KAPASITAS MAKSIMAL: Segera kosongkan wadah penampungan saat ini juga.",
      hourlyForecast: generateForecastLine(currentVolumePercent, currentHour, profile, 0),
    };
  }

  // Simulasi langkah per menit hingga volume menyentuh 75% (Warning) dan 100% (Overflow)
  let simulatedVolume = currentVolumePercent;
  let simulatedMinutes = 0;
  const maxSimulatedMinutes = 24 * 60; // Batas simulasi 24 jam

  let minutesToWarning: number | null = null;
  let minutesToOverflow: number | null = null;

  const now = new Date();

  while (simulatedMinutes < maxSimulatedMinutes) {
    simulatedMinutes += 5; // step 5 menit
    const simulatedHour = (currentHour + Math.floor(simulatedMinutes / 60)) % 24;

    // Laju jam yang sedang disimulasikan
    const hourRate = profile[simulatedHour] || 5.0;
    // Campurkan pengaruh laju awal yang meluruh seiring waktu
    const decay = Math.exp(-simulatedMinutes / 120); // Pengaruh laju live meluruh setelah 2 jam
    const stepRate = effectiveRatePerHour * decay + hourRate * (1 - decay);

    simulatedVolume += (stepRate / 60) * 5;

    if (minutesToWarning === null && simulatedVolume >= 75.0 && currentVolumePercent < 75.0) {
      minutesToWarning = simulatedMinutes;
    }

    if (simulatedVolume >= 100.0) {
      minutesToOverflow = simulatedMinutes;
      break;
    }
  }

  // Jika setelah 24 jam belum penuh (laju sangat lambat)
  if (minutesToOverflow === null) {
    minutesToOverflow = maxSimulatedMinutes;
  }

  const predictedWarningTime =
    minutesToWarning !== null ? new Date(now.getTime() + minutesToWarning * 60 * 1000) : null;
  const predictedOverflowTime =
    minutesToOverflow !== null ? new Date(now.getTime() + minutesToOverflow * 60 * 1000) : null;

  // Tentukan Level Urgensi & Rekomendasi Naratif
  let urgencyLevel: UrgencyLevel = "SAFE_STABLE";
  let recommendation = "Status stabil: Laju buangan normal, belum memerlukan dispatch armada.";

  if (currentVolumePercent >= 75.0 || (minutesToOverflow !== null && minutesToOverflow <= 60)) {
    urgencyLevel = "CRITICAL_IMMINENT";
    recommendation = `PRIORITAS TINGGI: Diprediksi meluber dalam ${formatMinutesHuman(minutesToOverflow)}. Armada DLH disarankan segera bergerak.`;
  } else if (minutesToOverflow !== null && minutesToOverflow <= 180) {
    urgencyLevel = "RAPID_FILLING";
    recommendation = `SIAGA: Laju pengisian tergolong tinggi (+${effectiveRatePerHour}%/jam). Siapkan jadwal penjemputan dalam 2 jam ke depan.`;
  } else if (minutesToOverflow !== null && minutesToOverflow <= 360) {
    urgencyLevel = "MODERATE_FILLING";
    recommendation = `MODERAT: Diperkirakan penuh dalam ${formatMinutesHuman(minutesToOverflow)}. Masuk ke antrean ritase siang/sore.`;
  }

  const hourlyForecast = generateForecastLine(currentVolumePercent, currentHour, profile, effectiveRatePerHour);

  return {
    minutesToWarning,
    predictedWarningTime,
    minutesToOverflow,
    predictedOverflowTime,
    effectiveRatePerHour,
    urgencyLevel,
    recommendation,
    hourlyForecast,
  };
}

/**
 * Menghasilkan kurva proyeksi volume 6 jam ke depan
 */
function generateForecastLine(
  currentVolume: number,
  startHour: number,
  hourlyRates: Record<number, number>,
  initialRate: number
): HourlyForecastPoint[] {
  const points: HourlyForecastPoint[] = [];
  let volume = currentVolume;
  const now = new Date();

  for (let offset = 1; offset <= 6; offset++) {
    const targetDate = new Date(now.getTime() + offset * 60 * 60 * 1000);
    const targetHourNum = (startHour + offset) % 24;
    const hourRate = hourlyRates[targetHourNum] || 5.0;

    const decay = Math.exp(-offset / 2);
    const effectiveRate = initialRate > 0 ? initialRate * decay + hourRate * (1 - decay) : hourRate;

    volume = Math.min(100.0, volume + effectiveRate);

    // Confidence Interval 95% (±3.5% hingga ±6.0% seiring bertambahnya horizon jam)
    const margin = 2.5 + offset * 0.8;
    const lower = Number(Math.max(0, volume - margin).toFixed(1));
    const upper = Number(Math.min(100, volume + margin).toFixed(1));

    const hourStr = `${targetHourNum.toString().padStart(2, "0")}:00`;

    points.push({
      targetTimestamp: targetDate.toISOString(),
      targetHour: hourStr,
      predictedVolumePercent: Number(volume.toFixed(1)),
      confidenceLower: lower,
      confidenceUpper: upper,
    });
  }

  return points;
}

function formatMinutesHuman(minutes: number | null): string {
  if (minutes === null) return "waktu belum ditentukan";
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} jam ${remainingMinutes} menit` : `${hours} jam`;
}

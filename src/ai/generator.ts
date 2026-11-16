/**
 * SUGENG AI Engine — Synthetic Diurnal Telemetry Dataset Generator
 * Menghasilkan dataset time-series sintetis yang mencerminkan pola pembuangan sampah harian
 * di Kota Magelang (pagi tinggi, siang moderat, sore tinggi, malam istirahat).
 */

import type { TelemetryTrainingRecord } from "./types";

export interface GeneratorOptions {
  nodeId?: string;
  days?: number;
  intervalMinutes?: number;
  startDate?: Date;
}

/**
 * Menentukan profil laju dasar buangan sampah (% per jam) berdasarkan jam dalam sehari
 */
export function getDiurnalBaseRate(hour: number): { rate: number; isPeak: boolean } {
  // Puncak Pagi (06:00 - 09:30): Pasar Rejowinangun / warga mulai beraktivitas
  if (hour >= 6 && hour <= 9) {
    const peakFactor = hour === 7 || hour === 8 ? 14.5 : 11.0;
    return { rate: peakFactor, isPeak: true };
  }

  // Siang Hari (10:00 - 15:00): Aktivitas normal kantor dan sekolah
  if (hour >= 10 && hour <= 15) {
    const middayFactor = hour === 12 || hour === 13 ? 6.5 : 4.5;
    return { rate: middayFactor, isPeak: false };
  }

  // Puncak Sore (16:00 - 19:30): PKL kuliner sore, pasar sore, pertokoan
  if (hour >= 16 && hour <= 19) {
    const eveningFactor = hour === 17 || hour === 18 ? 12.0 : 8.5;
    return { rate: eveningFactor, isPeak: true };
  }

  // Malam Menuju Larut (20:00 - 22:00): Toko tutup, aktivitas berkurang
  if (hour >= 20 && hour <= 22) {
    return { rate: 2.5, isPeak: false };
  }

  // Dini Hari (23:00 - 05:00): Jam tidur, buangan sampah hampir nol
  return { rate: 0.4, isPeak: false };
}

/**
 * Menghasilkan deret waktu telemetri sampah realistis
 */
export function generateSyntheticTelemetryDataset(
  options: GeneratorOptions = {}
): TelemetryTrainingRecord[] {
  const {
    nodeId = "NODE-MGL-05", // TPS Kampus Tuguran UNTIDAR
    days = 14,
    intervalMinutes = 15,
    startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000),
  } = options;

  const records: TelemetryTrainingRecord[] = [];
  const totalSteps = Math.floor((days * 24 * 60) / intervalMinutes);

  let currentVolume = 12.0; // Volume awal 12%
  const stepHours = intervalMinutes / 60;

  // Nilai acak dengan seed deterministik sederhana
  let pseudoRandomSeed = 42;
  const nextRandom = () => {
    pseudoRandomSeed = (pseudoRandomSeed * 9301 + 49297) % 233280;
    return pseudoRandomSeed / 233280;
  };

  for (let step = 0; step < totalSteps; step++) {
    const timestampDate = new Date(startDate.getTime() + step * intervalMinutes * 60 * 1000);
    const hourOfDay = timestampDate.getHours();
    const dayOfWeek = timestampDate.getDay();

    const { rate: baseRate, isPeak } = getDiurnalBaseRate(hourOfDay);

    // Variasi acak ±20% dan faktor akhir pekan (Sabtu/Minggu sedikit lebih ramai di sore)
    const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 1.15 : 1.0;
    const noise = (nextRandom() - 0.5) * 0.4; // antara -0.2 sampai +0.2
    const effectiveRatePerHour = Math.max(0.1, baseRate * weekendMultiplier * (1 + noise));

    let isEmptyingEvent = false;

    // Tambahkan pertambahan volume pada step ini
    const volumeDelta = effectiveRatePerHour * stepHours;
    currentVolume += volumeDelta;

    // Jika volume melampaui 88% - 95%, truk DLH mengosongkan tempat sampah
    const emptyingThreshold = 88.0 + nextRandom() * 8.0; // antara 88% - 96%
    if (currentVolume >= emptyingThreshold) {
      currentVolume = 2.0 + nextRandom() * 4.0; // reset ke 2% - 6%
      isEmptyingEvent = true;
    }

    currentVolume = Math.min(100.0, Math.max(0.0, currentVolume));

    // Hitung jarak fisik JSN-SR04T (20 cm penuh, 95 cm kosong)
    const emptyDistance = 95.0;
    const fullDistance = 20.0;
    const measuredDistanceCm = emptyDistance - (currentVolume / 100.0) * (emptyDistance - fullDistance);

    // Suhu & kelembapan harian Magelang
    // Suhu dingin pagi 24C, siang panas 32C
    const tempBase = 24.0 + 8.0 * Math.sin(((hourOfDay - 6) / 24) * 2 * Math.PI);
    const temperatureCelsius = Number((tempBase + (nextRandom() - 0.5) * 1.5).toFixed(1));
    const humidityPercent = Number((90.0 - (temperatureCelsius - 22.0) * 2.8 + (nextRandom() - 0.5) * 3).toFixed(1));

    records.push({
      timestamp: timestampDate.toISOString(),
      nodeId,
      hourOfDay,
      dayOfWeek,
      currentVolumePercent: Number(currentVolume.toFixed(2)),
      measuredDistanceCm: Number(measuredDistanceCm.toFixed(1)),
      temperatureCelsius,
      humidityPercent,
      fillingRatePerHour: Number(effectiveRatePerHour.toFixed(2)),
      isPeakHour: isPeak,
      isEmptyingEvent,
    });
  }

  return records;
}

/**
 * Format dataset ke dalam CSV untuk laporan atau ekspor
 */
export function exportDatasetToCSV(records: TelemetryTrainingRecord[]): string {
  const headers = [
    "timestamp",
    "node_id",
    "hour_of_day",
    "day_of_week",
    "current_volume_percent",
    "measured_distance_cm",
    "temperature_celsius",
    "humidity_percent",
    "filling_rate_per_hour",
    "is_peak_hour",
    "is_emptying_event",
  ];

  const rows = records.map((r) => [
    r.timestamp,
    r.nodeId,
    r.hourOfDay,
    r.dayOfWeek,
    r.currentVolumePercent,
    r.measuredDistanceCm,
    r.temperatureCelsius,
    r.humidityPercent,
    r.fillingRatePerHour,
    r.isPeakHour ? 1 : 0,
    r.isEmptyingEvent ? 1 : 0,
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

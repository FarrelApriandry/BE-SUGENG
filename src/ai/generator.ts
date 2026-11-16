/**
 * SUGENG AI Engine — Synthetic Dataset Generator (Dual-Model)
 * 1. Time-Series Diurnal Telemetry Dataset Generator (Model 1 - Regresi TTO)
 * 2. Multi-Sensor Hazard & Decomposition Dataset Generator (Model 2 - Klasifikasi Bahaya)
 */

import type {
  HazardClass,
  HazardTrainingRecord,
  TelemetryTrainingRecord,
} from "./types";

export interface GeneratorOptions {
  nodeId?: string;
  days?: number;
  intervalMinutes?: number;
  startDate?: Date;
}

// ==============================================================================
// 1. Dataset Regresi Deret Waktu (Model 1 - TTO)
// ==============================================================================

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

  let currentVolume = 12.0;
  const stepHours = intervalMinutes / 60;

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
    const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 1.15 : 1.0;
    const noise = (nextRandom() - 0.5) * 0.4;
    const effectiveRatePerHour = Math.max(0.1, baseRate * weekendMultiplier * (1 + noise));

    let isEmptyingEvent = false;
    const volumeDelta = effectiveRatePerHour * stepHours;
    currentVolume += volumeDelta;

    const emptyingThreshold = 88.0 + nextRandom() * 8.0;
    if (currentVolume >= emptyingThreshold) {
      currentVolume = 2.0 + nextRandom() * 4.0;
      isEmptyingEvent = true;
    }

    currentVolume = Math.min(100.0, Math.max(0.0, currentVolume));

    const emptyDistance = 95.0;
    const fullDistance = 20.0;
    const measuredDistanceCm = emptyDistance - (currentVolume / 100.0) * (emptyDistance - fullDistance);

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

// ==============================================================================
// 2. Dataset Klasifikasi Multi-Sensor Hazard (Model 2)
// ==============================================================================

export function generateSyntheticHazardDataset(sampleCount = 1000): HazardTrainingRecord[] {
  const records: HazardTrainingRecord[] = [];
  let seed = 1337;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const now = Date.now();

  for (let i = 0; i < sampleCount; i++) {
    const timestamp = new Date(now - (sampleCount - i) * 15 * 60 * 1000).toISOString();
    const scenarioRoll = rand();

    let groundTruthClass: HazardClass;
    let isSimulatedScenario: string;
    let volume: number;
    let ammonia: number;
    let methane: number;
    let temp: number;
    let humidity: number;
    let distance: number;

    // Skenario 1: Normal / Sampah Segar (60% distribusi)
    if (scenarioRoll < 0.6) {
      groundTruthClass = "NORMAL";
      isSimulatedScenario = "Normal Household / Non-rotting Waste";
      volume = Number((10 + rand() * 60).toFixed(1));
      ammonia = Number((5 + rand() * 45).toFixed(1)); // < 60
      methane = Number((10 + rand() * 150).toFixed(1)); // < 250
      temp = Number((23 + rand() * 7).toFixed(1)); // 23 - 30 C
      humidity = Number((50 + rand() * 25).toFixed(1)); // 50 - 75%
      distance = Number((95.0 - (volume / 100.0) * 75.0 + (rand() - 0.5) * 2).toFixed(1));
    }
    // Skenario 2: Degradasi Aktif / Bau Amonia (20% distribusi)
    else if (scenarioRoll < 0.8) {
      groundTruthClass = "ACTIVE_DECOMPOSITION";
      isSimulatedScenario = "Organic Market Waste Rapid Fermentation";
      volume = Number((30 + rand() * 55).toFixed(1));
      ammonia = Number((62 + rand() * 35).toFixed(1)); // >= 60 (tinggi)
      methane = Number((40 + rand() * 140).toFixed(1)); // metana normal
      temp = Number((28 + rand() * 8).toFixed(1)); // 28 - 36 C (hangat)
      humidity = Number((68 + rand() * 25).toFixed(1)); // >= 68% (lembab)
      distance = Number((95.0 - (volume / 100.0) * 75.0 + (rand() - 0.5) * 2).toFixed(1));
    }
    // Skenario 3: Bahaya Gas Metana / Rawan Terbakar (15% distribusi)
    else if (scenarioRoll < 0.95) {
      groundTruthClass = "METHANE_HAZARD";
      isSimulatedScenario = "Flammable Methane Gas Buildup Under Sun";
      volume = Number((50 + rand() * 45).toFixed(1));
      ammonia = Number((20 + rand() * 45).toFixed(1));
      methane = Number((260 + rand() * 220).toFixed(1)); // >= 250 ppm (kritis)
      temp = Number((33 + rand() * 10).toFixed(1)); // 33 - 43 C (panas terik)
      humidity = Number((30 + rand() * 32).toFixed(1)); // 30 - 62% (kering)
      distance = Number((95.0 - (volume / 100.0) * 75.0 + (rand() - 0.5) * 2).toFixed(1));
    }
    // Skenario 4: Anomali Fisik / Sensor Malfungsi (5% distribusi)
    else {
      groundTruthClass = "SENSOR_ANOMALY";
      isSimulatedScenario = "Sensor Sticking / Obstruction / Temperature Outlier";
      volume = Number((80 + rand() * 18).toFixed(1));
      ammonia = Number((10 + rand() * 40).toFixed(1));
      methane = Number((10 + rand() * 80).toFixed(1));
      temp = rand() > 0.5 ? 58.5 : 8.2; // outlier suhu ekstrem
      humidity = 12.0; // kelembapan rusak
      // Anomali jarak: volume 85% tapi jarak baca 92 cm (seperti kosong)
      distance = Number((92.0 + (rand() - 0.5) * 3).toFixed(1));
    }

    records.push({
      recordId: `REC-HZ-${String(i + 1).padStart(4, "0")}`,
      timestamp,
      currentVolumePercent: volume,
      ammoniaIndexMQ135: ammonia,
      methanePpmMQ4: methane,
      temperatureCelsius: temp,
      humidityPercent: humidity,
      measuredDistanceCm: distance,
      groundTruthClass,
      isSimulatedScenario,
    });
  }

  return records;
}

export function exportHazardDatasetToCSV(records: HazardTrainingRecord[]): string {
  const headers = [
    "record_id",
    "timestamp",
    "current_volume_percent",
    "ammonia_index_mq135",
    "methane_ppm_mq4",
    "temperature_celsius",
    "humidity_percent",
    "measured_distance_cm",
    "ground_truth_class",
    "scenario_description",
  ];

  const rows = records.map((r) => [
    r.recordId,
    r.timestamp,
    r.currentVolumePercent,
    r.ammoniaIndexMQ135,
    r.methanePpmMQ4,
    r.temperatureCelsius,
    r.humidityPercent,
    r.measuredDistanceCm ?? "",
    r.groundTruthClass,
    `"${r.isSimulatedScenario}"`,
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

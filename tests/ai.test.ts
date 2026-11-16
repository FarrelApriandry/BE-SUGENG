import { describe, expect, it } from "bun:test";
import { classifyMultiSensorHazard } from "../src/ai/classifier";
import {
  calculateClassificationMetrics,
  calculateRegressionMetrics,
} from "../src/ai/evaluation";
import {
  generateSyntheticHazardDataset,
  generateSyntheticTelemetryDataset,
} from "../src/ai/generator";
import { predictTimeRemaining, trainDiurnalModel } from "../src/ai/model";
import { AIPredictionService } from "../src/ai/service";
import type { HazardClass } from "../src/ai/types";
import app from "../src/index";

describe("SUGENG Dual-AI Engine Tests", () => {
  // ==============================================================================
  // 1. Pengujian Model 1: Regresi Deret Waktu Diurnal & TTO
  // ==============================================================================
  describe("Model 1 — Synthetic Dataset & Regression Evaluator", () => {
    it("harus menghasilkan dataset telemetri diurnal yang valid", () => {
      const records = generateSyntheticTelemetryDataset({
        nodeId: "NODE-MGL-05",
        days: 3,
        intervalMinutes: 15,
      });

      expect(records.length).toBeGreaterThan(0);
      const first = records[0];
      expect(first.nodeId).toBe("NODE-MGL-05");
      expect(first.currentVolumePercent).toBeGreaterThanOrEqual(0);
      expect(first.currentVolumePercent).toBeLessThanOrEqual(100);
      expect(first.temperatureCelsius).toBeGreaterThan(15);
      expect(first.temperatureCelsius).toBeLessThan(45);
    });

    it("harus menghitung MAE, RMSE, dan R² secara akurat", () => {
      const yTrue = [10, 20, 30, 40, 50];
      const yPred = [11, 19, 31, 39, 50];

      const metrics = calculateRegressionMetrics(yTrue, yPred);
      expect(metrics.mae).toBeCloseTo(0.8, 1);
      expect(metrics.rmse).toBeGreaterThan(0);
      expect(metrics.r2Score).toBeGreaterThan(0.95);
    });

    it("harus mengembalikan status ALREADY_FULL jika volume >= 98%", () => {
      const res = predictTimeRemaining(99.0, 10);
      expect(res.urgencyLevel).toBe("ALREADY_FULL");
      expect(res.minutesToOverflow).toBe(0);
    });

    it("harus memprediksi waktu penuh lebih cepat saat laju buangan tinggi (Peak Hour)", () => {
      const resFast = predictTimeRemaining(70.0, 8, 15.0);
      const resSlow = predictTimeRemaining(70.0, 23, 0.5);

      expect(resFast.minutesToOverflow).not.toBeNull();
      expect(resSlow.minutesToOverflow).not.toBeNull();
      expect(resFast.minutesToOverflow!).toBeLessThan(resSlow.minutesToOverflow!);
    });

    it("harus menghasilkan kurva proyeksi volume 6 jam ke depan", () => {
      const res = predictTimeRemaining(50.0, 12);
      expect(res.hourlyForecast.length).toBe(6);
      expect(res.hourlyForecast[0].predictedVolumePercent).toBeGreaterThanOrEqual(50.0);
      expect(res.hourlyForecast[5].predictedVolumePercent).toBeGreaterThanOrEqual(
        res.hourlyForecast[0].predictedVolumePercent
      );
    });
  });

  // ==============================================================================
  // 2. Pengujian Model 2: Multi-Sensor Hazard & Decomposition Classifier
  // ==============================================================================
  describe("Model 2 — Multi-Sensor Hazard Classifier", () => {
    it("harus menghasilkan dataset klasifikasi dengan 4 kelas seimbang", () => {
      const dataset = generateSyntheticHazardDataset(100);
      expect(dataset.length).toBe(100);

      const classes = new Set(dataset.map((d) => d.groundTruthClass));
      expect(classes.has("NORMAL")).toBe(true);
      expect(classes.has("ACTIVE_DECOMPOSITION")).toBe(true);
      expect(classes.has("METHANE_HAZARD")).toBe(true);
      expect(classes.has("SENSOR_ANOMALY")).toBe(true);
    });

    it("harus mengklasifikasikan kondisi normal jika emisi gas rendah", () => {
      const res = classifyMultiSensorHazard({
        currentVolumePercent: 30,
        ammoniaIndexMQ135: 15,
        methanePpmMQ4: 30,
        temperatureCelsius: 25,
        humidityPercent: 60,
      });

      expect(res.hazardClass).toBe("NORMAL");
      expect(res.disinfectionRequired).toBe(false);
      expect(res.fireSafetyAlert).toBe(false);
      expect(res.confidenceScore).toBeGreaterThan(0.9);
    });

    it("harus mendeteksi ACTIVE_DECOMPOSITION saat gas amonia (MQ-135) tinggi", () => {
      const res = classifyMultiSensorHazard({
        currentVolumePercent: 45,
        ammoniaIndexMQ135: 78, // amonia tinggi
        methanePpmMQ4: 40,
        temperatureCelsius: 31,
        humidityPercent: 80,
      });

      expect(res.hazardClass).toBe("ACTIVE_DECOMPOSITION");
      expect(res.disinfectionRequired).toBe(true);
      expect(res.fireSafetyAlert).toBe(false);
    });

    it("harus mendeteksi METHANE_HAZARD saat gas metana (MQ-4) kritis pada suhu panas", () => {
      const res = classifyMultiSensorHazard({
        currentVolumePercent: 75,
        ammoniaIndexMQ135: 25,
        methanePpmMQ4: 380, // metana tinggi
        temperatureCelsius: 37,
        humidityPercent: 40,
      });

      expect(res.hazardClass).toBe("METHANE_HAZARD");
      expect(res.fireSafetyAlert).toBe(true);
      expect(res.severityLevel).toBe("CRITICAL");
    });

    it("harus mendeteksi SENSOR_ANOMALY saat terdapat diskrepansi pembacaan jarak fisik", () => {
      const res = classifyMultiSensorHazard({
        currentVolumePercent: 90, // volume 90%
        ammoniaIndexMQ135: 20,
        methanePpmMQ4: 30,
        temperatureCelsius: 28,
        humidityPercent: 60,
        measuredDistanceCm: 93, // diskrepansi: terbaca 93 cm (seolah kosong)
      });

      expect(res.hazardClass).toBe("SENSOR_ANOMALY");
    });

    it("harus menghitung Confusion Matrix dan Akurasi klasifikasi secara presisi", () => {
      const yTrue: HazardClass[] = ["NORMAL", "ACTIVE_DECOMPOSITION", "METHANE_HAZARD", "SENSOR_ANOMALY"];
      const yPred: HazardClass[] = ["NORMAL", "ACTIVE_DECOMPOSITION", "METHANE_HAZARD", "SENSOR_ANOMALY"];

      const metrics = calculateClassificationMetrics(yTrue, yPred);
      expect(metrics.accuracy).toBe(1.0);
      expect(metrics.macroF1Score).toBe(1.0);
      expect(metrics.confusionMatrix.matrix[0][0]).toBe(1);
    });
  });

  // ==============================================================================
  // 3. Pengujian Endpoint REST API Terpadu
  // ==============================================================================
  describe("Integrated AI API Endpoints", () => {
    it("GET /api/prediction/nodes/:nodeId harus mengembalikan data regresi dan hazard sekaligus", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prediction/nodes/NODE-MGL-05")
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.nodeId).toBe("NODE-MGL-05");
      expect(body.data.hourlyForecast).toBeArray();
      expect(body.data.hazardAssessment).toBeDefined();
      expect(body.data.hazardAssessment.hazardClass).toBeDefined();
    });

    it("POST /api/prediction/simulate harus mampu mensimulasikan regresi dan klasifikasi", async () => {
      const payload = {
        currentVolumePercent: 65.5,
        hourOfDay: 9,
        fillingRatePerHour: 12.0,
        ammoniaIndexMQ135: 75.0,
        methanePpmMQ4: 40.0,
        temperatureCelsius: 30.0,
        humidityPercent: 75.0,
      };

      const response = await app.handle(
        new Request("http://localhost/api/prediction/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.hazardAssessment.hazardClass).toBe("ACTIVE_DECOMPOSITION");
    });

    it("GET /api/prediction/hazard/:nodeId harus mengembalikan evaluasi bahaya spesifik", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prediction/hazard/NODE-MGL-05")
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.hazardClass).toBeDefined();
      expect(body.data.sensorAttribution).toBeDefined();
    });

    it("POST /api/prediction/hazard/simulate harus mampu menguji 4 sensor bebas", async () => {
      const payload = {
        currentVolumePercent: 50,
        ammoniaIndexMQ135: 20,
        methanePpmMQ4: 350, // gas metana kritis
        temperatureCelsius: 36,
        humidityPercent: 40,
      };

      const response = await app.handle(
        new Request("http://localhost/api/prediction/hazard/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.hazardClass).toBe("METHANE_HAZARD");
      expect(body.data.fireSafetyAlert).toBe(true);
    });

    it("GET /api/prediction/hazard/metrics harus mengembalikan metrik klasifikasi & confusion matrix", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prediction/hazard/metrics")
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.evaluationMetrics.accuracy).toBeGreaterThan(0.9);
      expect(body.data.evaluationMetrics.macroF1Score).toBeGreaterThan(0.9);
    });
  });
});

import { describe, expect, it } from "bun:test";
import { calculateRegressionMetrics } from "../src/ai/evaluation";
import { generateSyntheticTelemetryDataset } from "../src/ai/generator";
import { predictTimeRemaining, trainDiurnalModel } from "../src/ai/model";
import { AIPredictionService } from "../src/ai/service";
import app from "../src/index";

describe("SUGENG AI Engine Tests", () => {
  describe("Synthetic Dataset Generator", () => {
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
  });

  describe("Academic Metrics Calculator", () => {
    it("harus menghitung MAE, RMSE, dan R² secara akurat", () => {
      const yTrue = [10, 20, 30, 40, 50];
      const yPred = [11, 19, 31, 39, 50]; // error kecil

      const metrics = calculateRegressionMetrics(yTrue, yPred);
      expect(metrics.mae).toBeCloseTo(0.8, 1);
      expect(metrics.rmse).toBeGreaterThan(0);
      expect(metrics.r2Score).toBeGreaterThan(0.95);
    });
  });

  describe("TTO Regressor & Predictive Engine", () => {
    it("harus mengembalikan status ALREADY_FULL jika volume >= 98%", () => {
      const res = predictTimeRemaining(99.0, 10);
      expect(res.urgencyLevel).toBe("ALREADY_FULL");
      expect(res.minutesToOverflow).toBe(0);
    });

    it("harus memprediksi waktu penuh lebih cepat saat laju buangan tinggi (Peak Hour)", () => {
      // 70% volume, jam 08:00 (peak hour pagi), rate tinggi 15%/jam
      const resFast = predictTimeRemaining(70.0, 8, 15.0);
      // 70% volume, jam 23:00 (dini hari), rate rendah 0.5%/jam
      const resSlow = predictTimeRemaining(70.0, 23, 0.5);

      expect(resFast.minutesToOverflow).not.toBeNull();
      expect(resSlow.minutesToOverflow).not.toBeNull();
      // Pagi harus jauh lebih cepat penuh dibanding malam
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

  describe("AI API Endpoints Integration", () => {
    it("GET /api/prediction/nodes/:nodeId harus mengembalikan data prediksi yang valid", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prediction/nodes/NODE-MGL-05")
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.nodeId).toBe("NODE-MGL-05");
      expect(body.data.currentVolumePercent).toBeDefined();
      expect(body.data.hourlyForecast).toBeArray();
      expect(body.data.modelInfo.r2Score).toBeGreaterThan(0.8);
    });

    it("POST /api/prediction/simulate harus mampu mensimulasikan prediksi instan", async () => {
      const payload = {
        currentVolumePercent: 65.5,
        hourOfDay: 9,
        fillingRatePerHour: 12.0,
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
      expect(body.data.currentVolumePercent).toBe(65.5);
      expect(body.data.minutesToOverflow).toBeGreaterThan(0);
      expect(body.data.urgencyLevel).toBeDefined();
    });

    it("GET /api/prediction/metrics harus mengembalikan metrik model R², MAE, RMSE", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prediction/metrics")
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.evaluationMetrics.r2Score).toBeGreaterThan(0.8);
      expect(body.data.evaluationMetrics.mae).toBeDefined();
      expect(body.data.evaluationMetrics.rmse).toBeDefined();
    });
  });
});

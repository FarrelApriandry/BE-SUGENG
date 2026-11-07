import { describe, expect, it } from "bun:test";
import {
  calculateVolumeStatus,
  computeVolumeFromDistance,
  evaluateGasLevels,
  processTelemetryPayload,
} from "../src/utils/thresholds";
import type { TelemetryPayload } from "../src/types/telemetry";

describe("SUGENG Thresholds & Business Logic Engine", () => {
  describe("Volume Thresholds (calculateVolumeStatus)", () => {
    it("harus mengembalikan SAFE untuk persentase volume < 50.0%", () => {
      expect(calculateVolumeStatus(0)).toBe("SAFE");
      expect(calculateVolumeStatus(25.5)).toBe("SAFE");
      expect(calculateVolumeStatus(49.9)).toBe("SAFE");
    });

    it("harus mengembalikan WARNING untuk volume 50.0% hingga 74.9%", () => {
      expect(calculateVolumeStatus(50.0)).toBe("WARNING");
      expect(calculateVolumeStatus(62.4)).toBe("WARNING");
      expect(calculateVolumeStatus(74.9)).toBe("WARNING");
    });

    it("harus mengembalikan CRITICAL untuk volume >= 75.0%", () => {
      expect(calculateVolumeStatus(75.0)).toBe("CRITICAL");
      expect(calculateVolumeStatus(85.2)).toBe("CRITICAL");
      expect(calculateVolumeStatus(100.0)).toBe("CRITICAL");
    });
  });

  describe("Gas Thresholds & Gas Alert (evaluateGasLevels)", () => {
    it("gasAlert harus false jika amonia < 60 dan metana < 250", () => {
      const normal = evaluateGasLevels(25.0, 80.0);
      expect(normal.gasAlert).toBe(false);
      expect(normal.ammoniaLevel).toBe("SAFE");
      expect(normal.methaneLevel).toBe("SAFE");

      const warningGas = evaluateGasLevels(45.0, 180.0);
      expect(warningGas.gasAlert).toBe(false);
      expect(warningGas.ammoniaLevel).toBe("WARNING");
      expect(warningGas.methaneLevel).toBe("WARNING");
    });

    it("gasAlert harus true jika gasPpmMQ135 >= 60.0", () => {
      const criticalAmmonia = evaluateGasLevels(60.0, 80.0);
      expect(criticalAmmonia.gasAlert).toBe(true);
      expect(criticalAmmonia.ammoniaLevel).toBe("CRITICAL");
    });

    it("gasAlert harus true jika methanePpmMQ4 >= 250.0", () => {
      const criticalMethane = evaluateGasLevels(20.0, 250.0);
      expect(criticalMethane.gasAlert).toBe(true);
      expect(criticalMethane.methaneLevel).toBe("CRITICAL");
    });

    it("gasAlert harus true jika kedua gas berada di level kritis", () => {
      const bothCritical = evaluateGasLevels(75.0, 320.0);
      expect(bothCritical.gasAlert).toBe(true);
      expect(bothCritical.ammoniaLevel).toBe("CRITICAL");
      expect(bothCritical.methaneLevel).toBe("CRITICAL");
    });
  });

  describe("Physical Distance to Volume Formula (computeVolumeFromDistance)", () => {
    it("menghitung 0% saat jarak bak kosong (95 cm)", () => {
      expect(computeVolumeFromDistance(95.0)).toBe(0);
    });

    it("menghitung 100% saat bak penuh di zona blind sensor (20 cm)", () => {
      expect(computeVolumeFromDistance(20.0)).toBe(100);
    });

    it("mengembalikan nilai fallback saat sensor membaca -1 (out of range)", () => {
      expect(computeVolumeFromDistance(-1.0, 65.0)).toBe(65.0);
    });
  });

  describe("Process Telemetry Payload (processTelemetryPayload)", () => {
    it("memproses data ESP32 lengkap dan memperkaya status dengan benar", () => {
      const samplePayload: TelemetryPayload = {
        nodeId: "NODE-MGL-05",
        temperatureCelsius: 28.5,
        humidityPercent: 65.0,
        measuredDistanceCm: 42.1,
        currentVolumePercent: 74.5,
        gasPpmMQ135: 36.0,
        methanePpmMQ4: 120.0,
        mq135Adc: 1250,
        mq4Adc: 980,
        mq135Pct: 30.5,
        mq4Pct: 23.9,
        uptimeSec: 1420,
      };

      const result = processTelemetryPayload(samplePayload);

      expect(result.nodeId).toBe("NODE-MGL-05");
      expect(result.currentVolumePercent).toBe(74.5);
      expect(result.volumeStatus).toBe("WARNING");
      expect(result.gasAlert).toBe(false);
      expect(result.ammoniaLevel).toBe("WARNING");
      expect(result.methaneLevel).toBe("WARNING");
      expect(result.calculatedAt).toBeDefined();
    });

    it("menghasilkan volumeStatus CRITICAL jika persentase volume >= 75%", () => {
      const criticalPayload: TelemetryPayload = {
        nodeId: "NODE-MGL-04",
        temperatureCelsius: 30.0,
        humidityPercent: 70.0,
        measuredDistanceCm: 25.0,
        currentVolumePercent: 88.0,
        gasPpmMQ135: 65.0, // Critical
        methanePpmMQ4: 260.0, // Critical
        mq135Adc: 2500,
        mq4Adc: 2400,
        mq135Pct: 61.0,
        mq4Pct: 58.6,
        uptimeSec: 3600,
      };

      const result = processTelemetryPayload(criticalPayload);
      expect(result.volumeStatus).toBe("CRITICAL");
      expect(result.gasAlert).toBe(true);
      expect(result.ammoniaLevel).toBe("CRITICAL");
      expect(result.methaneLevel).toBe("CRITICAL");
    });
  });
});

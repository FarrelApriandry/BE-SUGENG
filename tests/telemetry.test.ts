import { describe, expect, it } from "bun:test";
import { app } from "../src/index";
import { config } from "../src/config/env";

const VALID_TOKEN = config.nodeApiKey;

const VALID_SAMPLE_PAYLOAD = {
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

describe("SUGENG Elysia API Endpoints", () => {
  describe("Root & Health Routes", () => {
    it("GET / harus mengembalikan status 200 dengan info servis", async () => {
      const response = await app.handle(new Request("http://localhost/"));
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.service).toBe("SUGENG Ingestion Middleware API");
      expect(json.status).toBe("ONLINE");
      expect(json.caseStudy).toBe("TPSA Banyuurip, Kota Magelang");
    });

    it("GET /health harus mengembalikan status HEALTHY dan info database", async () => {
      const response = await app.handle(new Request("http://localhost/health"));
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("HEALTHY");
      expect(json.data.database).toBeDefined();
    });
  });

  describe("Telemetry Ingestion (POST /api/telemetry)", () => {
    it("harus menolak request tanpa token node (401 Unauthorized)", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(VALID_SAMPLE_PAYLOAD),
        })
      );

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("UNAUTHORIZED_NODE_TOKEN");
    });

    it("harus menolak request dengan format body tidak valid (400 Bad Request)", async () => {
      const invalidPayload = {
        nodeId: "NODE-MGL-05",
        // temperatureCelsius sengaja dihilangkan
        humidityPercent: "BUKAN_ANGKA",
      };

      const response = await app.handle(
        new Request("http://localhost/api/telemetry", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Node-Token": VALID_TOKEN,
          },
          body: JSON.stringify(invalidPayload),
        })
      );

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Validasi skema gagal");
    });

    it("harus berhasil menerima dan memproses payload ESP32 yang valid (201 Created)", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/telemetry", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Node-Token": VALID_TOKEN,
          },
          body: JSON.stringify(VALID_SAMPLE_PAYLOAD),
        })
      );

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.nodeId).toBe("NODE-MGL-05");
      expect(json.data.volumeStatus).toBe("WARNING");
      expect(json.data.gasAlert).toBe(false);
      expect(json.data.ammoniaLevel).toBe("WARNING");
      expect(json.data.methaneLevel).toBe("WARNING");
    });

    it("harus mendukung autentikasi via header Authorization: Bearer <token>", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/telemetry", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${VALID_TOKEN}`,
          },
          body: JSON.stringify(VALID_SAMPLE_PAYLOAD),
        })
      );

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.success).toBe(true);
    });

    it("harus berhasil memproses batch ingestion telemetri (POST /api/telemetry/batch)", async () => {
      const batchPayload = [
        VALID_SAMPLE_PAYLOAD,
        {
          ...VALID_SAMPLE_PAYLOAD,
          nodeId: "NODE-MGL-01",
          currentVolumePercent: 32.0,
        },
      ];

      const response = await app.handle(
        new Request("http://localhost/api/telemetry/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Node-Token": VALID_TOKEN,
          },
          body: JSON.stringify(batchPayload),
        })
      );

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.count).toBe(2);
    });
  });

  describe("Dashboard & Analytics Routes", () => {
    it("GET /api/telemetry/latest harus mengembalikan data seluruh titik node", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/telemetry/latest")
      );
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
    });

    it("GET /api/telemetry/summary harus mengembalikan ringkasan KPI dashboard", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/telemetry/summary")
      );
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.totalNodes).toBeGreaterThan(0);
      expect(typeof json.data.safeNodes).toBe("number");
      expect(typeof json.data.warningNodes).toBe("number");
      expect(typeof json.data.criticalNodes).toBe("number");
      expect(typeof json.data.activeGasAlerts).toBe("number");
    });

    it("GET /api/telemetry/:nodeId/history harus mengembalikan riwayat time-series", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/telemetry/NODE-MGL-05/history?limit=10")
      );
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.nodeId).toBe("NODE-MGL-05");
      expect(Array.isArray(json.data.history)).toBe(true);
    });
  });

  describe("GIS & TPS Nodes Routes", () => {
    it("GET /api/nodes harus mengembalikan daftar node TPS Kota Magelang", async () => {
      const response = await app.handle(new Request("http://localhost/api/nodes"));
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      const banyuurip = json.data.find(
        (n: { nodeId: string }) => n.nodeId === "NODE-MGL-05"
      );
      expect(banyuurip).toBeDefined();
      expect(banyuurip.name).toContain("Banyuurip");
    });

    it("GET /api/nodes/geojson harus mengembalikan GeoJSON FeatureCollection yang valid untuk Leaflet", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/nodes/geojson")
      );
      expect(response.status).toBe(200);

      const geojson = await response.json();
      expect(geojson.type).toBe("FeatureCollection");
      expect(Array.isArray(geojson.features)).toBe(true);

      const firstFeature = geojson.features[0];
      expect(firstFeature.type).toBe("Feature");
      expect(firstFeature.geometry.type).toBe("Point");
      expect(firstFeature.geometry.coordinates.length).toBe(2);
      expect(firstFeature.properties.nodeId).toBeDefined();
    });

    it("GET /api/nodes/:nodeId harus mengembalikan detail spesifik node", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/nodes/NODE-MGL-05")
      );
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.nodeId).toBe("NODE-MGL-05");
    });

    it("GET /api/nodes/:nodeId harus mengembalikan 404 jika node tidak ditemukan", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/nodes/NODE-INVALID-99")
      );
      expect(response.status).toBe(404);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("tidak ditemukan");
    });

    it("POST /api/nodes harus mampu mendaftarkan titik TPS baru", async () => {
      const newNode = {
        nodeId: "NODE-MGL-TEST",
        name: "TPS Uji Coba Alun-Alun",
        address: "Alun-Alun Kota Magelang",
        latitude: -7.4795,
        longitude: 110.2177,
        capacityLiters: 120.0,
      };

      const response = await app.handle(
        new Request("http://localhost/api/nodes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newNode),
        })
      );

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.nodeId).toBe("NODE-MGL-TEST");
    });
  });
});

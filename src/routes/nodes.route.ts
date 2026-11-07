import { Elysia, t } from "elysia";
import { TPSNodeCreateSchema } from "../schemas/telemetry.schema";
import { TelemetryService } from "../services/telemetry.service";

export const nodesRoutes = new Elysia({ prefix: "/api/nodes" })
  /**
   * 1. Ambil seluruh data titik lokasi TPS terdaftar
   */
  .get(
    "/",
    async () => {
      const nodes = await TelemetryService.getAllNodes();
      return {
        success: true,
        data: nodes,
        code: 200,
        timestamp: new Date().toISOString(),
      };
    },
    {
      detail: {
        tags: ["TPS Nodes (GIS)"],
        summary: "Mengambil seluruh titik TPS terdaftar di Kota Magelang",
      },
    }
  )

  /**
   * 2. Format GeoJSON untuk integrasi langsung dengan Leaflet.js Web SIG
   */
  .get(
    "/geojson",
    async () => {
      const nodes = await TelemetryService.getAllNodes();
      const features = nodes.map((node) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [node.longitude, node.latitude],
        },
        properties: {
          nodeId: node.nodeId,
          name: node.name,
          address: node.address,
          capacityLiters: node.capacityLiters,
          volumeStatus: node.volumeStatus || "SAFE",
          lastVolumePercent: node.lastVolumePercent || 0,
          lastGasAlert: node.lastGasAlert || false,
          lastTemperature: node.lastTemperature,
          lastHumidity: node.lastHumidity,
          lastUpdated: node.lastUpdated,
        },
      }));

      return {
        type: "FeatureCollection",
        features,
      };
    },
    {
      detail: {
        tags: ["TPS Nodes (GIS)"],
        summary: "Format GeoJSON FeatureCollection untuk peta interaktif Leaflet.js",
      },
    }
  )

  /**
   * 3. Ambil detail titik TPS berdasarkan nodeId
   */
  .get(
    "/:nodeId",
    async ({ params, set }) => {
      const node = await TelemetryService.getNodeById(params.nodeId);
      if (!node) {
        set.status = 404;
        return {
          success: false,
          error: `Node TPS dengan ID '${params.nodeId}' tidak ditemukan.`,
          code: 404,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: node,
        code: 200,
        timestamp: new Date().toISOString(),
      };
    },
    {
      params: t.Object({
        nodeId: t.String(),
      }),
      detail: {
        tags: ["TPS Nodes (GIS)"],
        summary: "Mengambil detail informasi spesifik satu titik TPS",
      },
    }
  )

  /**
   * 4. Registrasi atau perbarui titik TPS baru
   */
  .post(
    "/",
    async ({ body, set }) => {
      const savedNode = await TelemetryService.upsertNode(body);
      set.status = 201;

      return {
        success: true,
        message: "Titik TPS berhasil disimpan.",
        data: savedNode,
        code: 201,
        timestamp: new Date().toISOString(),
      };
    },
    {
      body: TPSNodeCreateSchema,
      detail: {
        tags: ["TPS Nodes (GIS)"],
        summary: "Registrasi atau perbarui data spasial & kapasitas titik TPS",
      },
    }
  );

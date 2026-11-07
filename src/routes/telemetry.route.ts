import { Elysia, t } from "elysia";
import { nodeAuthMiddleware } from "../middleware/auth";
import { TelemetryPayloadSchema, TelemetryQuerySchema } from "../schemas/telemetry.schema";
import { TelemetryService } from "../services/telemetry.service";
import type { TelemetryPayload } from "../types/telemetry";

export const telemetryRoutes = new Elysia({ prefix: "/api/telemetry" })
  .use(nodeAuthMiddleware)

  /**
   * 1. Ingestion Endpoint untuk ESP32 Hardware
   * Menerima telemetri JSON, memvalidasi TypeBox, menghitung ambang batas status,
   * dan menyimpannya ke Supabase (PostgreSQL).
   */
  .post(
    "/",
    async ({ body, set }) => {
      const result = await TelemetryService.ingestTelemetry(body as TelemetryPayload);

      set.status = 201;
      return {
        success: true,
        message: "Data telemetri berhasil divalidasi dan disimpan.",
        data: result,
        code: 201,
        timestamp: new Date().toISOString(),
      };
    },
    {
      requireNodeAuth: true,
      body: TelemetryPayloadSchema,
      detail: {
        tags: ["Telemetry Ingestion"],
        summary: "Ingest telemetri sensor dari node ESP32 DevKit V1",
        description:
          "Memvalidasi payload sensor (JSN-SR04T, DHT22, MQ-135, MQ-4), menghitung status volume (SAFE/WARNING/CRITICAL) dan gas alert, lalu menyimpannya ke Supabase.",
      },
    }
  )

  /**
   * 2. Ingestion Batch (Sinkronisasi Data Multi-rekaman)
   */
  .post(
    "/batch",
    async ({ body, set }) => {
      const results = [];
      for (const item of body) {
        const processed = await TelemetryService.ingestTelemetry(item as TelemetryPayload);
        results.push(processed);
      }

      set.status = 201;
      return {
        success: true,
        message: `Berhasil memproses ${results.length} rekaman telemetri.`,
        data: {
          count: results.length,
          items: results,
        },
        code: 201,
        timestamp: new Date().toISOString(),
      };
    },
    {
      requireNodeAuth: true,
      body: t.Array(TelemetryPayloadSchema),
      detail: {
        tags: ["Telemetry Ingestion"],
        summary: "Ingest batch sekumpulan data telemetri (misal: replay serial bridge)",
      },
    }
  )

  /**
   * 3. Ambil data telemetri terkini seluruh node (untuk Web Dashboard SIG & Peta)
   */
  .get(
    "/latest",
    async () => {
      const data = await TelemetryService.getLatestTelemetry();
      return {
        success: true,
        data,
        code: 200,
        timestamp: new Date().toISOString(),
      };
    },
    {
      detail: {
        tags: ["Dashboard Telemetry"],
        summary: "Mengambil status & pembacaan telemetri terakhir dari seluruh node TPS",
      },
    }
  )

  /**
   * 4. Ringkasan Metrik Dashboard (KPI Status TPS & Peringatan Gas)
   */
  .get(
    "/summary",
    async () => {
      const summary = await TelemetryService.getDashboardSummary();
      return {
        success: true,
        data: summary,
        code: 200,
        timestamp: new Date().toISOString(),
      };
    },
    {
      detail: {
        tags: ["Dashboard Telemetry"],
        summary: "Ringkasan metrik status TPS (Safe, Warning, Critical) dan Peringatan Gas",
      },
    }
  )

  /**
   * 5. Ambil data riwayat time-series suatu node
   */
  .get(
    "/:nodeId/history",
    async ({ params, query }) => {
      const limit = query?.limit ? Number(query.limit) : 50;
      const history = await TelemetryService.getNodeHistory(params.nodeId, limit);

      return {
        success: true,
        data: {
          nodeId: params.nodeId,
          count: history.length,
          history,
        },
        code: 200,
        timestamp: new Date().toISOString(),
      };
    },
    {
      params: t.Object({
        nodeId: t.String(),
      }),
      query: TelemetryQuerySchema,
      detail: {
        tags: ["Dashboard Telemetry"],
        summary: "Mengambil riwayat data time-series sensor per node untuk grafik tren",
      },
    }
  );

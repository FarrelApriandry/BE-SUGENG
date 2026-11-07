import { Elysia } from "elysia";
import { config } from "../config/env";
import { isSupabaseConnected } from "../db/supabase";

const serverStartTime = Date.now();

export const healthRoutes = new Elysia({ prefix: "/health" })
  .get("/", () => {
    const uptimeSec = Math.floor((Date.now() - serverStartTime) / 1000);
    const supabaseReady = isSupabaseConnected();

    return {
      success: true,
      data: {
        service: "BE-SUGENG Middleware Ingestion API",
        status: "HEALTHY",
        uptimeSec,
        environment: config.nodeEnv,
        database: {
          configured: supabaseReady,
          provider: "Supabase (PostgreSQL + PostGIS)",
        },
        systemContext: "SUGENG — Kota Magelang (Studi Kasus TPSA Banyuurip)",
        version: "1.0.50",
      },
      code: 200,
      timestamp: new Date().toISOString(),
    };
  }, {
    detail: {
      tags: ["Health Check"],
      summary: "Memeriksa status kesehatan server dan konektivitas database",
    },
  });

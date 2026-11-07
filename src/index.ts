import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { config } from "./config/env";
import { errorHandlerMiddleware } from "./middleware/error";
import { healthRoutes } from "./routes/health.route";
import { nodesRoutes } from "./routes/nodes.route";
import { telemetryRoutes } from "./routes/telemetry.route";

/**
 * SUGENG API Gateway & Ingestion Middleware
 * Kota Magelang — Studi Kasus TPSA Banyuurip
 */
export const app = new Elysia()
  // Global Middlewares
  .use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Node-Token"],
    })
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "SUGENG API Documentation",
          version: "1.0.50",
          description:
            "Dokumentasi API Middleware Ingestion Telemetri IoT & Manajemen Spasial TPS Kota Magelang (Studi Kasus: TPSA Banyuurip)",
          contact: {
            name: "Tim Pengembang SUGENG (Universitas Tidar)",
            email: "support@sugeng.magelangkota.go.id",
          },
        },
        tags: [
          { name: "Telemetry Ingestion", description: "Endpoint ingestion data sensor dari ESP32" },
          { name: "Dashboard Telemetry", description: "Endpoint telemetri untuk Web Dashboard SIG & Monitoring" },
          { name: "TPS Nodes (GIS)", description: "Endpoint geospasial titik TPS Kota Magelang" },
          { name: "Health Check", description: "Status kesehatan sistem dan koneksi database" },
        ],
      },
      path: "/swagger",
    })
  )
  .use(errorHandlerMiddleware)

  // API Routes
  .get("/", () => ({
    service: "SUGENG Ingestion Middleware API",
    status: "ONLINE",
    version: "1.0.50",
    caseStudy: "TPSA Banyuurip, Kota Magelang",
    documentation: "/swagger",
    healthCheck: "/health",
    timestamp: new Date().toISOString(),
  }))
  .use(healthRoutes)
  .use(telemetryRoutes)
  .use(nodesRoutes);

// Jalankan listener jika dieksekusi secara langsung via CLI (Bun)
if (import.meta.main) {
  app.listen(config.port);
  console.log(
    `🦊 [SUGENG] Server Elysia berjalan pada http://localhost:${config.port}`
  );
  console.log(
    `📖 [SUGENG] Dokumentasi Swagger aktif di http://localhost:${config.port}/swagger`
  );
}

// Export default untuk Vercel Serverless Function & testing
export default app;

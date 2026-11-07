/**
 * Konfigurasi Lingkungan (Environment Variables) Sistem SUGENG
 */

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  nodeApiKey: process.env.NODE_API_KEY || "sugeng-secret-token-mgl-2026",
  cartoKey: process.env.PUBLIC_CARTO_KEY || "",

  // Supabase Configuration (Mendukung alias nama proyek & standar Supabase)
  supabaseUrl:
    process.env.SUPABASE_PROJECT_URL ||
    process.env.SUPABASE_URL ||
    "",
  supabaseServiceRoleKey:
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "",
  supabaseAnonKey:
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "",

  // Konstanta Fisik Bak Sampah Standar SUGENG 120L
  binConstants: {
    totalHeightCm: 95.0,
    blindDistanceCm: 20.0,
  },
} as const;

export const isDev = config.nodeEnv === "development";
export const isProd = config.nodeEnv === "production";
export const isTest = config.nodeEnv === "test";

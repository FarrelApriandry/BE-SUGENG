import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config/env";

let supabaseClient: SupabaseClient | null = null;

/**
 * Inisialisasi Supabase Client menggunakan Service Role Key
 * (Memberikan hak akses penuh untuk penulisan data telemetri di serverless middleware)
 */
export function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    console.warn(
      "⚠️ [SUPABASE] Variabel SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi. Mode offline / in-memory aktif."
    );
    return null;
  }

  try {
    supabaseClient = createClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
    return supabaseClient;
  } catch (error) {
    console.error("❌ [SUPABASE] Gagal inisialisasi Supabase client:", error);
    return null;
  }
}

export const isSupabaseConnected = (): boolean => {
  return !!config.supabaseUrl && !!config.supabaseServiceRoleKey;
};

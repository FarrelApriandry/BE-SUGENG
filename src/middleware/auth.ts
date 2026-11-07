import { Elysia } from "elysia";
import { config, isDev } from "../config/env";

/**
 * Validasi token node ESP32 dari request headers
 */
export function verifyNodeAuth(headers: Record<string, string | undefined>): boolean {
  if (!config.nodeApiKey) {
    if (isDev) {
      console.warn("⚠️ [AUTH] NODE_API_KEY tidak dikonfigurasi. Request diizinkan (Dev Mode).");
      return true;
    }
    return false;
  }

  const tokenHeader = headers["x-node-token"] || headers["X-Node-Token"];
  if (tokenHeader && tokenHeader === config.nodeApiKey) {
    return true;
  }

  const authHeader = headers["authorization"] || headers["Authorization"];
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0]?.toLowerCase() === "bearer") {
      if (parts[1] === config.nodeApiKey) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Elysia Macro Plugin untuk proteksi endpoint via `requireNodeAuth: true`
 */
export const nodeAuthMiddleware = new Elysia({ name: "node-auth" })
  .macro({
    requireNodeAuth(enabled: boolean) {
      if (!enabled) return;
      return {
        beforeHandle({ headers, set }) {
          const isAuthorized = verifyNodeAuth(headers as Record<string, string | undefined>);
          if (!isAuthorized) {
            set.status = 401;
            return {
              success: false,
              error: "UNAUTHORIZED_NODE_TOKEN: Token node tidak valid atau tidak disertakan.",
              code: 401,
              timestamp: new Date().toISOString(),
            };
          }
        },
      };
    },
  });

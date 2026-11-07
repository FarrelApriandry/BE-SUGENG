import { Elysia } from "elysia";

/**
 * Global Error Handler Middleware untuk format respons standar
 * Format: { "success": false, "error": "Reason", "code": 400 | 401 | 404 | 500, "timestamp": string }
 */
export const errorHandlerMiddleware = new Elysia({ name: "error-handler" })
  .onError({ as: "global" }, ({ code, error, set }) => {
    let statusCode = 500;
    const rawMessage =
      error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : "Terjadi kesalahan internal pada server";

    let errorMessage = rawMessage;

    if (code === "VALIDATION") {
      statusCode = 400;
      errorMessage = `Validasi skema gagal: ${rawMessage}`;
    } else if (code === "NOT_FOUND") {
      statusCode = 404;
      errorMessage = "Endpoint tidak ditemukan";
    } else if (rawMessage.includes("UNAUTHORIZED")) {
      statusCode = 401;
      errorMessage = rawMessage;
    } else {
      if (error && typeof error === "object" && "status" in error && typeof error.status === "number") {
        statusCode = error.status;
      }
    }

    set.status = statusCode;

    return {
      success: false,
      error: errorMessage,
      code: statusCode,
      timestamp: new Date().toISOString(),
    };
  });

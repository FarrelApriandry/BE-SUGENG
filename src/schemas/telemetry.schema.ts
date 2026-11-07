import { t } from "elysia";

/**
 * Validasi Skema Payload JSON ESP32 SUGENG
 */
export const TelemetryPayloadSchema = t.Object({
  nodeId: t.String({
    minLength: 1,
    description: "ID Node ESP32, contoh: NODE-MGL-05",
    examples: ["NODE-MGL-05"],
  }),
  temperatureCelsius: t.Number({
    description: "Suhu dari sensor DHT22 dalam derajat Celcius",
    examples: [28.5],
  }),
  humidityPercent: t.Number({
    minimum: 0,
    maximum: 100,
    description: "Kelembapan relatif dari sensor DHT22 (%)",
    examples: [65.0],
  }),
  measuredDistanceCm: t.Number({
    description: "Jarak pantulan ultrasonik JSN-SR04T ke permukaan sampah (cm)",
    examples: [42.1],
  }),
  currentVolumePercent: t.Number({
    minimum: 0,
    maximum: 100,
    description: "Persentase keterisian bak sampah (0 - 100%)",
    examples: [74.5],
  }),
  gasPpmMQ135: t.Number({
    minimum: 0,
    description: "Konsentrasi gas Amonia/Bau dalam PPM",
    examples: [36.0],
  }),
  methanePpmMQ4: t.Number({
    minimum: 0,
    description: "Konsentrasi gas Metana dalam PPM",
    examples: [120.0],
  }),
  mq135Adc: t.Integer({
    minimum: 0,
    maximum: 4095,
    description: "Nilai mentah ADC 12-bit sensor MQ-135",
    examples: [1250],
  }),
  mq4Adc: t.Integer({
    minimum: 0,
    maximum: 4095,
    description: "Nilai mentah ADC 12-bit sensor MQ-4",
    examples: [980],
  }),
  mq135Pct: t.Number({
    minimum: 0,
    maximum: 100,
    description: "Rasio persentase ADC MQ-135 (%)",
    examples: [30.5],
  }),
  mq4Pct: t.Number({
    minimum: 0,
    maximum: 100,
    description: "Rasio persentase ADC MQ-4 (%)",
    examples: [23.9],
  }),
  uptimeSec: t.Integer({
    minimum: 0,
    description: "Waktu aktif perangkat mikrokontroler sejak boot (detik)",
    examples: [1420],
  }),
});

/**
 * Filter Query String untuk Histori Telemetri
 */
export const TelemetryQuerySchema = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 500, default: 50 })),
  startDate: t.Optional(t.String()),
  endDate: t.Optional(t.String()),
});

/**
 * Skema Registrasi / Update Titik Lokasi TPS
 */
export const TPSNodeCreateSchema = t.Object({
  nodeId: t.String({ minLength: 1, examples: ["NODE-MGL-01"] }),
  name: t.String({ minLength: 1, examples: ["TPS Pasar Rejowinangun"] }),
  address: t.String({ examples: ["Jl. Mataram No. 1, Rejowinangun, Magelang"] }),
  latitude: t.Number({ minimum: -90, maximum: 90, examples: [-7.4812] }),
  longitude: t.Number({ minimum: -180, maximum: 180, examples: [110.2189] }),
  capacityLiters: t.Optional(t.Number({ default: 120.0, examples: [120.0] })),
});

/**
 * Skema Header Autentikasi Ingestion
 */
export const IngestionHeaderSchema = t.Object({
  "x-node-token": t.Optional(t.String()),
  authorization: t.Optional(t.String()),
});

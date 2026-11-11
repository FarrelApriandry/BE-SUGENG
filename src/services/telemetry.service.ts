import { getSupabase } from "../db/supabase";
import type { ProcessedTelemetry, TelemetryPayload, TPSNode } from "../types/telemetry";
import { processTelemetryPayload } from "../utils/thresholds";

// In-Memory cache cadangan untuk serverless fallback & pengujian lokal
const memoryTelemetryLogs: ProcessedTelemetry[] = [];
const memoryNodes: Map<string, TPSNode> = new Map([
  [
    "NODE-MGL-01",
    {
      nodeId: "NODE-MGL-01",
      name: "TPS Pasar Rejowinangun",
      address: "Jl. Mataram, Rejowinangun Selatan, Magelang Selatan",
      latitude: -7.48512,
      longitude: 110.2195,
      capacityLiters: 120.0,
      volumeStatus: "SAFE",
      lastVolumePercent: 35.0,
      lastGasAlert: false,
      lastTemperature: 27.5,
      lastHumidity: 68.0,
      lastUpdated: new Date().toISOString(),
    },
  ],
  [
    "NODE-MGL-02",
    {
      nodeId: "NODE-MGL-02",
      name: "TPS Potrobangsan",
      address: "Jl. Pahlawan, Potrobangsan, Magelang Utara",
      latitude: -7.4623,
      longitude: 110.2218,
      capacityLiters: 120.0,
      volumeStatus: "WARNING",
      lastVolumePercent: 62.0,
      lastGasAlert: false,
      lastTemperature: 29.0,
      lastHumidity: 62.0,
      lastUpdated: new Date().toISOString(),
    },
  ],
  [
    "NODE-MGL-03",
    {
      nodeId: "NODE-MGL-03",
      name: "TPS Cacaban",
      address: "Jl. Sigaluh, Cacaban, Magelang Tengah",
      latitude: -7.4764,
      longitude: 110.2141,
      capacityLiters: 120.0,
      volumeStatus: "SAFE",
      lastVolumePercent: 28.5,
      lastGasAlert: false,
      lastTemperature: 28.0,
      lastHumidity: 65.0,
      lastUpdated: new Date().toISOString(),
    },
  ],
  [
    "NODE-MGL-04",
    {
      nodeId: "NODE-MGL-04",
      name: "TPS Tidar Selatan",
      address: "Jl. Sudirman, Tidar Selatan, Magelang Selatan",
      latitude: -7.495,
      longitude: 110.225,
      capacityLiters: 120.0,
      volumeStatus: "CRITICAL",
      lastVolumePercent: 82.0,
      lastGasAlert: true,
      lastTemperature: 31.2,
      lastHumidity: 70.0,
      lastUpdated: new Date().toISOString(),
    },
  ],
  [
    "NODE-MGL-05",
    {
      nodeId: "NODE-MGL-05",
      name: "TPS Kampus Tuguran UNTIDAR",
      address: "Jl. Kapten Suparman No.39, Tuguran, Magelang Utara",
      latitude: -7.4642,
      longitude: 110.2291,
      capacityLiters: 120.0,
      volumeStatus: "SAFE",
      lastVolumePercent: 45.0,
      lastGasAlert: false,
      lastTemperature: 28.5,
      lastHumidity: 65.0,
      lastUpdated: new Date().toISOString(),
    },
  ],
]);

export class TelemetryService {
  /**
   * Memproses dan menyimpan data telemetri yang masuk dari ESP32
   */
  public static async ingestTelemetry(
    payload: TelemetryPayload
  ): Promise<ProcessedTelemetry> {
    // Ambil cache volume sebelumnya untuk fallback jika sensor jarak membaca error (-1)
    const existingNode = memoryNodes.get(payload.nodeId);
    const fallbackVol = existingNode?.lastVolumePercent;

    const processed = processTelemetryPayload(payload, fallbackVol);

    // Simpan ke in-memory cache
    memoryTelemetryLogs.unshift(processed);
    if (memoryTelemetryLogs.length > 500) {
      memoryTelemetryLogs.pop(); // Batasi ukuran buffer
    }

    // Perbarui state node di memori
    const currentTimestamp = new Date().toISOString();
    const updatedNodeData: TPSNode = {
      nodeId: payload.nodeId,
      name: existingNode?.name || `Node ${payload.nodeId}`,
      address: existingNode?.address || "Kota Magelang",
      latitude: existingNode?.latitude || -7.4735,
      longitude: existingNode?.longitude || 110.2452,
      capacityLiters: existingNode?.capacityLiters || 120.0,
      volumeStatus: processed.volumeStatus,
      lastVolumePercent: processed.currentVolumePercent,
      lastGasAlert: processed.gasAlert,
      lastTemperature: processed.temperatureCelsius,
      lastHumidity: processed.humidityPercent,
      lastUpdated: currentTimestamp,
    };
    memoryNodes.set(payload.nodeId, updatedNodeData);

    // Persistensi ke Supabase jika client aktif
    const supabase = getSupabase();
    if (supabase) {
      try {
        // 1. Simpan rekaman time-series ke telemetry_logs
        const { error: logError } = await supabase
          .from("telemetry_logs")
          .insert({
            node_id: payload.nodeId,
            temperature_celsius: payload.temperatureCelsius,
            humidity_percent: payload.humidityPercent,
            measured_distance_cm: payload.measuredDistanceCm,
            current_volume_percent: processed.currentVolumePercent,
            gas_ppm_mq135: payload.gasPpmMQ135,
            methane_ppm_mq4: payload.methanePpmMQ4,
            mq135_adc: payload.mq135Adc,
            mq4_adc: payload.mq4Adc,
            mq135_pct: payload.mq135Pct,
            mq4_pct: payload.mq4Pct,
            uptime_sec: payload.uptimeSec,
            volume_status: processed.volumeStatus,
            gas_alert: processed.gasAlert,
            ammonia_level: processed.ammoniaLevel,
            methane_level: processed.methaneLevel,
          });

        if (logError) {
          console.error("⚠️ [SUPABASE] Error insert telemetry_logs:", logError.message);
        }

        // 2. Perbarui ringkasan titik di tps_nodes
        const { error: nodeError } = await supabase
          .from("tps_nodes")
          .upsert(
            {
              node_id: payload.nodeId,
              name: updatedNodeData.name,
              address: updatedNodeData.address,
              latitude: updatedNodeData.latitude,
              longitude: updatedNodeData.longitude,
              capacity_liters: updatedNodeData.capacityLiters,
              volume_status: processed.volumeStatus,
              last_volume_percent: processed.currentVolumePercent,
              last_gas_alert: processed.gasAlert,
              last_temperature: payload.temperatureCelsius,
              last_humidity: payload.humidityPercent,
              last_ammonia_ppm: payload.gasPpmMQ135,
              last_methane_ppm: payload.methanePpmMQ4,
              updated_at: currentTimestamp,
            },
            { onConflict: "node_id" }
          );

        if (nodeError) {
          console.error("⚠️ [SUPABASE] Error upsert tps_nodes:", nodeError.message);
        }
      } catch (err) {
        console.error("❌ [SUPABASE] Eksepsi saat persistensi telemetri:", err);
      }
    }

    return processed;
  }

  /**
   * Mengambil data pembacaan sensor terkini untuk setiap node (untuk Web Dashboard SIG)
   */
  public static async getLatestTelemetry(): Promise<TPSNode[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("tps_nodes")
          .select("*")
          .order("node_id", { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((item) => ({
            nodeId: item.node_id,
            name: item.name,
            address: item.address,
            latitude: item.latitude,
            longitude: item.longitude,
            capacityLiters: item.capacity_liters,
            volumeStatus: item.volume_status,
            lastVolumePercent: item.last_volume_percent,
            lastGasAlert: item.last_gas_alert,
            lastTemperature: item.last_temperature,
            lastHumidity: item.last_humidity,
            lastUpdated: item.updated_at,
          }));
        }
      } catch (err) {
        console.warn("⚠️ [SUPABASE] Gagal mengambil latest telemetry, fallback ke memory:", err);
      }
    }

    return Array.from(memoryNodes.values());
  }

  /**
   * Mengambil riwayat data telemetri per node (untuk grafik time-series)
   */
  public static async getNodeHistory(
    nodeId: string,
    limit: number = 50
  ): Promise<any[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("telemetry_logs")
          .select("*")
          .eq("node_id", nodeId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn("⚠️ [SUPABASE] Gagal mengambil history, fallback ke memory:", err);
      }
    }

    return memoryTelemetryLogs
      .filter((log) => log.nodeId === nodeId)
      .slice(0, limit);
  }

  /**
   * Mengambil ringkasan metrik dashboard (Total TPS, Safe, Warning, Critical, Peringatan Gas)
   */
  public static async getDashboardSummary() {
    const nodes = await this.getLatestTelemetry();

    const totalNodes = nodes.length;
    let safeCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    let gasAlertCount = 0;

    for (const node of nodes) {
      if (node.volumeStatus === "CRITICAL") criticalCount++;
      else if (node.volumeStatus === "WARNING") warningCount++;
      else safeCount++;

      if (node.lastGasAlert) gasAlertCount++;
    }

    return {
      totalNodes,
      safeNodes: safeCount,
      warningNodes: warningCount,
      criticalNodes: criticalCount,
      activeGasAlerts: gasAlertCount,
      criticalTpsList: nodes
        .filter((n) => n.volumeStatus === "CRITICAL")
        .map((n) => ({
          nodeId: n.nodeId,
          name: n.name,
          volumePercent: n.lastVolumePercent,
          gasAlert: n.lastGasAlert,
        })),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mengambil semua titik TPS terdaftar
   */
  public static async getAllNodes(): Promise<TPSNode[]> {
    return this.getLatestTelemetry();
  }

  /**
   * Mengambil detail satu titik TPS berdasarkan nodeId
   */
  public static async getNodeById(nodeId: string): Promise<TPSNode | null> {
    const nodes = await this.getLatestTelemetry();
    return nodes.find((n) => n.nodeId === nodeId) || null;
  }

  /**
   * Mendaftarkan atau memperbarui titik TPS baru
   */
  public static async upsertNode(nodeData: Partial<TPSNode> & { nodeId: string; name: string }): Promise<TPSNode> {
    const existing = memoryNodes.get(nodeData.nodeId);
    const updated: TPSNode = {
      nodeId: nodeData.nodeId,
      name: nodeData.name,
      address: nodeData.address || existing?.address || "Kota Magelang",
      latitude: nodeData.latitude ?? existing?.latitude ?? -7.4735,
      longitude: nodeData.longitude ?? existing?.longitude ?? 110.2452,
      capacityLiters: nodeData.capacityLiters ?? existing?.capacityLiters ?? 120.0,
      volumeStatus: existing?.volumeStatus || "SAFE",
      lastVolumePercent: existing?.lastVolumePercent || 0,
      lastGasAlert: existing?.lastGasAlert || false,
      lastUpdated: new Date().toISOString(),
    };

    memoryNodes.set(nodeData.nodeId, updated);

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("tps_nodes").upsert({
          node_id: updated.nodeId,
          name: updated.name,
          address: updated.address,
          latitude: updated.latitude,
          longitude: updated.longitude,
          capacity_liters: updated.capacityLiters,
          updated_at: updated.lastUpdated,
        }, { onConflict: "node_id" });
      } catch (err) {
        console.error("⚠️ [SUPABASE] Gagal upsert node ke DB:", err);
      }
    }

    return updated;
  }
}

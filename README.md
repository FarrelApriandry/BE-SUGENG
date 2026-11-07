# 🗑️ BE-SUGENG — Ingestion Gateway & Serverless Middleware
> **Sistem Unggulan Pengelolaan & Monitoring Sampah Kota Magelang (Studi Kasus: TPSA Banyuurip)**  
> Dibangun dengan **Elysia.js**, **Bun**, **TypeScript**, dan **Supabase (PostgreSQL + PostGIS)**.

---

## 📌 Deskripsi Arsitektur
Repositori ini merupakan middleware layer dari ekosistem **SUGENG** yang bertindak sebagai gateway penerima telemetri IoT dari node **ESP32 DevKit V1** (JSN-SR04T, DHT22, MQ-135, MQ-4).
Middleware ini memvalidasi skema payload, mengevaluasi ambang batas status keterisian bak dan konsentrasi gas berbahaya, menyimpannya ke database **Supabase PostGIS**, serta menyajikan data spasial dan time-series untuk Web Dashboard SIG dan optimizer Google OR-Tools CVRP.

---

## 🚀 Fitur Utama
1. **Strict Type Safety:** Validasi schema TypeBox Elysia (`t.Object`, `t.Number`, dll.) untuk setiap payload masuk.
2. **Ambang Batas & Status Cerdas:**
   - **Status Volume:**
     - `SAFE` (< 50.0%)
     - `WARNING` (50.0% - 74.9%)
     - `CRITICAL / PRIORITY` (>= 75.0%)
   - **Peringatan Gas (Gas Alert):** `true` jika $NH_3 \ge 60\text{ ppm}$ atau $CH_4 \ge 250\text{ ppm}$.
   - **Fallback Sensor:** Mengunci volume terakhir jika sensor jarak membaca `-1` (*out of range*).
3. **Persistensi Supabase PostGIS:**
   - Tabel `tps_nodes`: Metadata titik TPS, status terkini, dan koordinat spasial `geometry(Point, 4326)`.
   - Tabel `telemetry_logs`: Time-series telemetri lengkap.
4. **Endpoint Khusus Dashboard Web SIG:**
   - Format `GeoJSON FeatureCollection` untuk rendering langsung di Leaflet.js (`GET /api/nodes/geojson`).
   - Riwayat time-series per node (`GET /api/telemetry/:nodeId/history`).
   - Ringkasan KPI operasional (`GET /api/telemetry/summary`).
5. **Keamanan & Kompatibilitas Serverless:**
   - Proteksi header `X-Node-Token` atau `Authorization: Bearer <TOKEN>`.
   - Siap dideploy ke Vercel Serverless Function (`export default app` & `vercel.json`).
   - Dokumentasi Swagger/OpenAPI interaktif di `/swagger`.

---

## 🛠️ Instalasi & Menjalankan Lokal

### 1. Prasyarat
- [Bun](https://bun.sh/) (v1.1+)

### 2. Instalasi Dependensi
```bash
bun install
```

### 3. Konfigurasi Lingkungan (.env)
Salin `.env.example` ke `.env` dan lengkapi kredensial:
```env
PORT=3000
NODE_ENV=development
NODE_API_KEY=sugeng-secret-token-mgl-2026

SUPABASE_PROJECT_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_publishable_anon_key
SUPABASE_SECRET_KEY=your_service_role_secret_key
```

### 4. Menjalankan Skrip Migrasi Supabase
Jalankan berkas SQL [supabase/migrations/001_sugeng_schema.sql](file:///home/relapri/Development/UE/GitHub/BE-SUGENG/supabase/migrations/001_sugeng_schema.sql) pada **Supabase SQL Editor** Anda untuk membuat ekstensi PostGIS, tabel, trigger spasial, dan data titik TPS awal di Kota Magelang.

### 5. Menjalankan Server Development
```bash
bun run dev
```
Akses:
- API Root: `http://localhost:3000/`
- Health Check: `http://localhost:3000/health`
- Swagger UI: `http://localhost:3000/swagger`

---

## 🧪 Pengujian (Test Suite)

Jalankan test suite otomatis menggunakan Bun test runner:
```bash
bun test
```

Pemeriksaan tipe data TypeScript:
```bash
bun run typecheck
```

---

## 📡 Dokumentasi Endpoint API

| Method | Endpoint | Deskripsi | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Informasi status servis & versi | Publik |
| `GET` | `/health` | Pemeriksaan kesehatan server & status database | Publik |
| `GET` | `/swagger` | Tampilan interaktif OpenAPI/Swagger Docs | Publik |
| `POST` | `/api/telemetry` | Ingest data telemetri dari node ESP32 | `X-Node-Token` |
| `POST` | `/api/telemetry/batch` | Ingest multi-rekaman telemetri sekaligus | `X-Node-Token` |
| `GET` | `/api/telemetry/latest` | Ambil pembacaan terakhir seluruh node TPS | Publik |
| `GET` | `/api/telemetry/summary` | KPI ringkasan (Safe, Warning, Critical, Gas Alert) | Publik |
| `GET` | `/api/telemetry/:nodeId/history` | Riwayat time-series sensor per node | Publik |
| `GET` | `/api/nodes` | Daftar seluruh titik TPS terdaftar | Publik |
| `GET` | `/api/nodes/geojson` | GeoJSON FeatureCollection untuk peta Leaflet | Publik |
| `GET` | `/api/nodes/:nodeId` | Detail spesifik titik TPS | Publik |
| `POST` | `/api/nodes` | Registrasi / update titik TPS baru | Publik / Admin |

---

## 👥 Tim Pengembang
- **Farrel Apriandry Ciu** (NPM. 2430506056) — *Technical & Hardware Lead*
- **Nabila Syafiqah Zahran Firlina** (NPM. 2430506058) — *Data & System Analyst*
**Program Studi S-1 Teknologi Informasi — Fakultas Teknik — Universitas Tidar (2026)**

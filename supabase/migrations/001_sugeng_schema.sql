-- ==============================================================================
-- SUGENG (Sistem Unggulan Pengelolaan & Monitoring Sampah Kota Magelang)
-- Inisialisasi Skema Database PostgreSQL + Ekstensi PostGIS
-- Studi Kasus: TPSA Banyuurip & Jaringan TPS Kota Magelang
-- ==============================================================================

-- 1. Aktifkan Ekstensi PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Buat Tabel Titik TPS (tps_nodes)
CREATE TABLE IF NOT EXISTS public.tps_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    address TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOMETRY(Point, 4326),
    capacity_liters DOUBLE PRECISION DEFAULT 120.0,
    volume_status VARCHAR(20) DEFAULT 'SAFE', -- SAFE, WARNING, CRITICAL
    last_volume_percent DOUBLE PRECISION DEFAULT 0.0,
    last_gas_alert BOOLEAN DEFAULT FALSE,
    last_temperature DOUBLE PRECISION,
    last_humidity DOUBLE PRECISION,
    last_ammonia_ppm DOUBLE PRECISION,
    last_methane_ppm DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeks Spasial GiST untuk Query Jarak & SIG
CREATE INDEX IF NOT EXISTS idx_tps_nodes_location ON public.tps_nodes USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_tps_nodes_node_id ON public.tps_nodes(node_id);

-- Trigger untuk sinkronisasi otomatis kolom 'location' dari latitude & longitude
CREATE OR REPLACE FUNCTION sync_tps_node_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_tps_node_geom ON public.tps_nodes;
CREATE TRIGGER trg_sync_tps_node_geom
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.tps_nodes
FOR EACH ROW EXECUTE FUNCTION sync_tps_node_geom();


-- 3. Buat Tabel Log Telemetri Time-Series (telemetry_logs)
CREATE TABLE IF NOT EXISTS public.telemetry_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    node_id VARCHAR(50) NOT NULL,
    temperature_celsius DOUBLE PRECISION,
    humidity_percent DOUBLE PRECISION,
    measured_distance_cm DOUBLE PRECISION,
    current_volume_percent DOUBLE PRECISION NOT NULL,
    gas_ppm_mq135 DOUBLE PRECISION,
    methane_ppm_mq4 DOUBLE PRECISION,
    mq135_adc INTEGER,
    mq4_adc INTEGER,
    mq135_pct DOUBLE PRECISION,
    mq4_pct DOUBLE PRECISION,
    uptime_sec BIGINT,
    volume_status VARCHAR(20) NOT NULL, -- SAFE, WARNING, CRITICAL
    gas_alert BOOLEAN NOT NULL DEFAULT FALSE,
    ammonia_level VARCHAR(20) DEFAULT 'SAFE',
    methane_level VARCHAR(20) DEFAULT 'SAFE',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeks gabungan time-series untuk performa query cepat per node
CREATE INDEX IF NOT EXISTS idx_telemetry_logs_node_time ON public.telemetry_logs(node_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_logs_created_at ON public.telemetry_logs(created_at DESC);


-- 4. Data Awal (Seed Data) Titik TPS Utama Kota Magelang
INSERT INTO public.tps_nodes (node_id, name, address, latitude, longitude, capacity_liters, volume_status, last_volume_percent)
VALUES
    ('NODE-MGL-01', 'TPS Pasar Rejowinangun', 'Jl. Mataram, Rejowinangun Selatan, Magelang Selatan', -7.48512, 110.21950, 120.0, 'SAFE', 35.0),
    ('NODE-MGL-02', 'TPS Potrobangsan', 'Jl. Pahlawan, Potrobangsan, Magelang Utara', -7.46230, 110.22180, 120.0, 'WARNING', 62.0),
    ('NODE-MGL-03', 'TPS Cacaban', 'Jl. Sigaluh, Cacaban, Magelang Tengah', -7.47640, 110.21410, 120.0, 'SAFE', 28.5),
    ('NODE-MGL-04', 'TPS Tidar Selatan', 'Jl. Sudirman, Tidar Selatan, Magelang Selatan', -7.49500, 110.22500, 120.0, 'CRITICAL', 82.0),
    ('NODE-MGL-05', 'TPSA Banyuurip (Pusat Pembuangan Akhir)', 'Banyuurip, Tegalrejo, Kab/Kota Magelang', -7.47350, 110.24520, 1000.0, 'SAFE', 45.0)
ON CONFLICT (node_id) DO UPDATE 
SET 
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    capacity_liters = EXCLUDED.capacity_liters;

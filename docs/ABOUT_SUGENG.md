# 🗑️ SUGENG (Sistem Unggulan Pengelolaan & Monitoring Sampah)
> **Solusi Cerdas Telemetri IoT, Prediksi Terdistribusi, dan Optimasi Rute Penjemputan Sampah Berbasis SIG di Kota Magelang**

---

## 📌 Apa itu SUGENG?

**SUGENG** adalah ekosistem sistem informasi terpadu berbasis **Internet of Things (IoT)**, **Kecerdasan Buatan (AI)**, dan **Sistem Informasi Geografis (SIG)** yang dirancang khusus untuk mentransformasi tata kelola pengangkutan sampah perkotaan dari metode konvensional (jadwal statis) menjadi **pengangkutan dinamis berbasis data real-time**.

Proyek ini dikembangkan sebagai langkah responsif dan mitigasi teknis terhadap krisis daya tampung **TPSA Banyuurip Kota Magelang** yang diproyeksikan penuh permanen pada tahun 2028, serta untuk mengurangi dampak pencemaran emisi bau di pemukiman warga sekitar Tempat Penampungan Sementara (TPS).

---

## 🚀 Masalah Utama yang Diselesaikan

1. **Pengangkutan Armada yang Tidak Efektif:** Truk sampah sering kali mendatangi TPS yang masih kosong atau justru terlambat mendatangi TPS yang sudah meluap (*overflow*).
2. **Pencemaran Bau & Kesehatan Lingkungan:** Penumpukan limbah organik yang membusuk menghasilkan emisi gas Amonia ($NH_3$) dan Metana ($CH_4$) tanpa terdeteksi secara dini.
3. **Pemborosan Biaya Operasional:** Konsumsi Bahan Bakar Minyak (BBM) armada truk tinggi akibat rute pengangkutan yang tidak teroptimasi.

---

## 🛠️ Cara Kerja Sistem (End-to-End Workflow)

1. **Perception Layer (Hardware Edge Node):**
   - Node **ESP32 DevKit V1** yang terpasang pada tempat sampah mengukur ketinggian tumpukan sampah secara presisi menggunakan sensor ultrasonik kedap air (**JSN-SR04T**).
   - Mengukur emisi gas busuk & pembusukan organik menggunakan sensor **MQ-135** dan **MQ-4**.
   - Dilengkapi modul **MOSFET FR120N** untuk penghematan daya (*Pulsed Heating*) dan manajamen energi mandiri via **Solar Charger CN3065** + baterai Li-ion 18650.

2. **Ingestion & Processing Layer (Middleware Backend):**
   - Data dikirimkan dari node ke **Elysia.js Middleware** yang berjalan di atas *Vercel Serverless Function*.
   - Middleware memvalidasi *schema* data JSON, menghitung ambang batas bahaya (*Alert Threshold*), dan meneruskannya ke **Supabase Database** berbasis **PostgreSQL + PostGIS**.

3. **Analytics & AI Engine (Routing & Predictive):**
   - **Google OR-Tools (CVRP Solver):** Menyusun rekomendasi rute penjemputan terpendek bagi armada truk berdasarkan TPS yang berstatus *Critical* ($\ge 75\%$).
   - **Predictive Model (XGBoost/Prophet):** Menganalisis pola buangan harian warga untuk mengestimasi waktu kapan suatu TPS akan penuh.

4. **Presentation Layer (Web Dashboard SIG):**
   - Menampilkan peta geospasial interaktif wilayah Kota Magelang dengan indikator status warna TPS (*Green, Yellow, Red*).
   - Memberikan navigasi rute pengangkutan langsung kepada pengemudi truk sampah.

---

## 📊 Ambang Batas & Kategori Indikator

| Indikator | Aman (Safe) | Waspada (Warning) | Bahaya (Critical / Priority) |
| :--- | :--- | :--- | :--- |
| **Persentase Volume** | $< 50\%$ | $50\% - 74.9\%$ | $\ge 75\%$ |
| **Gas Amonia (MQ-135)** | $< 30 \text{ ppm}$ | $30 - 59.9 \text{ ppm}$ | $\ge 60 \text{ ppm}$ |
| **Gas Metana (MQ-4)** | $< 100 \text{ ppm}$ | $100 - 249.9 \text{ ppm}$ | $\ge 250 \text{ ppm}$ |

---

## 🌟 Keunggulan Utama Proyek SUGENG

- **Mandiri Energi:** Operasional 24/7 di luar ruangan tanpa ketergantungan arus PLN berkat *Solar Harvesting*.
- **Hemat Kuota & Daya:** Firmware mendukung siklus *Deep Sleep* dan pengiriman data secara efisien.
- **Biaya Terjangkau:** Desain node *hardware* dirancang berbiaya rendah (*low-cost*) untuk kemudahan replikasi skala besar oleh Pemkot/DLH.
- **Data-Driven Policy:** Memberikan basis data geospasial yang akurat bagi pengawas dinas untuk pengambilan keputusan cepat.

---

## 👥 Tim Pengembang

- **Farrel Apriandry Ciu** (NPM. 2430506056) — *Ketua Tim / Technical & Hardware Lead*
- **Nabila Syafiqah Zahran Firlina** (NPM. 2430506058) — *Anggota Tim / Data & System Analyst*

**Program Studi S-1 Teknologi Informasi — Fakultas Teknik — Universitas Tidar (2026)**
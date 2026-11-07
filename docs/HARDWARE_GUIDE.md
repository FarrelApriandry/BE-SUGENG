# ⚙️ SUGENG Node — Hardware & Wiring Guide
Dokumentasi teknis perakitan perangkat keras (*Smart Bin Edge Node*) untuk sistem **SUGENG**.

---

## 📋 Daftar Komponen & Spesifikasi

| Komponen | Spesifikasi Utama | Fungsi dalam Sistem |
| :--- | :--- | :--- |
| **ESP32 DevKit V1** | 30-Pin, Wi-Fi/Bluetooth, Dual-Core | Mikrokontroler utama pengolah data sensor & komunikasi serial/Wi-Fi |
| **JSN-SR04T** | Ultrasonic Waterproof IP67 | Mengukur jarak permukaan sampah dari atas bak secara akurat |
| **MQ-135** | Gas Sensor (Amonia / $NH_3$) | Mendeteksi tingkat emisi bau busuk / limbah organik |
| **MQ-4** | Gas Sensor (Metana / $CH_4$) | Mendeteksi kandungan gas metana di dalam wadah sampah |
| **DHT22** | Digital Temperature & Humidity | Memantau suhu dan kelembapan udara di dalam box panel |
| **MOSFET FR120N** | Modul Saklar Elektronik | Mengatur siklus pemanas (*heater*) sensor gas untuk efisiensi daya |
| **Solar Charger CN3065** | Modul TP4056-Alternative for Solar | Mengisi daya baterai Li-Ion secara aman langsung dari panel surya |
| **Step-Up MT3608** | DC-DC Boost Converter | Menaikkan tegangan baterai (3.7V) menjadi stabil di level 5V |
| **Baterai 18650** | Li-Ion 3.7V rechargeable | Penyimpanan cadangan energi listrik utama |
| **Mini Solar Panel** | 6V 1W / 2W | Penangkap energi surya harian |

---

## 🔌 Pemetaan Pinout (Pin Mapping)
Berdasarkan *codebase* resmi firmware ESP32 versi USB Serial Live:

| Sensor / Modul | Pin pada Modul | Pin ESP32 DevKit V1 | Keterangan |
| :--- | :--- | :--- | :--- |
| **DHT22** | Data OUT | **GPIO 19** | Membaca suhu & kelembapan |
| **JSN-SR04T** | Trig | **GPIO 5** | Pemicu gelombang ultrasonik |
| **JSN-SR04T** | Echo | **GPIO 18** | Penerima pantulan gelombang |
| **MQ-135** | Analog Out (A0) | **GPIO 34** (ADC1) | Input kadar amonia / bau |
| **MQ-4** | Analog Out (A0) | **GPIO 35** (ADC1) | Input kadar gas metana |
| **MOSFET FR120N** | Signal (SIG) | **GPIO 4** | Kontrol saklar daya pemanas sensor |
| **Power Supply** | VCC & GND | **5V & GND** | Disuplai dari output MT3608 (5V murni) |

---

## ⚡ Skema Alur Daya (Power Management)


```

[ Panel Surya 6V ]
│
▼
[ Modul CN3065 (Solar Charger) ] ───► [ Baterai Li-Ion 18650 (3.7V) ]
│
▼
[ Step-Up MT3608 (Boost to 5V) ]
│
├─► VCC Sensor (JSN-SR04T, MQ, DHT)
└─► Pin VIN / 5V ESP32 DevKit V1

```

---

## 🛠️ Panduan Perakitan & Pemasangan Fisik

1. **Persiapan Box Enclosure (Junction Box PVC 150x110x70 mm):**
   * Lubangi bagian atas tutup box untuk menempelkan **Mini Solar Panel** secara rapi menggunakan lem tembak atau *double tape* 3M.
   * Buat lubang berdiameter $\pm 2\text{ cm}$ di sisi bawah box untuk memasang probe sensor ultrasonik **JSN-SR04T** menghadap ke dalam tempat sampah.
   * Buat beberapa lubang ventilasi kecil di bagian bawah/samping box agar sensor **MQ-135** dan **MQ-4** dapat mendeteksi sirkulasi udara bau secara akurat.

2. **Perakitan Jalur Elektronik (Breadboard / PCB Lubang):**
   * Pastikan seluruh jalur **Ground (GND)** disatukan (*Common Ground*) antara ESP32, modul power, dan sensor.
   * Gunakan kabel jumper berkualitas baik untuk menghindari *voltage drop* pada sensor gas yang membutuhkan arus stabil saat pemanasan (*heating*).

3. **Pengujian Tahap Awal:**
   * Sambungkan ESP32 ke laptop menggunakan kabel USB.
   * Unggah program *firmware*, buka **Serial Monitor** (baud rate `115200`), dan pastikan format data berawalan `JSON:{...}` muncul secara berkala tanpa ada sensor yang berstatus `[ERROR]` atau `[OUT OF RANGE]`.
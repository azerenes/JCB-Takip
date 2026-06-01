<p align="center">
  <img src="https://img.shields.io/badge/ESP32-Geliştirme-blue?style=for-the-badge&logo=espressif" alt="ESP32"/>
  <img src="https://img.shields.io/badge/Node.js-20+-green?style=for-the-badge&logo=node.js" alt="Node.js"/>
  <img src="https://img.shields.io/badge/MongoDB-7.0-brightgreen?style=for-the-badge&logo=mongodb" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/EMQX-5.3-purple?style=for-the-badge&logo=mqtt" alt="EMQX"/>
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker" alt="Docker"/>
  <img src="https://img.shields.io/badge/PlatformIO-IDE-orange?style=for-the-badge&logo=platformio" alt="PlatformIO"/>
</p>

<h1 align="center">🚜 JCB Tracker</h1>

<p align="center">
  <b>Endüstriyel İş Makineleri için Gerçek Zamanlı Takip Sistemi</b><br>
  <i>CAN-Bus, GPS, 4G/LTE, MQTT ve Web Panel ile donatılmış tam kapsamlı IoT çözümü</i>
</p>

<p align="center">
  <br>
  <b>🇹🇷 Türkçe</b> · <a href="#english">English</a>
  <br><br>
  <a href="#-özellikler">Özellikler</a> •
  <a href="#-mimari">Mimari</a> •
  <a href="#-hızlı-başlangıç">Hızlı Başlangıç</a> •
  <a href="#-geliştirme-rehberi">Geliştirme</a> •
  <a href="#-donanım">Donanım</a> •
  <a href="#-test">Test</a>
</p>

<br>

---

## ✨ Özellikler

| # | Özellik | Açıklama |
|---|---------|----------|
| 🛰️ | **GPS Takip** | NEO-6M/7M ile anlık konum, hız ve rota kaydı |
| 🔧 | **CAN-Bus (J1939)** | MCP2515 ile JCB'nin dijital saatinden motor çalışma saati okuma |
| 📡 | **4G/LTE GSM** | SIM7600 ile canlı veri akışı, MQTT ve HTTP desteği |
| 📦 | **Çevrimdışı Depolama** | MicroSD kart ile internet yokken verileri güvenle saklama |
| ☁️ | **Backlog Sync** | Şebeke geldiğinde geçmiş verileri sunucuya toplu yükleme |
| 🗺️ | **Canlı Harita** | Leaflet.js ile gerçek zamanlı araç takibi, rota geçmişi |
| 📊 | **Kurumsal Dashboard** | Chart.js ile detaylı istatistikler, cihaz durumları |
| ⚡ | **Uyarı Motoru** | Hız aşımı, geofence ihlali, mesai dışı çalışma, düşük batarya |
| 🪪 | **Çoklu Cihaz** | Sınırsız sayıda JCB'yi tek panelden yönetme |
| 📋 | **Raporlama** | CSV ve PDF formatında detaylı cihaz ve özet raporlar |
| 📱 | **WebSocket** | Anlık veri akışı, sayfa yenilemeden canlı güncelleme |
| ⚙️ | **Uzaktan Komut** | MQTT üzerinden cihazlara restart, sync komutları |
| 🔌 | **Güç Yönetimi** | Deep sleep, düşük batarya koruması, uzun ömürlü çalışma |

---

## 🏗️ Mimari

```
┌─────────────────────────────────────────────────────────────┐
│                      JCB İş Makinesi                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   ESP32 Ana Beyin                      │  │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌────────┐  │  │
│  │  │GPS   │  │CAN   │  │GSM   │  │SD    │  │RTC     │  │  │
│  │  │NEO-6M│  │J1939 │  │4G/LTE│  │Kart  │  │DS3231  │  │  │
│  │  └──────┘  └──────┘  └──────┘  └──────┘  └────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │   MQTT (Canlı)      │
              │   HTTP (Backlog)    │
              └──────────┬──────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                      Sunucu Tarafı                           │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│  │  EMQX    │───▶│ Node.js  │───▶│ MongoDB  │               │
│  │  MQTT    │    │ Express  │    │  7.0     │               │
│  │  Broker  │    │ REST API │    │          │               │
│  └──────────┘    └────┬─────┘    └──────────┘               │
│                       │                                      │
│              ┌────────┴────────┐                            │
│              │   Web Panel     │                            │
│              │ Leaflet + Chart │                            │
│              └─────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### Veri Akışı

```
Normal Çalışma (İnternet Var):
  ESP32 → MQTT → EMQX → Node.js → MongoDB → WebSocket → Web Panel
                                → Geofence Motoru
                                → Uyarı Motoru

Çevrimdışı Çalışma (İnternet Yok):
  ESP32 → SD Kart (CSV Log)
          └── İnternet gelince → HTTP POST /api/backlog → MongoDB
```

---

## 🚀 Hızlı Başlangıç

### 1. Sunucuyu Başlatın

```bash
# Tüm stack'i tek komutla başlat
docker-compose up -d

# Servislerin sağlıklı çalıştığını doğrula
docker-compose ps

# Logları izle
docker-compose logs -f server
```

| Servis | Port | Açıklama |
|--------|------|----------|
| 🌐 Web Panel | `localhost:3000` | Ana arayüz |
| 📡 MQTT | `localhost:1883` | Cihaz bağlantısı |
| 🔌 MQTT WS | `localhost:8083` | WebSocket MQTT |
| 📊 EMQX Dashboard | `localhost:18083` | Broker yönetimi |
| 🗄️ MongoDB | `localhost:27017` | Veritabanı |

### 2. ESP32'yi Hazırlayın

```bash
# PlatformIO ile firmware'i yükle
cd firmware
pio run --target upload --environment esp32dev

# Seri monitör ile çıktıları izle
pio device monitor
```

### 3. Test Simülasyonu

Sunucuyu donanım olmadan test etmek için:

```bash
cd tools/device_simulator
npm install
DEVICE_COUNT=10 npm start
```

**Web Panel:** http://localhost:3000

| Rol | Email | Şifre |
|-----|-------|-------|
| 📋 Admin | `admin@jcbtracker.com` | `admin123` |

---

## 🔧 Donanım

### Gerekli Malzemeler

| Modül | Adet | Açıklama |
|-------|------|----------|
| 🧠 ESP32 DevKit | 1 | Ana işlemci |
| 🛰️ NEO-6M / NEO-7M GPS | 1 | Konum sensörü |
| 📡 SIM7600 4G/LTE | 1 | Hücresel bağlantı |
| 🔧 MCP2515 CAN-Bus | 1 | J1939 dijital saat |
| 💾 MicroSD Kart Modülü | 1 | Çevrimdışı depolama |
| ⏰ DS3231 RTC | 1 | Hassas zaman tutma |
| 🔌 PC817 Optokuplör | 1 | Analog saat okuma |
| ⚡ LM2596 Buck Dönüştürücü | 1 | 24V → 5V güç dönüşümü |

### Bağlantı Şeması

Detaylı pin→pin bağlantı talimatları için:
📄 [`hardware/wiring_diagram.md`](hardware/wiring_diagram.md)

```
ESP32 Pin Özeti:
┌─────────────────────────────────────┐
│ VIN → LM2596 Çıkış (5V)             │
│ 3.3V → GPS, RTC                     │
│ D2 → SD Card CS                     │
│ D4 → SIM7600 PWRKEY                 │
│ D5 → MCP2515 CS                     │
│ D15 → SIM7600 RESET                 │
│ D16/D17 → GPS UART                  │
│ D18/D19/D23 → SPI (SD + CAN)        │
│ D21/D22 → RTC I2C                   │
│ D26/D27 → GSM UART                  │
│ D34 → MCP2515 INT                   │
│ D35 → PC817 Optokuplör              │
│ VP(36) → Batarya ADC                │
└─────────────────────────────────────┘
```

---

## 📂 Proje Yapısı

```
jcb-tracker/
├── firmware/                          # ESP32 Gömülü Yazılım
│   ├── src/                           # Kaynak kodlar (10 modül)
│   │   ├── main.cpp                   # 30sn scheduler döngüsü
│   │   ├── can_bus.cpp                # J1939 CAN-Bus sürücüsü
│   │   ├── gps.cpp                    # NMEA ayrıştırıcı
│   │   ├── gsm.cpp                    # SIM7600 AT komut yöneticisi
│   │   ├── mqtt_client.cpp            # MQTT yayın/abonelik
│   │   ├── sd_card.cpp                # CSV log + backlog yönetimi
│   │   ├── wifi_manager.cpp           # Wi-Fi bağlantı yöneticisi
│   │   ├── power_manager.cpp          # Deep sleep + güç optimizasyonu
│   │   ├── rtc.cpp                    # DS3231 I2C sürücüsü
│   │   ├── sensor_analog.cpp          # PC817 optokuplör sayıcı
│   │   └── types.h                    # Ortak tip tanımları
│   ├── include/config.h               # Pin/konfigürasyon
│   └── platformio.ini                 # PlatformIO yapılandırması
│
├── server/                            # Node.js Sunucu
│   ├── src/
│   │   ├── index.js                   # Express + Socket.IO giriş
│   │   ├── config.js                  # Ortam değişkenleri
│   │   ├── routes/                    # REST API endpoint'leri
│   │   │   ├── device.js              # Cihaz CRUD + backlog
│   │   │   ├── auth.js                # JWT kimlik doğrulama
│   │   │   ├── panel.js               # Harita + dashboard API
│   │   │   └── reports.js             # CSV/PDF raporlama
│   │   ├── models/                    # MongoDB şemaları
│   │   │   ├── Device.js              # Cihaz profili
│   │   │   ├── LocationLog.js         # Konum kayıtları
│   │   │   ├── Alert.js               # Uyarılar
│   │   │   └── Geofence.js            # Sanal çitler
│   │   ├── services/                  # İş mantığı
│   │   │   ├── mqtt-listener.js       # MQTT → MongoDB köprüsü
│   │   │   ├── backlog-handler.js     # Toplu veri işleme
│   │   │   ├── geofence.js            # Geofence motoru
│   │   │   ├── alert-engine.js        # Kural motoru
│   │   │   └── export.js              # Rapor oluşturma
│   │   └── middleware/                # Yetkilendirme
│   │       ├── auth.js                # Admin JWT
│   │       └── device-auth.js         # Cihaz API Key
│   └── public/                        # Web Panel
│       ├── index.html                 # Canlı harita
│       ├── dashboard.html             # İstatistikler
│       ├── reports.html               # Raporlama arayüzü
│       ├── style.css                  # Modern tasarım
│       └── app.js                     # İstemci mantığı
│
├── mqtt-broker/                       # EMQX Konfigürasyonu
│   ├── docker-compose.yml             # Broker servisi
│   ├── emqx.conf                      # Sistem ayarları
│   └── acl.conf                       # Erişim kontrolü
│
├── tools/                             # Yardımcı Araçlar
│   ├── can_simulator/                 # CAN-Bus J1939 simülatörü
│   ├── csv_parser/                    # SD kart CSV import
│   └── device_simulator/              # Çoklu cihaz simülatörü
│
├── hardware/                          # Donanım Dökümantasyonu
│   └── wiring_diagram.md              # Bağlantı şeması
│
├── docs/                              # Dökümantasyon
│   ├── protocol.md                    # MQTT/HTTP protokolü
│   ├── architecture.md                # Sistem mimarisi
│   ├── test_plan.md                   # Test senaryoları
│   └── deployment.md                  # Kurulum kılavuzu
│
├── docker-compose.yml                 # Ana stack
└── .gitignore
```

---

## 📡 MQTT Protokolü

### Topic Yapısı

| Topic | Yön | Hız | Açıklama |
|-------|-----|-----|----------|
| `jcb/{id}/live` | 📤 Cihaz → Sunucu | 30sn | Anlık konum + sensör |
| `jcb/{id}/status` | 📤 Cihaz → Sunucu | 5dk | Batarya + sinyal durumu |
| `jcb/{id}/cmd` | 📥 Sunucu → Cihaz | Olaya bağlı | RESTART, SYNC_NOW |
| `jcb/{id}/config` | 📥 Sunucu → Cihaz | Olaya bağlı | Uzaktan yapılandırma |

### Live Data Formatı

```json
{
  "d": "JCB-001",
  "t": 1740000000,
  "lat": 39.123456,
  "lng": 35.654321,
  "s": 45.5,
  "eh": 1250.3,
  "oc": 42,
  "bv": 3800
}
```

### SD Kart CSV Formatı

```csv
timestamp,latitude,longitude,speed_kmh,engine_hours,opto_count,battery_mv
1740000000,39.123456,35.654321,45.5,1250.3,42,3800
```

---

## 🧪 Test

```bash
# Sunucu syntax kontrolü
cd server && npm install
node --check src/index.js
node --check src/routes/device.js

# Simülasyon testi
cd tools/device_simulator && npm install
DEVICE_COUNT=10 node device_simulator.js

# CSV yükleme testi
cd tools/csv_parser
node csv_parser.js JCB-001 ../sample_data.csv
```

Detaylı test senaryoları: 📄 [`docs/test_plan.md`](docs/test_plan.md)

---

## 📊 Performans

| Metrik | Değer |
|--------|-------|
| 📦 Cihaz Başına Günlük Veri | ~576 KB |
| 🚚 100 Cihaz / Aylık Veri | ~1.7 GB |
| ⏱️ Döngü Periyodu | 30 saniye |
| 🪫 Derin Uyku Akımı | ~10 µA |
| 🔋 Çalışma Akımı | ~200 mA |
| 📈 MongoDB TTL Temizlik | 30 gün |

---

## 🛠️ Geliştirme

```bash
# Bağımlılıkları yükle
cd server && npm install

# Geliştirme modunda çalıştır
npm run dev

# Docker ile başlat
docker-compose up -d --build

# EMQX shell
docker exec -it jcb-emqx sh

# MongoDB query
docker exec -it jcb-mongo mongosh jcb_tracker
db.Device.find().pretty()
```

---

## 📸 Ekran Görüntüleri

> *Yakında...*

| Canlı Harita | Dashboard | Raporlar |
|-------------|-----------|----------|
| Leaflet.js tabanlı gerçek zamanlı araç takibi | Anlık istatistikler ve Chart.js grafikler | CSV/PDF formatında detaylı raporlar |

---

## 🤝 Katkıda Bulunma

1. Bu repoyu fork edin
2. Yeni bir branch oluşturun (`git checkout -b feature/yeni-ozellik`)
3. Değişikliklerinizi commit edin (`git commit -am 'Yeni özellik eklendi'`)
4. Branch'inizi push edin (`git push origin feature/yeni-ozellik`)
5. Pull Request oluşturun

---

## 📄 Lisans

Bu proje MIT lisansı ile lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakınız.

---

## 👨‍💻 Geliştirici

**Azere Nes** — [GitHub](https://github.com/azerenes)

> JCB Tracker, endüstriyel iş makinelerinin filo yönetimini dijitalleştirmek için geliştirilmiş açık kaynak bir IoT projesidir.

---

<p align="center">
  <b>Tüm hakları saklıdır © 2026</b><br>
  <sub>Built with ❤️ and ESP32, Node.js, MQTT, MongoDB</sub>
</p>

<br>

---

<h2 id="english">🌍 English</h2>

<h1 align="center">🚜 JCB Tracker</h1>

<p align="center">
  <b>Real-Time Fleet Tracking System for Heavy Machinery</b><br>
  <i>Full-stack IoT solution with CAN-Bus, GPS, 4G/LTE, MQTT and Web Dashboard</i>
</p>

### Quick Start

```bash
# Start the server stack
docker-compose up -d

# Load firmware to ESP32
cd firmware && pio run --target upload

# Simulate 10 devices for testing
cd tools/device_simulator && npm install && DEVICE_COUNT=10 npm start
```

**Web Panel:** http://localhost:3000 — `admin@jcbtracker.com` / `admin123`

### Hardware Requirements

| Module | Purpose |
|--------|---------|
| ESP32 DevKit | Main processor |
| NEO-6M/7M GPS | Location tracking |
| SIM7600 4G/LTE | Cellular connectivity |
| MCP2515 CAN-Bus | J1939 engine hours |
| MicroSD Card Module | Offline data logging |
| DS3231 RTC | Precision timekeeping |
| LM2596 Buck Converter | 24V to 5V power |

### Architecture

```
ESP32 → MQTT → EMQX → Node.js → MongoDB → WebSocket → Dashboard
                                              → Geofence Engine
                                              → Alert Engine
```

### Features

- **Real-time GPS tracking** with 30-second intervals
- **J1939 CAN-Bus** interface for engine diagnostics
- **Dual connectivity** — 4G LTE + Wi-Fi failover
- **Offline-first** — SD card storage with automatic sync
- **Enterprise dashboard** — Live map, statistics, reporting
- **Smart alerts** — Speed limits, geofence, out-of-hours detection
- **Multi-device** — Unlimited machinery on a single dashboard
- **Fully containerized** — Docker Compose ready

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Microcontroller | ESP32 (Arduino/PlatformIO) |
| MQTT Broker | EMQX 5.3 |
| Backend | Node.js 20+ |
| Database | MongoDB 7.0 |
| Frontend | Leaflet.js, Chart.js, Socket.IO |
| Container | Docker Compose |

### License

MIT License — feel free to use, modify, and distribute.

---

<p align="center">
  <a href="https://github.com/azerenes/JCB-Takip">⭐ Star on GitHub</a>
  ·
  <a href="https://github.com/azerenes/JCB-Takip/issues">🐛 Report Bug</a>
  ·
  <a href="https://github.com/azerenes/JCB-Takip/discussions">💬 Join Discussion</a>
</p>

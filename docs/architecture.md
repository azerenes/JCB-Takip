# JCB Tracker - Sistem Mimarisi

## Genel Bakış

```
┌─────────────────────────────┐
│       JCB Iş Makinesi       │
│  ┌───────────────────────┐  │
│  │   ESP32 (Ana Beyin)   │  │
│  │  ┌─────────────────┐  │  │
│  │  │ CAN-Bus (J1939)  │  │  │
│  │  │ GPS (NEO-6M/7M)  │  │  │
│  │  │ RTC (DS3231)     │  │  │
│  │  │ SD Kart (SPI)    │  │  │
│  │  │ GSM (SIM7600)    │  │  │
│  │  │ Wi-Fi (ESP32)    │  │  │
│  │  │ Optokuplör       │  │  │
│  │  └─────────────────┘  │  │
│  └───────────────────────┘  │
└──────────┬──────────────────┘
           │
    ┌──────┴──────┐
    │  İnternet   │
    └──────┬──────┘
           │
    ┌──────┴──────┐
    │  MQTT/HTTP  │
    └──────┬──────┘
           │
┌──────────┴──────────┐
│     EMQX Broker     │
│   (MQTT + WebSock)  │
└──────────┬──────────┘
           │
┌──────────┴──────────┐
│   Node.js Sunucu    │
│  ┌────────────────┐ │
│  │ MQTT Listener  │ │
│  │ REST API       │ │
│  │ Socket.IO      │ │
│  │ Alert Engine   │ │
│  │ Geofence Svc   │ │
│  └────────────────┘ │
└──────────┬──────────┘
           │
┌──────────┴──────────┐
│     MongoDB         │
└──────────┬──────────┘
           │
┌──────────┴──────────┐
│  Web Panel (SPA)    │
│  Leaflet.js Harita  │
│  Dashboard          │
│  Raporlama          │
└─────────────────────┘
```

## Veri Akışı

### Normal Çalışma (İnternet Var)
```
ESP32 → MQTT → EMQX → Node.js (mqtt-listener) → MongoDB
                                              → Socket.IO → Web Panel
                                              → Geofence Check
                                              → Alert Engine
```

### Çevrimdışı Çalışma (İnternet Yok)
```
ESP32 → SD Kart (CSV log)
        └── İnternet gelince → HTTP POST /api/backlog → MongoDB
```

## Teknoloji Yığını

| Katman | Teknoloji | Sürüm |
|--------|-----------|-------|
| Mikrodenetleyici | ESP32 (Tensilica Xtensa LX6) | - |
| Gömülü Çerçeve | Arduino Core / PlatformIO | - |
| MQTT Broker | EMQX | 5.3+ |
| Sunucu | Node.js | 20+ |
| Veritabanı | MongoDB | 7+ |
| Web Panel | vanilla JS + Leaflet.js + Chart.js | - |
| Gerçek Zamanlı | Socket.IO | 4.7+ |
| Konteyner | Docker + Docker Compose | - |

## Cihaz Kaydı ve Kimlik Doğrulama

1. Her cihaz ilk çalıştırmada `/api/device/register` ile kaydedilir
2. Sunucu cihaza UUID formatında bir `apiKey` döner
3. Cihaz her MQTT bağlantısında bu apiKey'i kullanır
4. HTTP isteklerinde `X-API-Key` header'ı ile doğrulama yapılır

## Ölçeklenebilirlik

- EMQX cluster ile yatay ölçeklenebilir
- MongoDB sharding ile büyük veri hacimleri desteklenir
- Her ESP32 30sn'de ~200 byte veri gönderir = günde ~576KB/cihaz
- 100 cihaz = günde ~57MB, ayda ~1.7GB

# JCB Tracker - Veri Protokolü

## 1. MQTT Topic Yapısı

| Topic | QoS | Yön | Açıklama |
|-------|-----|-----|----------|
| `jcb/{deviceId}/live` | 1 | Cihaz → Sunucu | 30sn'de bir canlı konum ve sensor verileri |
| `jcb/{deviceId}/status` | 1 | Cihaz → Sunucu | Bağlantı, batarya ve sinyal durumu |
| `jcb/{deviceId}/cmd` | 1 | Sunucu → Cihaz | Uzaktan komut (RESTART, SYNC_NOW) |
| `jcb/{deviceId}/config` | 1 | Sunucu → Cihaz | Uzaktan yapılandırma güncellemesi |

## 2. Veri Formatları

### Live Data (MQTT - jcb/{id}/live)
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

| Alan | Tip | Açıklama |
|------|-----|----------|
| d | string | Cihaz ID |
| t | int | Unix timestamp (saniye) |
| lat | float | Enlem |
| lng | float | Boylam |
| s | float | Hız (km/h) |
| eh | float | Motor çalışma saati |
| oc | int | Optokuplör sayacı |
| bv | float | Batarya voltajı (mV) |

### Status Data (MQTT - jcb/{id}/status)
```json
{
  "d": "JCB-001",
  "bv": 3800,
  "wifi": "Garaj_WiFi",
  "gsm": "Turkcell",
  "rssi": -65
}
```

### Backlog Upload (HTTP POST /api/backlog)
```json
{
  "deviceId": "JCB-001",
  "apiKey": "uuid-api-key",
  "logs": [
    {
      "timestamp": 1740000000,
      "lat": 39.123,
      "lng": 35.654,
      "speed": 45.5,
      "engineHours": 1250.3,
      "optoCount": 42,
      "batteryMv": 3800
    }
  ]
}
```

### Single Location (HTTP POST /api/device/location)
```json
{
  "deviceId": "JCB-001",
  "apiKey": "uuid-api-key",
  "timestamp": 1740000000,
  "lat": 39.123456,
  "lng": 35.654321,
  "speed": 45.5,
  "engineHours": 1250.3,
  "batteryMv": 3800,
  "ignition": true
}
```

## 3. CSV Log Formatı (SD Kart)

```
timestamp,latitude,longitude,speed_kmh,engine_hours,opto_count,battery_mv
1740000000,39.123456,35.654321,45.5,1250.3,42,3800
1740000030,39.123789,35.654987,0.0,1250.3,42,3795
```

- Her 30 saniyede bir yeni satır
- timestamp: Unix epoch (saniye)
- UTF-8 encoding, LF satır sonu

## 4. API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | /api/device/register | Yeni cihaz kaydı |
| GET | /api/device | Cihaz listesi |
| GET | /api/device/:id | Cihaz detayı |
| PUT | /api/device/:id | Cihaz güncelleme |
| DELETE | /api/device/:id | Cihaz silme |
| POST | /api/device/location | Tekil konum kaydı |
| POST | /api/device/backlog | Toplu veri yükleme |
| POST | /api/auth/login | Admin girişi |
| GET | /api/panel/summary | Dashboard özeti |
| GET | /api/panel/devices-live | Canlı cihaz durumları |
| GET | /api/panel/device-history/:id | Cihaz geçmişi |
| GET | /api/panel/alerts | Uyarı listesi |
| PUT | /api/panel/alerts/:id/acknowledge | Uyarı onaylama |
| GET | /api/panel/geofences | Geofence listesi |
| POST | /api/panel/geofences | Geofence oluşturma |
| GET | /api/reports/device-report/:id | Cihaz raporu (JSON/CSV/PDF) |
| GET | /api/reports/summary-report | Özet rapor |

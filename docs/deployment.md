# JCB Tracker - Dağıtım Kılavuzu

## 1. Sunucu Gereksinimleri

| Bileşen | Minimum | Önerilen |
|---------|---------|----------|
| CPU | 2 çekirdek | 4+ çekirdek |
| RAM | 4GB | 8GB+ |
| Disk | 50GB SSD | 100GB+ SSD |
| İşletim Sistemi | Ubuntu 22.04 / Debian 12 | Ubuntu 24.04 |
| Docker | 24+ | 26+ |

## 2. Hızlı Kurulum (Docker Compose)

```bash
# Projeyi klonla
git clone <repo-url> jcb-tracker
cd jcb-tracker

# .env dosyasını düzenle
cp server/.env.example server/.env
nano server/.env

# Tüm servisleri başlat
docker-compose up -d

# Logları izle
docker-compose logs -f
```

## 3. Servisler

| Servis | Port | Açıklama |
|--------|------|----------|
| EMQX | 1883 (MQTT), 8083 (WS), 18083 (Dashboard) | MQTT Broker |
| Node.js | 3000 | REST API + Web Panel |
| MongoDB | 27017 | Veritabanı |

## 4. EMQX Dashboard

- URL: http://sunucu-ip:18083
- Kullanıcı: admin
- Şifre: public

## 5. Web Panel

- URL: http://sunucu-ip:3000
- Varsayılan admin: admin@jcbtracker.com / admin123

## 6. ESP32 Firmware Yükleme

### PlatformIO ile:
```bash
cd firmware
pio run --target upload --environment esp32dev
pio device monitor
```

### Konfigürasyon (config.h):
```cpp
#define DEVICE_ID           "JCB-001"
#define DEVICE_API_KEY      "sunucudan_alinan_api_key"
#define MQTT_BROKER         "mqtt://sunucu-ip"
#define API_BASE_URL        "http://sunucu-ip:3000/api"
```

## 7. Test Simulasyonu

Sunucusuz test için cihaz simülatörünü kullanın:
```bash
cd tools/device_simulator
npm install
DEVICE_COUNT=10 node device_simulator.js
```

## 8. Veritabanı Yedekleme

```bash
docker exec jcb-mongo mongodump --out /backup/$(date +%Y%m%d)
docker cp jcb-mongo:/backup/$(date +%Y%m%d) ./backups/
```

## 9. İzleme

```bash
# Tüm servis durumu
docker-compose ps

# Kaynak kullanımı
docker stats

# EMQX istatistik
docker exec jcb-emqx emqx_ctl stats

# MongoDB sorgu profili
docker exec jcb-mongo mongosh --eval "db.setProfilingLevel(1)"
```

## 10. Sorun Giderme

### ESP32 Bağlanamıyorsa
```bash
# GSM sinyali kontrol
AT+CSQ

# MQTT bağlantı testi
AT+MQTTCONN="tcp://sunucu-ip",1883,"JCB-001",60,"",""

# DNS çözümleme
AT+CDNSGIP="sunucu-adres.com"
```

### Sunucu Logları
```bash
docker-compose logs -f --tail=100 server
docker-compose logs -f --tail=100 emqx
```

### MongoDB Performans
```javascript
// Veritabanı mongo shell içinde
db.currentOp()
db.LocationLog.getIndexes()
db.LocationLog.find().explain("executionStats")
```

## 11. Güvenlik

- Tüm API istekleri HTTPS üzerinden yapılmalıdır
- EMQX MQTT TLS ile yapılandırılmalıdır
- MongoDB authentication etkinleştirilmelidir
- API key'ler düzenli olarak rotasyon yapılmalıdır
- Web panel için rate limiting uygulanmalıdır

# JCB Tracker - Dağıtım Kılavuzu

## 1. Sunucu Gereksinimleri

| Bileşen | Minimum | Önerilen |
|---------|---------|----------|
| CPU | 2 çekirdek | 4+ çekirdek |
| RAM | 4GB | 8GB+ |
| Disk | 20GB SSD | 50GB+ SSD |
| İşletim Sistemi | Ubuntu 22.04 / Debian 12 | Ubuntu 24.04 |
| Docker | 24+ | 26+ |

## 2. Hızlı Kurulum

```bash
# Projeyi klonla
git clone https://github.com/azerenes/JCB-Takip.git jcb-tracker
cd jcb-tracker

# Tüm servisleri başlat (MongoDB + EMQX + Node.js + Simülatör)
docker compose up -d --build

# Servislerin hazır olmasını bekle (15-30sn)
docker compose ps

# Web panel: http://sunucu-ip:3000
```

## 3. Servisler

| Servis | Port | Açıklama |
|--------|------|----------|
| EMQX | 1883 (MQTT), 8083 (WS), 18083 (Dashboard) | MQTT Broker |
| Node.js | 3000 | REST API + Web Panel |
| MongoDB | 27017 | Veritabanı |
| Simülatör | - | 12 sanal cihaz (opsiyonel) |

## 4. Müşteri Yönetimi (Multi-Tenant)

Her müşteri kendi verilerine **sadece kendi hesabıyla** erişebilir.

### Yeni Müşteri Ekleme
1. **Müşteri kendi kaydolur:** `http://sunucu-ip:3000/register.html`
2. **Süper Admin ekler:** Web panel → Süper Admin → Yeni Firma

### Varsayılan Hesaplar
| Rol | Email | Şifre |
|-----|-------|-------|
| Süper Admin | admin@jcbtracker.com | admin123 |
| Demo Tenant | demo@jcbtracker.com | demo123 |

## 5. Cihaz Bağlama

### ESP32 Konfigürasyonu
```cpp
#define DEVICE_ID           "MUSTERI-001"
#define DEVICE_API_KEY      ""  // Sunucu otomatik atar
#define MQTT_BROKER         "mqtt://sunucu-ip"
#define API_BASE_URL        "http://sunucu-ip:3000/api"
```

ESP32 açıldığında:
1. `/api/device/register` ile kaydolur
2. API key alır
3. MQTT üzerinden canlı veri göndermeye başlar

### Test İçin Simülatör
Docker stack içinde **12 sanal cihaz** otomatik çalışır:
```bash
# Simülatör ayarları (.env dosyası)
SIM_DEVICE_COUNT=20
SIM_INTERVAL_MS=5000
```

## 6. EMQX Dashboard

- URL: `http://sunucu-ip:18083`
- Kullanıcı: `admin`
- Şifre: `public`

## 7. Yönetim

```bash
# Servis durumu
docker compose ps

# Loglar
docker compose logs -f server
docker compose logs -f simulator

# Güncelleme (kod değişikliği sonrası)
docker compose up -d --build server

# Durdurma
docker compose down

# Veritabanı yedekleme
docker exec jcb-mongo mongodump --out /data/backup/$(date +%Y%m%d)

# Tam sıfırlama
docker compose down -v
docker compose up -d
```

## 8. Güvenlik Notları

- Tüm API istekleri **JWT token** ile korunur
- Her müşteri (tenant) sadece kendi cihazlarını görür
- Süper Admin tüm tenant'ları yönetebilir
- Cihaz-sunucu iletişimi **apiKey** ile doğrulanır
- Rate limiting: 300 istek/15dk (API), 20 deneme/15dk (login)
- HTTPS zorunludur (production için reverse proxy önerilir: Nginx/Caddy)

## 9. Production Deployment

Production için önerilen mimari:
```
Internet → Nginx (SSL) → Node.js (3000)
                        → EMQX (1883 MQTT, 8883 MQTTS)
                        → MongoDB (27017, auth enabled)
```

Nginx ile SSL yapılandırması:
```nginx
server {
    listen 443 ssl;
    server_name jcb-sunucu.com;

    ssl_certificate /etc/letsencrypt/live/.../fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 10. Sorun Giderme

### Cihaz Bağlanamıyorsa
```bash
# EMQX bağlantılarını kontrol et
docker exec jcb-emqx emqx_ctl clients list

# MQTT test mesajı gönder
docker exec jcb-emqx emqx_ctl publish topic "test" '{"msg":"hello"}'
```

### Sunucu Logları
```bash
docker compose logs -f --tail=100 server
docker compose logs -f --tail=100 emqx
docker compose logs -f --tail=50 simulator
```

# JCB Tracker - Test Planı

## Aşama 1: Bileşen Testleri

### 1.1 GPS Modülü
- [ ] NMEA verisi alınıyor mu? (UART'ta $GPGGA cümlesi)
- [ ] 3D fix alınabiliyor mu?
- [ ] Koordinat okuma doğruluğu < 5m
- [ ] GPS soğuk başlangıç süresi < 60sn
- [ ] GPS sıcak başlangıç süresi < 10sn

### 1.2 SD Kart
- [ ] SD kart başlatılabiliyor mu?
- [ ] CSV dosyası oluşturuluyor mu?
- [ ] 1000 satır veri yazılabiliyor mu?
- [ ] Güç kesilmesinde veri kaybı yok mu?
- [ ] Dosya boyutu limiti çalışıyor mu?

### 1.3 CAN-Bus
- [ ] MCP2515 başlatılabiliyor mu?
- [ ] J1939 mesajları okunabiliyor mu?
- [ ] PGN 65253 (Engine Hours) doğru okunuyor mu?
- [ ] PGN 65254 (Vehicle Hours) doğru okunuyor mu?
- [ ] CAN simülatörü ile test edildi mi?

### 1.4 Optokuplör
- [ ] PC817 sinyali okunabiliyor mu?
- [ ] Debounce çalışıyor (yanlış tetikleme yok)?
- [ ] Sayaç doğru artıyor mu?
- [ ] Kesme (interrupt) hizmet rutini çalışıyor mu?

### 1.5 GSM (SIM7600)
- [ ] AT komutlarına yanıt alınıyor mu?
- [ ] Şebekeye kayıt olabiliyor mu?
- [ ] APN bağlantısı kurulabiliyor mu?
- [ ] HTTP POST gönderilebiliyor mu?
- [ ] MQTT bağlantısı kurulabiliyor mu?
- [ ] Güç tasarrufu modu çalışıyor mu?

### 1.6 RTC (DS3231)
- [ ] Zaman okunabiliyor mu?
- [ ] GPS'ten senkronizasyon çalışıyor mu?
- [ ] Pil yedekleme çalışıyor mu?
- [ ] Sıcaklık sensörü çalışıyor mu?

## Aşama 2: Entegrasyon Testleri

### 2.1 Veri Toplama Döngüsü
- [ ] 30sn döngü periyodu tutarlı mı?
- [ ] Tüm sensörler aynı anda okunabiliyor mu?
- [ ] SD kart yazma süresi < 200ms mi?
- [ ] Döngü gecikmesi (jitter) < 2sn mi?

### 2.2 İnternet Bağlantısı
- [ ] GSM üzerinden internet algılanıyor mu?
- [ ] Wi-Fi üzerinden internet algılanıyor mu?
- [ ] GSM → Wi-Fi geçişi otomatik mi?
- [ ] İnternet yokken SD karta yazma başlıyor mu?

### 2.3 Backlog Sync
- [ ] İnternet geldiğinde beklemiş veriler yükleniyor mu?
- [ ] Yükleme sonrası SD kart temizleniyor mu?
- [ ] Büyük backlog (10k+ satır) yüklenebiliyor mu?
- [ ] Kısmi yükleme hatasında veri kaybı yok mu?

### 2.4 Sunucu Bağlantısı
- [ ] MQTT broker'a bağlanılabiliyor mu?
- [ ] WebSocket bağlantısı kurulabiliyor mu?
- [ ] REST API istekleri çalışıyor mu?
- [ ] Cihaz kaydı (register) başarılı mı?

## Aşama 3: Sistem Testleri

### 3.1 Çoklu Cihaz
- [ ] 10 aynı anda simüle edilmiş cihaz çalışıyor mu?
- [ ] 50 cihaz MQTT'ye aynı anda bağlanabiliyor mu?
- [ ] MongoDB 100k kayıt/saat işleyebiliyor mu?
- [ ] Aynı anda gelen backlog çakışması yok mu?

### 3.2 Güç Yönetimi
- [ ] Kontak kapandığında cihaz derin uykuya geçiyor mu?
- [ ] Uyandırma düzgün çalışıyor mu?
- [ ] Batarya voltajı doğru okunuyor mu?
- [ ] Düşük batarya uyarısı tetikleniyor mu?

### 3.3 Web Panel
- [ ] Haritada cihazlar doğru konumda mı?
- [ ] Canlı güncelleme (WebSocket) çalışıyor mu?
- [ ] Dashboard istatistikleri doğru mu?
- [ ] CSV/PDF rapor indirme çalışıyor mu?
- [ ] Geofence uyarıları tetikleniyor mu?
- [ ] Alert engine hız/çalışma saati uyarısı veriyor mu?

## Aşama 4: Uzun Süreli Testler

### 4.1 24 Saat Kararlılık
- [ ] ESP32 crash/beklenmedik reset yapmıyor mu?
- [ ] GSM bağlantısı gün boyu kopmuyor mu?
- [ ] SD kart kapasitesi aşılmıyor mu?
- [ ] Tüm veriler sunucuya ulaşıyor mu?

### 4.2 7 Gün Veri Toplama
- [ ] Haftalık veri bütünlüğü sağlanıyor mu?
- [ ] Eski logların TTL temizliği çalışıyor mu?
- [ ] MongoDB performansı düşmüyor mu?

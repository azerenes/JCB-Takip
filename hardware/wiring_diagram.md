# JCB Tracker - Bağlantı Şeması

> Sadece kablolama: ESP32 pin çıkışına göre kabloları bağlayın, gerisi yazılımda hazır.

---

## 1. ESP32 Pin Haritası (Genel Bakış)

```
ESP32 DevKit (38 pin)
┌─────────────────────────────┐
│  EN  [ ]              [ ] D23│─ SD_MOSI
│  VP  [●]─ ADC batarya [ ] D22│─ RTC_SCL
│  VN  [ ]              [ ] TX0│
│  D34 [●]─ CAN_INT     [ ] RX0│
│  D35 [●]─ OPTOKUPLÖR  [ ] D21│─ RTC_SDA
│  D32 [ ]              [ ] D19│─ SD_MISO
│  D33 [●]─ OPTO_INT    [ ] D18│─ SD_SCLK
│  D25 [ ]              [ ] D5 │─ CAN_CS
│  D26 [●]─ GSM_TX      [ ] D17│─ GPS_TX
│  D27 [●]─ GSM_RX      [ ] D16│─ GPS_RX
│  D14 [ ]              [ ] D4 │─ GSM_PWRKEY
│  D12 [ ]              [ ] D2 │─ SD_CS
│  D13 [ ]              [ ] D15│─ GSM_RESET
│  GND [●]─ Tüm GND     [ ] D0 │
│  VIN [●]─ 12V→5V reg  [ ] GND│
└─────────────────────────────┘
```

---

## 2. Güç Bağlantıları

### 24V → 5V Dönüşüm
```
JCB Akü (24V)
  │
  ├─(+)──[Sigorta 3A]──[LM2596 Buck Dönüştürücü]
  │                         │ IN+         OUT+ ──→ ESP32 VIN (5V)
  │                         │ IN-  ──→ GND ──→ ESP32 GND
  │                         │ OUT- ──→ GND ──→ ESP32 GND
  │
  └─(-)─────────────────────→ GND (ortak şase)
```

| Buck Giriş | Bağlantı |
|-----------|----------|
| IN+ | JCB akü (+) (24V) → 3A sigorta |
| IN- | JCB akü (-) (şase) |
| OUT+ | ESP32 VIN (5V) |
| OUT- | ESP32 GND |

> **Önemli:** LM2596 çıkışı 5V'a ayarlanmalı (trimpot ile). ESP32 VIN 5V-12V kabul eder.

### Batarya Voltajı Okuma (ADC)
```
JCB Akü (+) ──[100kΩ]──┬──[100kΩ]── GND
                        │
                    ESP32 VP (GPIO36)
```

---

## 3. Modül Bağlantıları (Pin→Pin)

### NEO-6M / NEO-7M GPS
| GPS Modülü | ESP32 | Kablo |
|-----------|-------|-------|
| VCC | 3.3V | Kırmızı |
| GND | GND | Siyah |
| TX | D16 (GPS_RX) | Yeşil |
| RX | D17 (GPS_TX) | Beyaz |

> **Not:** Bazı NEO-6M modülleri 3.3V yerine 5V ister. Modülünüze göre VCC'yi 5V veya 3.3V seçin.

---

### SIM7600 4G GSM
| SIM7600 | ESP32 | Kablo |
|---------|-------|-------|
| VCC | 5V (LM2596 çıkışı) | Kırmızı |
| GND | GND | Siyah |
| TX | D27 (GSM_RX) | Yeşil |
| RX | D26 (GSM_TX) | Beyaz |
| PWRKEY | D4 | Turuncu |
| RESET | D15 | Mor |

> **Önemli:** SIM7600 2A'e kadar çekebilir. LM2596 en az 3A çıkışlı olmalı.
> PWRKEY: Başlatmak için 1-2sn LOW çekilir. ESP32 bunu otomatik yapar.

---

### MCP2515 CAN-Bus Modülü
| MCP2515 | ESP32 | Kablo |
|---------|-------|-------|
| VCC | 5V (LM2596) | Kırmızı |
| GND | GND | Siyah |
| CS (SS) | D5 (CAN_CS) | Turuncu |
| SO (MISO) | D19 (SD_MISO) | Yeşil |
| SI (MOSI) | D23 (SD_MOSI) | Sarı |
| SCK | D18 (SD_SCLK) | Mavi |
| INT | D34 | Mor |

| MCP2515 | JCB CAN-Bus Hattı |
|---------|-------------------|
| CANH | JCB CAN-H (2.5V ortak) |
| CANL | JCB CAN-L (2.5V ortak) |
| GND | JCB Şase |

> **J1939 CAN hızı:** 250kbps (yazılımda ayarlı)

---

### Micro SD Kart Modülü (SPI)
| SD Kart | ESP32 | Kablo |
|---------|-------|-------|
| VCC | 5V (LM2596) | Kırmızı |
| GND | GND | Siyah |
| CS (SS) | D2 (SD_CS) | Turuncu |
| MOSI | D23 (SD_MOSI) | Sarı |
| MISO | D19 (SD_MISO) | Yeşil |
| SCK | D18 (SD_SCLK) | Mavi |

> **SPI Paylaşım:** SD kart ve MCP2515 aynı SPI hattını (MOSI/MISO/SCK) paylaşır.
> Her birinin kendi CS pini vardır: SD=D2, CAN=D5

---

### DS3231 RTC Modülü
| DS3231 | ESP32 | Kablo |
|--------|-------|-------|
| VCC | 3.3V | Kırmızı |
| GND | GND | Siyah |
| SDA | D21 (RTC_SDA) | Yeşil |
| SCL | D22 (RTC_SCL) | Beyaz |

> **CR2032 pil takılı olmalı** (zaman kaybını önler)

---

### PC817 Optokuplör (Eski Nesil JCB)
| PC817 | ESP32 | Kablo |
|-------|-------|-------|
| Pin 1 (Anot+) | JCB 24V(+) → [1kΩ direnç] | Kırmızı |
| Pin 2 (Katot-) | JCB Şase | Siyah |
| Pin 3 (Emiter) | GND | Siyah |
| Pin 4 (Kolektör) | D35 (OPTOKUPLOR_PIN) | Sarı |
| | Ayrıca D33→D35 arası 10kΩ pull-up | |

> **Bu sadece eski analog sayaçlı JCB'ler için.** Yeni nesil CAN-bus'lı JCB'lerde optokuplör gereksiz.

---

## 4. Özet Bağlantı Tablosu

| ESP32 Pini | Bağlı Modül | Modül Pini |
|-----------|------------|-----------|
| VIN (5V) | LM2596 Çıkış | Güç (+) |
| 3.3V | GPS, RTC | VCC |
| GND | Tüm modüller | GND |
| D2 | SD Kart | CS |
| D4 | SIM7600 | PWRKEY |
| D5 | MCP2515 | CS |
| D15 | SIM7600 | RESET |
| D16 | GPS | RX |
| D17 | GPS | TX |
| D18 | SD + CAN | SCK |
| D19 | SD + CAN | MISO |
| D21 | RTC | SDA |
| D22 | RTC | SCL |
| D23 | SD + CAN | MOSI |
| D26 | SIM7600 | TX |
| D27 | SIM7600 | RX |
| D33 | PC817 Pull-up | - |
| D34 | MCP2515 | INT |
| D35 | PC817 | Kolektör |
| VP(36) | Batarya ADC | Voltaj bölücü |

---

## 5. Test Adımları (Fiziksel Bağlantı Sonrası)

```bash
# 1. ESP32'yi USB'den bilgisayara bağla
# 2. PlatformIO ile yükle
cd firmware
pio run --target upload --environment esp32dev
pio device monitor
```

Beklenen çıktı:
```
[BOOT] JCB Tracker basliyor...
[RTC] DS3231 baslatildi.
[SD] Kart baslatildi.
[CAN] MCP2515 baslatildi.
[GPS] Modul baslatildi.
[GSM] Modul baslatildi.
[MQTT] Istemci baslatildi.
[WiFi] Modul baslatildi.
[GUC] Yonetici baslatildi.
[OPTO] PC817 baslatildi.
[BOOT] Tüm modüller baslatildi.
[LOOP] Sensor verileri okunuyor...
```

> Tüm modüllerin başarıyla başladığını doğrulayın.
> Hata varsa Serial monitor çıktısında hangi modülün hata verdiği görünür.

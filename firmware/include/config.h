#ifndef CONFIG_H
#define CONFIG_H

// ===== CİHAZ KİMLİĞİ =====
#define DEVICE_ID           "JCB-001"
#define DEVICE_API_KEY      "jcb_api_key_here"
#define FIRMWARE_VERSION    "1.0.0"

// ===== PIN TANIMLARI =====
// GPS (UART)
#define GPS_TX_PIN          17
#define GPS_RX_PIN          16

// GSM (UART)
#define GSM_TX_PIN          26
#define GSM_RX_PIN          27
#define GSM_PWRKEY_PIN      4
#define GSM_RESET_PIN       15

// CAN-BUS (SPI)
#define CAN_CS_PIN          5
#define CAN_INT_PIN         34
#define CAN_SPI_HOST        VSPI

// SD Kart (SPI)
#define SD_CS_PIN           2
#define SD_MOSI_PIN         23
#define SD_MISO_PIN         19
#define SD_SCLK_PIN         18

// RTC (I2C)
#define RTC_SDA_PIN         21
#define RTC_SCL_PIN         22

// Optokuplör (Analog/Dijital)
#define OPTOKUPLOR_PIN      35
#define OPTOKUPLOR_INT      33

// ===== ZAMAN & DÖNGÜ =====
#define LOOP_INTERVAL_MS    30000
#define GPS_TIMEOUT_MS      10000
#define GSM_TIMEOUT_MS      5000
#define DEEP_SLEEP_S        60
#define WATCHDOG_TIMEOUT_MS 60000

// ===== CAN-BUS =====
#define CAN_SPEED           250000
#define PGN_ENGINE_HOURS    65253
#define PGN_VEHICLE_HOURS   65254
#define PGN_VIN             65260
#define PGN_FUEL_LEVEL      65263

// ===== YAKIT SENSÖRÜ =====
#define FUEL_TX_PIN         13
#define FUEL_RX_PIN         14

// ===== MQTT =====
#define MQTT_BROKER         "mqtt://your-server.com"
#define MQTT_BROKER_TLS     "mqtts://your-server.com"
#define MQTT_PORT           1883
#define MQTT_PORT_TLS       8883
#define MQTT_KEEPALIVE      60
#define MQTT_TOPIC_LIVE     "jcb/" DEVICE_ID "/live"
#define MQTT_TOPIC_STATUS   "jcb/" DEVICE_ID "/status"
#define MQTT_TOPIC_CMD      "jcb/" DEVICE_ID "/cmd"
#define MQTT_TOPIC_CONFIG   "jcb/" DEVICE_ID "/config"

// ===== HTTP / API =====
#define API_BASE_URL        "https://your-server.com:3000/api"
#define API_BASE_HTTP       "http://your-server.com:3000/api"
#define API_SSL_FINGERPRINT ""
#define API_BACKLOG_ENDPOINT "/backlog"
#define API_REGISTER_ENDPOINT "/device/register"
#define API_OTA_ENDPOINT    "/ota"
#define API_CONFIG_ENDPOINT "/config"

// ===== SD KART =====
#define SD_LOG_DIR          "/jcb_logs"
#define SD_LOG_FILENAME     SD_LOG_DIR "/log.csv"
#define SD_BACKLOG_FILENAME SD_LOG_DIR "/backlog.csv"
#define SD_MAX_FILE_SIZE    1048576

// ===== WiFi (Yedek) =====
#define WIFI_SSID1          "Garaj_WiFi"
#define WIFI_PASS1          "sifre123"
#define WIFI_SSID2          "Saha_WiFi"
#define WIFI_PASS2          "sifre456"
#define WIFI_TIMEOUT_MS     15000

// ===== UYKU YÖNETİMİ =====
#define WAKEUP_PIN_BITMASK  GPIO_SEL_33
#define BATTERY_LOW_MV      3400

// ===== BİLDİRİM AYARLARI =====
#define NOTIFY_EMAIL_TO     "admin@jcbtracker.com"
#define NOTIFY_SMS_TO       "+905555555555"

#endif

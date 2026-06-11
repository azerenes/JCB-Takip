#include <Arduino.h>
#include "config.h"
#include "can_bus.h"
#include "gps.h"
#include "gsm.h"
#include "mqtt_client.h"
#include "sd_card.h"
#include "wifi_manager.h"
#include "power_manager.h"
#include "rtc.h"
#include "sensor_analog.h"
#include "ota_manager.h"
#include "watchdog.h"
#include "config_manager.h"
#include "eld_driver.h"

bool internet_available = false;
static bool gps_fix = false;
static uint32_t engine_hours = 0;
static float latitude = 0.0f;
static float longitude = 0.0f;
static float speed_kmh = 0.0f;
static int opto_count = 0;
static unsigned long last_loop = 0;
static unsigned long last_ota_check = 0;
static unsigned long last_config_fetch = 0;
static bool initial_config_done = false;

struct SensorData {
    uint32_t engine_hours;
    float latitude;
    float longitude;
    float speed_kmh;
    int opto_count;
    float battery_mv;
    float fuel_level;
    uint32_t timestamp;
};

SensorData read_sensors() {
    SensorData data = {0};

    engine_hours = can_bus_read_hours();
    if (engine_hours == 0) {
        opto_count = sensor_analog_read();
        engine_hours = opto_count * 10;
    }
    data.engine_hours = engine_hours;

    if (gps_read(&latitude, &longitude, &speed_kmh)) {
        gps_fix = true;
    }
    data.latitude = latitude;
    data.longitude = longitude;
    data.speed_kmh = speed_kmh;
    data.opto_count = opto_count;
    data.battery_mv = power_get_battery_mv();
    data.fuel_level = can_bus_read_fuel();
    data.timestamp = rtc_read_epoch();

    return data;
}

void log_to_sd(const SensorData &data) {
    char line[256];
    snprintf(line, sizeof(line), "%u,%.6f,%.6f,%.2f,%u,%u,%.0f,%.1f\n",
             data.timestamp, data.latitude, data.longitude,
             data.speed_kmh, data.engine_hours, data.opto_count,
             data.battery_mv, data.fuel_level);
    sd_card_append(SD_LOG_FILENAME, line);
}

bool check_internet() {
    if (gsm_connect()) return true;
    if (wifi_connect()) return true;
    return false;
}

void sync_backlog() {
    sd_card_upload_backlog(API_BASE_URL API_BACKLOG_ENDPOINT, DEVICE_ID, DEVICE_API_KEY);
}

void send_status_update() {
    char status[256];
    snprintf(status, sizeof(status),
             "{\"d\":\"%s\",\"bv\":%.0f,\"wifi\":\"%s\",\"gsm\":\"%s\",\"rssi\":%d,\"ver\":\"%s\"}",
             DEVICE_ID, power_get_battery_mv(),
             wifi_is_connected() ? "bagli" : "yok",
             gsm_is_connected() ? "bagli" : "yok",
             wifi_signal_strength(),
             ota_current_version().c_str());

    if (gsm_is_connected()) {
        mqtt_publish(MQTT_TOPIC_STATUS, status);
    } else if (wifi_is_connected()) {
        mqtt_publish(MQTT_TOPIC_STATUS, status);
    }
}

void send_live_data(const SensorData &data) {
    char payload[256];
    DriverStatus ds = eld_get_status_info();
    snprintf(payload, sizeof(payload),
             "{\"d\":\"%s\",\"t\":%u,\"lat\":%.6f,\"lng\":%.6f,"
             "\"s\":%.2f,\"eh\":%u,\"oc\":%d,\"bv\":%.0f,\"fl\":%.1f,"
             "\"dr\":\"%s\",\"ds\":%u}",
             DEVICE_ID, data.timestamp, data.latitude, data.longitude,
             data.speed_kmh, data.engine_hours, data.opto_count,
             data.battery_mv, data.fuel_level,
             ds.driverId.c_str(), ds.status);

    if (gsm_is_connected()) {
        mqtt_publish(MQTT_TOPIC_LIVE, payload);
    } else if (wifi_is_connected()) {
        mqtt_publish(MQTT_TOPIC_LIVE, payload);
    }
}

bool try_send_via_http(const SensorData &data) {
    char payload[512];
    DriverStatus ds = eld_get_status_info();
    snprintf(payload, sizeof(payload),
             "{\"deviceId\":\"%s\",\"timestamp\":%u,\"latitude\":%.6f,"
             "\"longitude\":%.6f,\"speedKmh\":%.2f,\"engineHours\":%u,"
             "\"optoCount\":%d,\"batteryMv\":%.0f,\"fuelLevel\":%.1f,"
             "\"driverId\":\"%s\",\"driverStatus\":%u}",
             DEVICE_ID, data.timestamp, data.latitude, data.longitude,
             data.speed_kmh, data.engine_hours, data.opto_count,
             data.battery_mv, data.fuel_level,
             ds.driverId.c_str(), ds.status);

    return http_post(API_BASE_URL API_BACKLOG_ENDPOINT, payload, DEVICE_API_KEY);
}

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("[BOOT] JCB Tracker basliyor...");
    Serial.printf("[BOOT] Versiyon: %s\n", FIRMWARE_VERSION);

    watchdog_init(WATCHDOG_TIMEOUT_MS);

    rtc_init();
    sd_card_init();
    config_manager_init();
    can_bus_init();
    gps_init();
    gsm_init();
    mqtt_init();
    wifi_init();
    power_init();
    sensor_analog_init();
    ota_init();
    eld_init();

    if (watchdog_was_reset()) {
        Serial.println("[BOOT] Onceki reset WDT kaynakli. SD log denetleniyor...");
        sd_card_check_integrity();
    }

    Serial.println("[BOOT] Tum moduller baslatildi.");
    last_loop = millis() - LOOP_INTERVAL_MS;
    last_ota_check = millis();
    last_config_fetch = millis();
}

void loop() {
    watchdog_feed();

    unsigned long now = millis();

    if (now - last_loop < LOOP_INTERVAL_MS) {
        mqtt_loop();
        delay(10);
        return;
    }
    last_loop = now;

    Serial.println("[LOOP] Sensor verileri okunuyor...");
    SensorData data = read_sensors();

    log_to_sd(data);
    Serial.println("[LOOP] SD karta kaydedildi.");

    internet_available = check_internet();

    if (internet_available) {
        if (!initial_config_done) {
            config_fetch_remote();
            initial_config_done = true;
        }

        Serial.println("[LOOP] Internet var. Backlog senkronize ediliyor...");
        sync_backlog();

        Serial.println("[LOOP] Canli veri gonderiliyor...");
        send_live_data(data);
        send_status_update();

        if (now - last_config_fetch > 3600000) {
            last_config_fetch = now;
            config_fetch_remote();
        }

        if (now - last_ota_check > 86400000) {
            last_ota_check = now;
            ota_check_update();
        }

        gsm_sleep();
        wifi_disconnect();
    } else {
        Serial.println("[LOOP] Internet yok. SD'de bekliyor.");
    }

    power_manage();
}

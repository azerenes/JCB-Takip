#include "config_manager.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <SdFat.h>
#include "config.h"

static DeviceConfig current_config;
static bool config_loaded = false;

static SdFat SD_CONFIG;

void config_manager_init() {
    memset(&current_config, 0, sizeof(current_config));
    strcpy(current_config.mqtt_broker, MQTT_BROKER);
    current_config.mqtt_port = MQTT_PORT;
    strcpy(current_config.api_base_url, API_BASE_URL);
    current_config.loop_interval_ms = LOOP_INTERVAL_MS;
    current_config.gps_timeout_ms = GPS_TIMEOUT_MS;
    current_config.speed_threshold = 90.0f;
    strcpy(current_config.wifi_ssid, WIFI_SSID1);
    strcpy(current_config.wifi_pass, WIFI_PASS1);
    strcpy(current_config.gsm_apn, "superonline");
    current_config.gsm_user[0] = '\0';
    current_config.gsm_pass[0] = '\0';
    config_loaded = true;
    Serial.println("[CFG] Varsayilan config yuklendi");
}

bool config_fetch_remote() {
    if (WiFi.status() != WL_CONNECTED) return false;

    HTTPClient http;
    char url[256];
    snprintf(url, sizeof(url), "%s/config/%s", API_BASE_URL, DEVICE_ID);

    http.begin(url);
    http.addHeader("X-API-Key", DEVICE_API_KEY);
    int code = http.GET();

    if (code != 200) {
        http.end();
        return false;
    }

    String payload = http.getString();
    http.end();

    DynamicJsonDocument doc(1024);
    DeserializationError err = deserializeJson(doc, payload);
    if (err) return false;

    if (doc.containsKey("mqtt_broker"))
        strlcpy(current_config.mqtt_broker, doc["mqtt_broker"], sizeof(current_config.mqtt_broker));
    if (doc.containsKey("mqtt_port"))
        current_config.mqtt_port = doc["mqtt_port"];
    if (doc.containsKey("loop_interval_ms"))
        current_config.loop_interval_ms = doc["loop_interval_ms"];
    if (doc.containsKey("gps_timeout_ms"))
        current_config.gps_timeout_ms = doc["gps_timeout_ms"];
    if (doc.containsKey("speed_threshold"))
        current_config.speed_threshold = doc["speed_threshold"];
    if (doc.containsKey("wifi_ssid"))
        strlcpy(current_config.wifi_ssid, doc["wifi_ssid"], sizeof(current_config.wifi_ssid));
    if (doc.containsKey("wifi_pass"))
        strlcpy(current_config.wifi_pass, doc["wifi_pass"], sizeof(current_config.wifi_pass));
    if (doc.containsKey("gsm_apn"))
        strlcpy(current_config.gsm_apn, doc["gsm_apn"], sizeof(current_config.gsm_apn));

    config_save_to_sd(&current_config);
    config_print();
    return true;
}

bool config_load_from_sd() {
    if (!SD_CONFIG.begin(SD_CS_PIN, SD_SCK_MHZ(4))) return false;

    File file = SD_CONFIG.open("/config.json", FILE_READ);
    if (!file) return false;

    StaticJsonDocument<1024> doc;
    DeserializationError err = deserializeJson(doc, file);
    file.close();

    if (err) return false;

    if (doc.containsKey("mqtt_broker"))
        strlcpy(current_config.mqtt_broker, doc["mqtt_broker"], sizeof(current_config.mqtt_broker));
    if (doc.containsKey("mqtt_port"))
        current_config.mqtt_port = doc["mqtt_port"];
    if (doc.containsKey("loop_interval_ms"))
        current_config.loop_interval_ms = doc["loop_interval_ms"];
    if (doc.containsKey("wifi_ssid"))
        strlcpy(current_config.wifi_ssid, doc["wifi_ssid"], sizeof(current_config.wifi_ssid));
    if (doc.containsKey("wifi_pass"))
        strlcpy(current_config.wifi_pass, doc["wifi_pass"], sizeof(current_config.wifi_pass));

    config_loaded = true;
    Serial.println("[CFG] SD karttan yuklendi");
    config_print();
    return true;
}

bool config_save_to_sd(const DeviceConfig *cfg) {
    if (!SD_CONFIG.begin(SD_CS_PIN, SD_SCK_MHZ(4))) return false;

    File file = SD_CONFIG.open("/config.json", FILE_WRITE);
    if (!file) return false;

    StaticJsonDocument<1024> doc;
    doc["mqtt_broker"] = cfg->mqtt_broker;
    doc["mqtt_port"] = cfg->mqtt_port;
    doc["api_base_url"] = cfg->api_base_url;
    doc["loop_interval_ms"] = cfg->loop_interval_ms;
    doc["gps_timeout_ms"] = cfg->gps_timeout_ms;
    doc["speed_threshold"] = cfg->speed_threshold;
    doc["wifi_ssid"] = cfg->wifi_ssid;
    doc["wifi_pass"] = cfg->wifi_pass;
    doc["gsm_apn"] = cfg->gsm_apn;

    serializeJson(doc, file);
    file.close();
    return true;
}

const DeviceConfig *config_get() {
    return config_loaded ? &current_config : NULL;
}

void config_print() {
    Serial.println("--- Cihaz Konfigurasyonu ---");
    Serial.printf("MQTT: %s:%d\n", current_config.mqtt_broker, current_config.mqtt_port);
    Serial.printf("API: %s\n", current_config.api_base_url);
    Serial.printf("Loop: %u ms\n", current_config.loop_interval_ms);
    Serial.printf("GPS: %u ms\n", current_config.gps_timeout_ms);
    Serial.printf("Hiz Limiti: %.1f km/h\n", current_config.speed_threshold);
    Serial.printf("WiFi: %s\n", current_config.wifi_ssid);
    Serial.printf("GSM APN: %s\n", current_config.gsm_apn);
    Serial.println("-------------------------------");
}

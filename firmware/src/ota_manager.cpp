#include "ota_manager.h"
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Update.h>
#include "config.h"

static const char *ota_server = API_BASE_URL "/ota";
static const char *current_firmware = FIRMWARE_VERSION;

void ota_init() {
    Serial.printf("[OTA] Versiyon: %s\n", current_firmware);
    Serial.printf("[OTA] Sunucu: %s\n", ota_server);
}

void ota_set_server(const char *url) {
    ota_server = url;
}

String ota_current_version() {
    return String(current_firmware);
}

bool ota_check_update() {
    if (WiFi.status() != WL_CONNECTED) return false;

    HTTPClient http;
    char url[256];
    snprintf(url, sizeof(url), "%s/check?device=%s&version=%s",
             ota_server, DEVICE_ID, current_firmware);

    http.begin(url);
    http.addHeader("X-API-Key", DEVICE_API_KEY);
    int code = http.GET();

    if (code == 200) {
        String payload = http.getString();
        http.end();

        if (payload == "null" || payload.length() < 10) return false;

        DynamicJsonDocument doc(512);
        DeserializationError err = deserializeJson(doc, payload);
        if (err) return false;

        const char *version = doc["version"];
        const char *binary_url = doc["binary_url"];

        if (version && binary_url && strcmp(version, current_firmware) != 0) {
            Serial.printf("[OTA] Yeni surum: %s\n", version);
            return ota_download_and_apply(binary_url);
        }
    } else {
        http.end();
    }
    return false;
}

bool ota_download_and_apply(const char *url) {
    if (WiFi.status() != WL_CONNECTED) return false;

    HTTPClient http;
    http.begin(url);
    http.addHeader("X-API-Key", DEVICE_API_KEY);
    int code = http.GET();

    if (code != 200) {
        Serial.printf("[OTA] Indirme hatasi: %d\n", code);
        http.end();
        return false;
    }

    int total = http.getSize();
    if (total <= 0) {
        http.end();
        return false;
    }

    if (!Update.begin(total)) {
        Serial.printf("[OTA] Alan yetersiz: %d\n", total);
        http.end();
        return false;
    }

    WiFiClient *stream = http.getStreamPtr();
    size_t written = 0;
    int last_percent = -1;

    while (http.connected() && written < total) {
        size_t available = stream->available();
        if (available) {
            uint8_t buffer[256];
            size_t read = stream->readBytes(buffer, min(available, sizeof(buffer)));
            Update.write(buffer, read);
            written += read;

            int percent = (written * 100) / total;
            if (percent != last_percent) {
                Serial.printf("[OTA] %% %d\n", percent);
                last_percent = percent;
            }
        }
        delay(10);
    }

    http.end();

    if (written != total) {
        Serial.printf("[OTA] Hata: %d/%d\n", written, total);
        Update.abort();
        return false;
    }

    if (Update.end()) {
        Serial.printf("[OTA] Basarili! Yeniden baslatiliyor...\n");
        delay(1000);
        ESP.restart();
        return true;
    }

    Serial.printf("[OTA] Dogrulama hatasi: %s\n", Update.errorString());
    Update.abort();
    return false;
}

bool ota_rollback() {
    Serial.println("[OTA] Rollback henuz desteklenmiyor");
    return false;
}

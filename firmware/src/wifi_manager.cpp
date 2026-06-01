#include "wifi_manager.h"
#include <Arduino.h>
#include <WiFi.h>
#include "config.h"
#include "gsm.h"

static bool wifi_connected = false;

void wifi_init() {
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    Serial.println("[WiFi] Modul baslatildi.");
}

bool wifi_connect() {
    if (wifi_connected && WiFi.status() == WL_CONNECTED) return true;

    WiFi.begin(WIFI_SSID1, WIFI_PASS1);
    unsigned long start = millis();
    while (millis() - start < WIFI_TIMEOUT_MS) {
        if (WiFi.status() == WL_CONNECTED) {
            wifi_connected = true;
            Serial.printf("[WiFi] Baglandi: %s (%s)\n", WIFI_SSID1, WiFi.localIP().toString().c_str());
            return true;
        }
        delay(500);
    }

    WiFi.begin(WIFI_SSID2, WIFI_PASS2);
    start = millis();
    while (millis() - start < WIFI_TIMEOUT_MS) {
        if (WiFi.status() == WL_CONNECTED) {
            wifi_connected = true;
            Serial.printf("[WiFi] Baglandi: %s (%s)\n", WIFI_SSID2, WiFi.localIP().toString().c_str());
            return true;
        }
        delay(500);
    }

    wifi_connected = false;
    Serial.println("[WiFi] Baglanti basarisiz.");
    return false;
}

bool wifi_is_connected() {
    return wifi_connected && WiFi.status() == WL_CONNECTED;
}

void wifi_disconnect() {
    if (wifi_connected) {
        WiFi.disconnect(true);
        wifi_connected = false;
        Serial.println("[WiFi] Baglanti kesildi.");
    }
}

int wifi_signal_strength() {
    if (wifi_connected) {
        return WiFi.RSSI();
    }
    return 0;
}

String wifi_scan() {
    int n = WiFi.scanNetworks();
    String result;
    for (int i = 0; i < n; i++) {
        result += WiFi.SSID(i) + " (" + WiFi.RSSI(i) + "dBm)\n";
    }
    return result;
}

bool http_post(const char *url, const char *payload, const char *api_key) {
    if (!wifi_is_connected() && !gsm_is_connected()) return false;

    WiFiClient client;
    if (!client.connect("your-server.com", 3000)) return false;

    client.println("POST " + String(url) + " HTTP/1.1");
    client.println("Host: your-server.com");
    client.println("Content-Type: application/json");
    client.println("X-API-Key: " + String(api_key));
    client.print("Content-Length: ");
    client.println(strlen(payload));
    client.println();
    client.println(payload);

    unsigned long timeout = millis() + 10000;
    while (client.available() == 0) {
        if (millis() > timeout) {
            client.stop();
            return false;
        }
    }

    client.stop();
    return true;
}

bool wifi_check_ota() {
    // OTA guncelleme kontrolu - opsiyonel
    return false;
}

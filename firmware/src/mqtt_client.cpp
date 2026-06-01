#include "mqtt_client.h"
#include <Arduino.h>
#include <PubSubClient.h>
#include "config.h"
#include "gsm.h"
#include "wifi_manager.h"

static WiFiClient wifi_client;
static PubSubClient mqtt(wifi_client);
static bool initialized = false;

void mqtt_init() {
    mqtt.setServer(MQTT_BROKER, MQTT_PORT);
    mqtt.setKeepAlive(MQTT_KEEPALIVE);
    mqtt.setCallback(mqtt_callback);
    initialized = true;
    Serial.println("[MQTT] Istemci baslatildi.");
}

bool mqtt_connect() {
    char client_id[32];
    snprintf(client_id, sizeof(client_id), "jcb_%s_%u", DEVICE_ID, random(1000, 9999));

    if (mqtt.connect(client_id)) {
        mqtt.subscribe(MQTT_TOPIC_CMD);
        mqtt.subscribe(MQTT_TOPIC_CONFIG);
        Serial.printf("[MQTT] Baglandi: %s\n", client_id);
        return true;
    }
    Serial.printf("[MQTT] Baglanti basarisiz: %d\n", mqtt.state());
    return false;
}

bool mqtt_publish(const char *topic, const char *payload) {
    if (!mqtt.connected()) {
        if (!mqtt_connect()) return false;
    }
    bool ok = mqtt.publish(topic, payload);
    if (ok) {
        Serial.printf("[MQTT] Gonderildi: %s => %s\n", topic, payload);
    }
    return ok;
}

void mqtt_callback(char *topic, byte *payload, unsigned int length) {
    char msg[128];
    memcpy(msg, payload, min(length, sizeof(msg) - 1));
    msg[length] = '\0';

    Serial.printf("[MQTT] Komut alindi: %s => %s\n", topic, msg);

    if (strstr(topic, "/cmd") != NULL) {
        if (strcmp(msg, "RESTART") == 0) {
            ESP.restart();
        } else if (strcmp(msg, "SYNC_NOW") == 0) {
            extern void sync_backlog();
            sync_backlog();
        }
    } else if (strstr(topic, "/config") != NULL) {
        // Handle remote config update
    }
}

void mqtt_loop() {
    if (initialized) {
        mqtt.loop();
    }
}

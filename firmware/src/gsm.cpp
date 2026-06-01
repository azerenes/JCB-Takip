#include "gsm.h"
#include <Arduino.h>

static HardwareSerial gsm_serial(1);
static bool connected = false;

void gsm_init() {
    gsm_serial.begin(115200, SERIAL_8N1, GSM_RX_PIN, GSM_TX_PIN);
    pinMode(GSM_PWRKEY_PIN, OUTPUT);
    pinMode(GSM_RESET_PIN, OUTPUT);

    digitalWrite(GSM_RESET_PIN, HIGH);
    delay(100);

    digitalWrite(GSM_PWRKEY_PIN, HIGH);
    delay(2000);
    digitalWrite(GSM_PWRKEY_PIN, LOW);

    Serial.println("[GSM] Modul baslatildi.");
    connected = false;
}

bool gsm_send_at(const char *cmd, const char *expected, int timeout_ms) {
    gsm_serial.println(cmd);
    unsigned long start = millis();
    while (millis() - start < timeout_ms) {
        if (gsm_serial.available()) {
            String resp = gsm_serial.readString();
            if (resp.indexOf(expected) != -1) {
                return true;
            }
        }
    }
    return false;
}

bool gsm_connect() {
    if (connected) return true;

    if (!gsm_send_at("AT", "OK", 2000)) {
        Serial.println("[GSM] Modul yanit vermiyor.");
        return false;
    }

    if (!gsm_send_at("AT+CREG?", "+CREG: 0,1", 5000) &&
        !gsm_send_at("AT+CREG?", "+CREG: 0,5", 5000)) {
        Serial.println("[GSM] Sebekeye kayit yok.");
        return false;
    }

    if (!gsm_send_at("AT+CGATT=1", "OK", 10000)) {
        Serial.println("[GSM] Paket veri eklenemedi.");
        return false;
    }

    if (!gsm_send_at("AT+SAPBR=3,1,\"CONTYPE\",\"GPRS\"", "OK", 3000)) {
        return false;
    }

    if (!gsm_send_at("AT+SAPBR=1,1", "OK", 15000)) {
        Serial.println("[GSM] APN baglantisi basarisiz.");
        return false;
    }

    connected = true;
    Serial.println("[GSM] Internet baglantisi kuruldu.");
    return true;
}

bool gsm_is_connected() {
    return connected;
}

bool gsm_send_http(const char *url, const char *payload, const char *api_key) {
    if (!connected) return false;

    char cmd[512];
    snprintf(cmd, sizeof(cmd), "AT+HTTPINIT");
    gsm_send_at(cmd, "OK", 3000);

    snprintf(cmd, sizeof(cmd), "AT+HTTPPARA=\"URL\",\"%s\"", url);
    gsm_send_at(cmd, "OK", 3000);

    snprintf(cmd, sizeof(cmd), "AT+HTTPPARA=\"CONTENT\",\"application/json\"");
    gsm_send_at(cmd, "OK", 3000);

    snprintf(cmd, sizeof(cmd), "AT+HTTPPARA=\"USERDATA\",\"X-API-Key: %s\"", api_key);
    gsm_send_at(cmd, "OK", 3000);

    snprintf(cmd, sizeof(cmd), "AT+HTTPDATA=%d,10000", strlen(payload));
    gsm_send_at(cmd, "DOWNLOAD", 5000);
    gsm_serial.println(payload);
    delay(3000);

    gsm_send_at("AT+HTTPACTION=1", "OK", 10000);

    gsm_send_at("AT+HTTPTERM", "OK", 3000);
    return true;
}

void gsm_sleep() {
    if (connected) {
        gsm_send_at("AT+CSCLK=1", "OK", 2000);
    }
}

void gsm_wake() {
    if (connected) {
        digitalWrite(GSM_PWRKEY_PIN, HIGH);
        delay(500);
        digitalWrite(GSM_PWRKEY_PIN, LOW);
    }
}

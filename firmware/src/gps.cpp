#include "gps.h"
#include <Arduino.h>
#include <TinyGPSPlus.h>

static TinyGPSPlus gps_parser;
static HardwareSerial gps_serial(2);

void gps_init() {
    gps_serial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    Serial.println("[GPS] Modul baslatildi.");
}

bool gps_read(float *lat, float *lng, float *speed) {
    unsigned long start = millis();
    while (millis() - start < GPS_TIMEOUT_MS) {
        while (gps_serial.available()) {
            char c = gps_serial.read();
            if (gps_parser.encode(c)) {
                if (gps_parser.location.isValid() && gps_parser.location.age() < 2000) {
                    *lat = gps_parser.location.lat();
                    *lng = gps_parser.location.lng();
                    *speed = gps_parser.speed.kmph();
                    return true;
                }
            }
        }
    }
    return false;
}

bool gps_get_datetime(JcbDateTime *dt) {
    if (gps_parser.date.isValid() && gps_parser.time.isValid()) {
        dt->year = gps_parser.date.year();
        dt->month = gps_parser.date.month();
        dt->day = gps_parser.date.day();
        dt->hour = gps_parser.time.hour();
        dt->minute = gps_parser.time.minute();
        dt->second = gps_parser.time.second();
        return true;
    }
    return false;
}

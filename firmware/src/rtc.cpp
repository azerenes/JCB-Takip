#include "rtc.h"
#include <Arduino.h>
#include <RTClib.h>
#include "types.h"

static RTC_DS3231 rtc_dev;
static bool rtc_found = false;

JcbDateTime rtclib_to_custom(const DateTime &dt) {
    JcbDateTime out;
    out.year = dt.year();
    out.month = dt.month();
    out.day = dt.day();
    out.hour = dt.hour();
    out.minute = dt.minute();
    out.second = dt.second();
    return out;
}

void rtc_init() {
    Wire.begin(RTC_SDA_PIN, RTC_SCL_PIN);

    if (rtc_dev.begin()) {
        if (rtc_dev.lostPower()) {
            Serial.println("[RTC] Zaman kaybi! GPS'ten senkronize edilecek.");
            rtc_dev.adjust(DateTime(F(__DATE__), F(__TIME__)));
        }
        rtc_found = true;
        Serial.println("[RTC] DS3231 baslatildi.");
    } else {
        Serial.println("[RTC] DS3231 bulunamadi!");
    }
}

JcbDateTime rtc_read() {
    if (rtc_found) {
        return rtclib_to_custom(rtc_dev.now());
    }
    JcbDateTime out = {2026, 1, 1, 0, 0, 0};
    return out;
}

bool rtc_set(const JcbDateTime &dt) {
    if (rtc_found) {
        rtc_dev.adjust(DateTime(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second));
        return true;
    }
    return false;
}

bool rtc_sync_from_gps(uint32_t epoch) {
    if (rtc_found && epoch > 1700000000) {
        rtc_dev.adjust(DateTime(epoch));
        Serial.printf("[RTC] GPS ile senkronize: %u\n", epoch);
        return true;
    }
    return false;
}

uint32_t rtc_read_epoch() {
    if (rtc_found) {
        return rtc_dev.now().unixtime();
    }
    return 0;
}

float rtc_get_temperature() {
    if (rtc_found) {
        return rtc_dev.getTemperature();
    }
    return 0.0f;
}

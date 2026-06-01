#include "power_manager.h"
#include <Arduino.h>
#include <driver/adc.h>
#include <esp_sleep.h>
#include "config.h"

// Dahili ADC ile batarya voltaji okuma
// Varsayilan: 2x 100k/100k voltage divider -> 0-3.3V = 0-6.6V
static const float ADC_REF = 3.3f;
static const float DIVIDER_RATIO = 2.0f;
static const int ADC_PIN = 36; // VP

void power_init() {
    adc1_config_width(ADC_WIDTH_BIT_12);
    adc1_config_channel_atten(ADC1_CHANNEL_0, ADC_ATTEN_DB_11);
    pinMode(OPTOKUPLOR_INT, INPUT_PULLUP);
    Serial.println("[GUC] Yonetici baslatildi.");
}

float power_get_battery_mv() {
    int raw = adc1_get_raw(ADC1_CHANNEL_0);
    float voltage = (raw / 4095.0f) * ADC_REF * DIVIDER_RATIO;
    return voltage * 1000.0f;
}

bool power_is_low() {
    return power_get_battery_mv() < BATTERY_LOW_MV;
}

void power_deep_sleep() {
    Serial.println("[GUC] Derin uykuya geciliyor...");
    Serial.flush();

    esp_sleep_enable_timer_wakeup(DEEP_SLEEP_S * 1000000ULL);
    esp_deep_sleep_start();
}

void power_light_sleep() {
    esp_light_sleep_start();
}

void power_manage() {
    static int no_internet_count = 0;

    if (power_is_low()) {
        Serial.println("[GUC] Batarya dusuk, derin uyku...");
        power_deep_sleep();
    }

    if (!internet_available) {
        no_internet_count++;
        if (no_internet_count >= 20) {
            no_internet_count = 0;
            power_deep_sleep();
        }
    } else {
        no_internet_count = 0;
    }
}

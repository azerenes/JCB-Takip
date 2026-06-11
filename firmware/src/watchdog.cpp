#include "watchdog.h"
#include <Arduino.h>
#include "esp_system.h"
#include "soc/rtc_cntl_reg.h"
#include "soc/soc.h"

static bool watchdog_enabled = false;
static uint32_t start_time = 0;

void watchdog_init(uint32_t timeout_ms) {
    if (timeout_ms == 0) return;

    esp_task_wdt_init(timeout_ms / 1000, true);
    esp_task_wdt_add(NULL);

    start_time = millis();
    watchdog_enabled = true;

    Serial.printf("[WDT] Baslatildi: %u ms\n", timeout_ms);

    if (watchdog_was_reset()) {
        Serial.println("[WDT] Onceki reset WDT kaynakli!");
    }
}

void watchdog_feed() {
    if (watchdog_enabled) {
        esp_task_wdt_reset();
    }
}

void watchdog_disable() {
    if (watchdog_enabled) {
        esp_task_wdt_delete(NULL);
        esp_task_wdt_deinit();
        watchdog_enabled = false;
        Serial.println("[WDT] Devre disi birakildi");
    }
}

bool watchdog_was_reset() {
    esp_reset_reason_t reason = esp_reset_reason();
    return reason == ESP_RST_TASK_WDT || reason == ESP_RST_WDT;
}

uint32_t watchdog_uptime_seconds() {
    return (millis() - start_time) / 1000;
}

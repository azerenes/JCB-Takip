#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include <Arduino.h>
#include <stdbool.h>

typedef struct {
    char mqtt_broker[128];
    uint16_t mqtt_port;
    char api_base_url[256];
    uint32_t loop_interval_ms;
    uint32_t gps_timeout_ms;
    float speed_threshold;
    char wifi_ssid[32];
    char wifi_pass[64];
    char gsm_apn[32];
    char gsm_user[32];
    char gsm_pass[32];
} DeviceConfig;

void config_manager_init();
bool config_fetch_remote();
bool config_load_from_sd();
bool config_save_to_sd(const DeviceConfig *cfg);
const DeviceConfig *config_get();
void config_print();

#endif

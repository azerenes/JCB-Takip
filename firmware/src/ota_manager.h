#ifndef OTA_MANAGER_H
#define OTA_MANAGER_H

#include <Arduino.h>
#include <stdbool.h>

void ota_init();
bool ota_check_update();
bool ota_download_and_apply(const char *url);
void ota_set_server(const char *url);
String ota_current_version();
bool ota_rollback();

#endif

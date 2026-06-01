#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <stdbool.h>

void wifi_init();
bool wifi_connect();
bool wifi_is_connected();
void wifi_disconnect();
int wifi_signal_strength();
String wifi_scan();
bool http_post(const char *url, const char *payload, const char *api_key);

#endif

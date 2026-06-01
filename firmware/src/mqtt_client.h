#ifndef MQTT_CLIENT_H
#define MQTT_CLIENT_H

#include <Arduino.h>

void mqtt_init();
bool mqtt_connect();
bool mqtt_publish(const char *topic, const char *payload);
void mqtt_callback(char *topic, byte *payload, unsigned int length);
void mqtt_loop();

#endif

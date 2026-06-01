#ifndef POWER_MANAGER_H
#define POWER_MANAGER_H

#include <stdbool.h>

extern bool internet_available;

void power_init();
float power_get_battery_mv();
bool power_is_low();
void power_deep_sleep();
void power_light_sleep();
void power_manage();

#endif

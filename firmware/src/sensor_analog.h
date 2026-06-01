#ifndef SENSOR_ANALOG_H
#define SENSOR_ANALOG_H

#include <stdbool.h>

void sensor_analog_init();
int sensor_analog_read();
float sensor_analog_read_voltage();
bool sensor_analog_is_machine_on();
void sensor_analog_reset();

#endif

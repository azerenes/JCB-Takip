#ifndef CAN_BUS_H
#define CAN_BUS_H

#include <stdint.h>
#include "config.h"

void can_bus_init();
uint32_t can_bus_read_hours();
float can_bus_read_fuel();
bool can_bus_read_vin(char *vin, size_t max_len);

#endif

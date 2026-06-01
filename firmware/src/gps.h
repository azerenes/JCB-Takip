#ifndef GPS_H
#define GPS_H

#include <stdint.h>
#include <stdbool.h>
#include "types.h"

void gps_init();
bool gps_read(float *lat, float *lng, float *speed);
bool gps_get_datetime(JcbDateTime *dt);

#endif

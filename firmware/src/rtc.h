#ifndef RTC_H
#define RTC_H

#include <stdbool.h>
#include <stdint.h>
#include "types.h"

void rtc_init();
JcbDateTime rtc_read();
uint32_t rtc_read_epoch();
bool rtc_set(const JcbDateTime &dt);
bool rtc_sync_from_gps(uint32_t epoch);
float rtc_get_temperature();

#endif

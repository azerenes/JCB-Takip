#ifndef WATCHDOG_H
#define WATCHDOG_H

#include <stdbool.h>
#include <stdint.h>

void watchdog_init(uint32_t timeout_ms);
void watchdog_feed();
void watchdog_disable();
bool watchdog_was_reset();
uint32_t watchdog_uptime_seconds();

#endif

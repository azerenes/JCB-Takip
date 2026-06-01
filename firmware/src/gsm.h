#ifndef GSM_H
#define GSM_H

#include <stdbool.h>
#include "config.h"

void gsm_init();
bool gsm_connect();
bool gsm_is_connected();
bool gsm_send_http(const char *url, const char *payload, const char *api_key);
void gsm_sleep();
void gsm_wake();

#endif

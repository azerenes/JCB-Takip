#ifndef SD_CARD_H
#define SD_CARD_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

void sd_card_init();
bool sd_card_append(const char *filename, const char *line);
bool sd_card_read_backlog(char *buffer, size_t bufsize, size_t *bytes_read);
bool sd_card_clear_backlog();
bool sd_card_upload_backlog(const char *api_url, const char *device_id, const char *api_key);
void sd_card_status();
void sd_card_check_integrity();

#endif

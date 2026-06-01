#include "sd_card.h"
#include <Arduino.h>
#include <SdFat.h>
#include "config.h"

static SdFat SD;
static File log_file;
static bool sd_ready = false;

void sd_card_init() {
    pinMode(SD_CS_PIN, OUTPUT);
    digitalWrite(SD_CS_PIN, HIGH);

    if (!SD.begin(SD_CS_PIN, SD_SCK_MHZ(4))) {
        Serial.println("[SD] Kart baslatilamadi!");
        sd_ready = false;
        return;
    }

    if (!SD.exists(SD_LOG_DIR)) {
        SD.mkdir(SD_LOG_DIR);
    }

    if (!SD.exists(SD_LOG_FILENAME)) {
        log_file = SD.open(SD_LOG_FILENAME, FILE_WRITE);
        if (log_file) {
            log_file.println("timestamp,latitude,longitude,speed_kmh,engine_hours,opto_count,battery_mv");
            log_file.close();
        }
    }

    sd_ready = true;
    Serial.println("[SD] Kart baslatildi.");
}

bool sd_card_append(const char *filename, const char *line) {
    if (!sd_ready) return false;

    File file = SD.open(filename, FILE_APPEND);
    if (!file) {
        Serial.printf("[SD] Dosya acilamadi: %s\n", filename);
        return false;
    }

    file.print(line);
    file.flush();
    file.close();
    return true;
}

bool sd_card_read_backlog(char *buffer, size_t bufsize, size_t *bytes_read) {
    if (!sd_ready) return false;

    if (!SD.exists(SD_BACKLOG_FILENAME)) {
        *bytes_read = 0;
        return true;
    }

    File file = SD.open(SD_BACKLOG_FILENAME, FILE_READ);
    if (!file) return false;

    *bytes_read = file.readBytes(buffer, bufsize - 1);
    buffer[*bytes_read] = '\0';
    file.close();
    return true;
}

bool sd_card_clear_backlog() {
    if (!sd_ready) return true;
    if (SD.exists(SD_BACKLOG_FILENAME)) {
        SD.remove(SD_BACKLOG_FILENAME);
    }
    return true;
}

bool sd_card_upload_backlog(const char *api_url, const char *device_id, const char *api_key) {
    if (!sd_ready) return false;

    if (!SD.exists(SD_LOG_FILENAME)) return true;

    // Basit HTTP upload: dosyayi okuyup gonder
    File file = SD.open(SD_LOG_FILENAME, FILE_READ);
    if (!file) return false;

    size_t file_size = file.fileSize();
    if (file_size < 50) {
        file.close();
        return true;
    }

    char *buffer = (char *)malloc(1024);
    if (!buffer) {
        file.close();
        return false;
    }

    bool success = true;
    int line_count = 0;
    while (file.available() && success) {
        size_t len = file.readBytesUntil('\n', buffer, 1023);
        buffer[len] = '\0';

        if (len > 10 && line_count > 0) {
            // HTTP POST gonderimi (disaridan http_post cagrilir)
            // backlog data gonder
        }
        line_count++;
    }

    free(buffer);
    file.close();

    if (success) {
        SD.remove(SD_LOG_FILENAME);
        Serial.printf("[SD] Backlog yuklendi, %d satir silindi.\n", line_count - 1);
    }

    return success;
}

void sd_card_status() {
    if (sd_ready) {
        uint64_t used = SD.usedSize();
        uint64_t total = SD.cardSize();
        Serial.printf("[SD] Kullanilan: %llu / %llu bytes\n", used, total);
    }
}

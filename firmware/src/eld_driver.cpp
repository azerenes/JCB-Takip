#include "eld_driver.h"
#include "sd_card.h"
#include "rtc.h"
#include "config.h"

static DriverStatus driver = {
    "", "", 0, 0, 0, 0, 0, 0
};

static uint32_t lastElapsedCheck = 0;
static const char* ELD_FILE = "/eld_daily.json";

static const char* status_str(uint8_t s) {
    switch (s) {
        case 0: return "off_duty";
        case 1: return "sleeper";
        case 2: return "driving";
        case 3: return "on_duty";
        default: return "off_duty";
    }
}

void eld_init() {
    String saved = sd_card_read(ELD_FILE);
    if (saved.length() > 0) {
        eld_from_json(saved);
    }
    lastElapsedCheck = rtc_read_epoch();
    Serial.println("[ELD] Baslatildi - Durum: " + String(status_str(driver.status)));
}

bool eld_set_driver(const String &id, const String &name) {
    driver.driverId = id;
    driver.driverName = name;
    Serial.printf("[ELD] Surucu atandi: %s (%s)\n", name.c_str(), id.c_str());
    String json = eld_to_json();
    sd_card_write(ELD_FILE, json);
    return true;
}

bool eld_set_status(uint8_t newStatus) {
    if (newStatus > 3) return false;

    uint32_t now = rtc_read_epoch();
    float elapsedHours = (now - driver.statusStartEpoch) / 3600.0f;

    if (driver.status == 2) driver.totalDrivingToday += elapsedHours;
    else if (driver.status == 3) driver.totalOnDutyToday += elapsedHours;
    else if (driver.status == 0) driver.totalOffDutyToday += elapsedHours;
    else if (driver.status == 1) driver.totalSleeperToday += elapsedHours;

    driver.status = newStatus;
    driver.statusStartEpoch = now;

    String json = eld_to_json();
    sd_card_write(ELD_FILE, json);

    Serial.printf("[ELD] Durum: %s (surus bugun %.1fh)\n", status_str(newStatus), driver.totalDrivingToday);
    return true;
}

uint8_t eld_get_status() { return driver.status; }
DriverStatus eld_get_status_info() { return driver; }

float eld_get_driving_hours_today() {
    uint32_t now = rtc_read_epoch();
    float elapsed = (now - driver.statusStartEpoch) / 3600.0f;
    float total = driver.totalDrivingToday;
    if (driver.status == 2) total += elapsed;
    return total;
}

float eld_get_duty_hours_today() {
    uint32_t now = rtc_read_epoch();
    float elapsed = (now - driver.statusStartEpoch) / 3600.0f;
    float total = driver.totalDrivingToday + driver.totalOnDutyToday;
    if (driver.status == 2 || driver.status == 3) total += elapsed;
    return total;
}

bool eld_is_cycle_violation() {
    return eld_get_driving_hours_today() > 11.0f || eld_get_duty_hours_today() > 14.0f;
}

void eld_reset_daily() {
    driver.totalDrivingToday = 0;
    driver.totalOnDutyToday = 0;
    driver.totalOffDutyToday = 0;
    driver.totalSleeperToday = 0;
    driver.statusStartEpoch = rtc_read_epoch();
    String json = eld_to_json();
    sd_card_write(ELD_FILE, json);
    Serial.println("[ELD] Gunluk sifirlandi");
}

String eld_to_json() {
    char buf[512];
    snprintf(buf, sizeof(buf),
        "{\"driverId\":\"%s\",\"driverName\":\"%s\",\"status\":%u,"
        "\"statusStartEpoch\":%lu,\"totalDrivingToday\":%.2f,"
        "\"totalOnDutyToday\":%.2f,\"totalOffDutyToday\":%.2f,"
        "\"totalSleeperToday\":%.2f}",
        driver.driverId.c_str(), driver.driverName.c_str(),
        driver.status, driver.statusStartEpoch,
        driver.totalDrivingToday, driver.totalOnDutyToday,
        driver.totalOffDutyToday, driver.totalSleeperToday
    );
    return String(buf);
}

bool eld_from_json(const String &json) {
    auto getVal = [&](const char* key) -> String {
        int ki = json.indexOf(key);
        if (ki < 0) return "";
        ki = json.indexOf('"', ki + strlen(key) + 2);
        if (ki < 0) return "";
        int end = json.indexOf('"', ki + 1);
        if (end < 0) return "";
        return json.substring(ki + 1, end);
    };
    auto getNum = [&](const char* key) -> float {
        int ki = json.indexOf(key);
        if (ki < 0) return 0;
        ki = json.indexOf(':', ki);
        if (ki < 0) return 0;
        int end = json.indexOf(',', ki);
        if (end < 0) end = json.indexOf('}', ki);
        if (end < 0) return 0;
        return String(json.substring(ki + 1, end)).toFloat();
    };

    driver.driverId = getVal("driverId");
    driver.driverName = getVal("driverName");
    driver.status = (uint8_t)getNum("status");
    driver.statusStartEpoch = (uint32_t)getNum("statusStartEpoch");
    driver.totalDrivingToday = getNum("totalDrivingToday");
    driver.totalOnDutyToday = getNum("totalOnDutyToday");
    driver.totalOffDutyToday = getNum("totalOffDutyToday");
    driver.totalSleeperToday = getNum("totalSleeperToday");
    return true;
}

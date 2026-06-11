#ifndef ELD_DRIVER_H
#define ELD_DRIVER_H

#include <Arduino.h>
#include <vector>

struct DriverStatus {
    String driverId;
    String driverName;
    uint8_t status; // 0=off_duty, 1=sleeper, 2=driving, 3=on_duty
    uint32_t statusStartEpoch;
    float totalDrivingToday;  // saat
    float totalOnDutyToday;   // saat
    float totalOffDutyToday;  // saat
    float totalSleeperToday;  // saat
};

void eld_init();
bool eld_set_driver(const String &id, const String &name);
bool eld_set_status(uint8_t newStatus);
uint8_t eld_get_status();
DriverStatus eld_get_status_info();
float eld_get_driving_hours_today();
float eld_get_duty_hours_today();
bool eld_is_cycle_violation();
void eld_reset_daily();
String eld_to_json();
bool eld_from_json(const String &json);

#endif

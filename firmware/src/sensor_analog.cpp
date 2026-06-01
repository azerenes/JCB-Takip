#include "sensor_analog.h"
#include <Arduino.h>
#include "config.h"

// PC817 optokuplör ile pal-sayici
// Her yukselen kenar = 1 saat calisma (veya yapilandirilabilir)
static volatile int pulse_count = 0;
static unsigned long last_pulse_us = 0;
static const int DEBOUNCE_US = 50000;

void IRAM_ATTR opto_isr() {
    unsigned long now = micros();
    if (now - last_pulse_us > DEBOUNCE_US) {
        pulse_count++;
        last_pulse_us = now;
    }
}

void sensor_analog_init() {
    pinMode(OPTOKUPLOR_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(OPTOKUPLOR_PIN), opto_isr, RISING);
    Serial.println("[OPTO] PC817 baslatildi.");
}

int sensor_analog_read() {
    int count = pulse_count;
    pulse_count = 0;
    return count;
}

float sensor_analog_read_voltage() {
    int raw = analogRead(OPTOKUPLOR_PIN);
    return (raw / 4095.0f) * 3.3f;
}

bool sensor_analog_is_machine_on() {
    return digitalRead(OPTOKUPLOR_PIN) == HIGH;
}

void sensor_analog_reset() {
    pulse_count = 0;
}

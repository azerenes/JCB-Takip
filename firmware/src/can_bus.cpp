#include "can_bus.h"
#include <Arduino.h>
#include <mcp_can.h>

static MCP_CAN CAN(CAN_CS_PIN);

void can_bus_init() {
    pinMode(CAN_INT_PIN, INPUT);
    if (CAN.begin(MCP_ANY, CAN_SPEED, MCP_16MHZ) == CAN_OK) {
        CAN.setMode(MCP_NORMAL);
        Serial.println("[CAN] MCP2515 baslatildi.");
    } else {
        Serial.println("[CAN] MCP2515 baslatilamadi!");
    }
}

uint32_t can_bus_read_hours() {
    if (digitalRead(CAN_INT_PIN) == LOW) {
        long unsigned int rxId;
        unsigned char len = 0;
        unsigned char rxBuf[8];
        CAN.readMsgBuf(&rxId, &len, rxBuf);

        if ((rxId & 0x00FFFF00) == (PGN_ENGINE_HOURS << 8)) {
            uint32_t hours = 0;
            hours |= rxBuf[0] << 24;
            hours |= rxBuf[1] << 16;
            hours |= rxBuf[2] << 8;
            hours |= rxBuf[3];
            Serial.printf("[CAN] Motor saati: %u\n", hours);
            return hours;
        }
        if ((rxId & 0x00FFFF00) == (PGN_VEHICLE_HOURS << 8)) {
            uint32_t hours = 0;
            hours |= rxBuf[0] << 24;
            hours |= rxBuf[1] << 16;
            hours |= rxBuf[2] << 8;
            hours |= rxBuf[3];
            Serial.printf("[CAN] Arac saati: %u\n", hours);
            return hours;
        }
    }
    return 0;
}

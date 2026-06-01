// JCB CAN-Bus Simulator (Arduino/ESP32)
// J1939 protokolu ile calisma saati ve sensor verileri gonderir
#include <mcp_can.h>

#define CAN_CS_PIN 5
#define CAN_INT_PIN 34
#define CAN_SPEED 250000

MCP_CAN CAN(CAN_CS_PIN);

uint32_t simulated_hours = 1250;
unsigned long last_msg = 0;

void send_j1939_message(uint32_t pgn, uint8_t priority, uint8_t *data, uint8_t len) {
    uint32_t id = (priority << 26) | (0x00 << 22) | (0xFF << 8) | pgn;
    byte buf[8];
    memcpy(buf, data, min(len, 8));
    CAN.sendMsgBuf(id, 1, len, buf);
}

void send_engine_hours() {
    uint8_t data[8] = {0};
    data[0] = (simulated_hours >> 24) & 0xFF;
    data[1] = (simulated_hours >> 16) & 0xFF;
    data[2] = (simulated_hours >> 8) & 0xFF;
    data[3] = simulated_hours & 0xFF;
    send_j1939_message(65253, 6, data, 8);
    Serial.printf("[SIM] Motor Saati: %u\n", simulated_hours);
}

void send_vehicle_speed() {
    uint8_t data[8] = {0};
    float speed = random(0, 4500) / 100.0;
    uint16_t speed_raw = speed * 256;
    data[0] = (speed_raw >> 8) & 0xFF;
    data[1] = speed_raw & 0xFF;
    send_j1939_message(65256, 6, data, 8);
}

void send_location() {
    float lat = 39.0 + random(-100, 100) / 1000.0;
    float lng = 35.0 + random(-100, 100) / 1000.0;

    int32_t lat_raw = lat * 10000000;
    int32_t lng_raw = lng * 10000000;

    uint8_t data[8] = {0};
    data[0] = (lat_raw >> 24) & 0xFF;
    data[1] = (lat_raw >> 16) & 0xFF;
    data[2] = (lat_raw >> 8) & 0xFF;
    data[3] = lat_raw & 0xFF;
    data[4] = (lng_raw >> 24) & 0xFF;
    data[5] = (lng_raw >> 16) & 0xFF;
    data[6] = (lng_raw >> 8) & 0xFF;
    data[7] = lng_raw & 0xFF;
    send_j1939_message(65140, 6, data, 8);
}

void setup() {
    Serial.begin(115200);
    Serial.println("[SIM] JCB CAN Simulator basliyor...");

    pinMode(CAN_INT_PIN, INPUT);
    if (CAN.begin(MCP_ANY, CAN_SPEED, MCP_16MHZ) == CAN_OK) {
        CAN.setMode(MCP_NORMAL);
        Serial.println("[SIM] CAN bus baslatildi.");
    } else {
        Serial.println("[SIM] CAN baslatilamadi!");
    }

    last_msg = millis();
}

void loop() {
    if (millis() - last_msg >= 30000) {
        last_msg = millis();

        simulated_hours += 1;

        send_engine_hours();
        send_vehicle_speed();
        send_location();

        Serial.println("[SIM] Veriler gonderildi.");
    }

    delay(100);
}

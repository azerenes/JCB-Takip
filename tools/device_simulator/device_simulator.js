// JCB Device Simulator
// Birden cok ESP32 cihazini simule eder (test amaciyla)
const mqtt = require('mqtt');

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
const DEVICE_COUNT = parseInt(process.env.DEVICE_COUNT) || 5;
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS) || 30000;
const API_URL = process.env.API_URL || 'http://localhost:3000';

const devices = [];
let client = null;

function randomInRange(min, max) {
    return min + Math.random() * (max - min);
}

function generateLocation(baseLat, baseLng) {
    return {
        lat: baseLat + randomInRange(-0.005, 0.005),
        lng: baseLng + randomInRange(-0.005, 0.005)
    };
}

class SimulatedDevice {
    constructor(id) {
        this.deviceId = `SIM-${String(id).padStart(3, '0')}`;
        this.name = `Simule Cihaz ${id}`;
        this.plate = `SIM-${id}`;
        this.group = 'SIMULASYON';
        this.apiKey = `sim_key_${id}`;

        // Baslangic konumu
        this.baseLat = randomInRange(36.0, 42.0);
        this.baseLng = randomInRange(26.0, 45.0);
        this.lat = this.baseLat;
        this.lng = this.baseLng;
        this.speed = 0;
        this.engineHours = randomInRange(100, 5000);
        this.batteryMv = randomInRange(3600, 4200);
        this.optoCount = Math.floor(randomInRange(0, 100));
        this.moving = Math.random() > 0.5;
    }

    update() {
        if (this.moving) {
            this.speed = randomInRange(5, 70);
            this.lat += randomInRange(-0.001, 0.001);
            this.lng += randomInRange(-0.001, 0.001);
        } else {
            this.speed = 0;
        }

        this.engineHours += randomInRange(0, 0.5);
        this.batteryMv += randomInRange(-10, 5);
        this.batteryMv = Math.max(3200, Math.min(4200, this.batteryMv));

        if (Math.random() < 0.05) {
            this.moving = !this.moving;
        }
    }

    toJSON() {
        return {
            d: this.deviceId,
            t: Math.floor(Date.now() / 1000),
            lat: parseFloat(this.lat.toFixed(6)),
            lng: parseFloat(this.lng.toFixed(6)),
            s: parseFloat(this.speed.toFixed(2)),
            eh: parseFloat(this.engineHours.toFixed(1)),
            oc: this.optoCount,
            bv: parseFloat(this.batteryMv.toFixed(0))
        };
    }

    statusJSON() {
        return {
            d: this.deviceId,
            bv: this.batteryMv,
            wifi: 'SIM',
            gsm: 'SIM',
            rssi: -randomInRange(40, 90)
        };
    }
}

async function registerDevice(device) {
    try {
        const fetch = (await import('node-fetch')).default;
        const res = await fetch(`${API_URL}/api/device/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: device.deviceId,
                name: device.name,
                plate: device.plate,
                group: device.group,
                metadata: { simulated: true }
            })
        });
        const data = await res.json();
        console.log(`[Register] ${device.deviceId}: ${data.message || 'OK'}`);
        return data;
    } catch (err) {
        console.error(`[Register] ${device.deviceId}:`, err.message);
    }
}

function connectMQTT() {
    client = mqtt.connect(MQTT_BROKER, {
        clientId: 'jcb-simulator-' + Date.now(),
        clean: true
    });

    client.on('connect', () => {
        console.log(`[MQTT] Brokera baglanildi: ${MQTT_BROKER}`);
        console.log(`[SIM] ${DEVICE_COUNT} cihaz simule ediliyor...`);
    });

    client.on('error', (err) => {
        console.error('[MQTT] Hata:', err.message);
    });
}

function simulateOnce() {
    devices.forEach(device => {
        device.update();
        const payload = JSON.stringify(device.toJSON());

        if (client && client.connected) {
            client.publish(`jcb/${device.deviceId}/live`, payload, { qos: 1 });
        }

        // Her 5 dongude bir status gonder
        if (Math.random() < 0.2) {
            const statusPayload = JSON.stringify(device.statusJSON());
            if (client && client.connected) {
                client.publish(`jcb/${device.deviceId}/status`, statusPayload, { qos: 1 });
            }
        }
    });
}

async function init() {
    console.log(`[SIM] JCB Device Simulator`);
    console.log(`[SIM] Cihaz sayisi: ${DEVICE_COUNT}`);
    console.log(`[SIM] Aralik: ${INTERVAL_MS}ms`);

    for (let i = 1; i <= DEVICE_COUNT; i++) {
        const device = new SimulatedDevice(i);
        devices.push(device);
        await registerDevice(device);
    }

    connectMQTT();

    simulateOnce();
    setInterval(simulateOnce, INTERVAL_MS);

    console.log('[SIM] Simulasyon basladi.');
}

init();

process.on('SIGINT', () => {
    console.log('\n[SIM] Kapatiliyor...');
    if (client) client.end();
    process.exit(0);
});

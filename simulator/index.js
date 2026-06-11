const mqtt = require('mqtt');

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://emqx:1883';
const API_URL = process.env.API_URL || 'http://server:3000';
const DEVICE_COUNT = parseInt(process.env.DEVICE_COUNT) || 12;
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS) || 10000;
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const TENANT_ID = process.env.TENANT_ID || '';

const devices = [];
let client = null;

function rand(min, max) { return min + Math.random() * (max - min); }

function rint(min, max) { return Math.floor(rand(min, max + 1)); }

class SimDevice {
    constructor(id) {
        const prefix = String(id).padStart(3, '0');
        this.deviceId = `SIM-${prefix}`;
        this.name = `Demo Cihaz ${id}`;
        this.plate = `34 ABC ${id}`;
        this.group = ['Kazıcı', 'Yükleyici', 'Damperli Kamyon', 'Buldogz', 'Vinç', 'Silindir'][id % 6];
        this.apiKey = `sim_key_${id}`;

        this.baseLat = [41.0082, 39.9334, 38.4192, 37.0000, 36.8969, 40.1833, 41.0800, 38.7000, 40.6500, 39.7500, 39.9200, 41.0400][id % 12] + rand(-0.5, 0.5);
        this.baseLng = [28.9784, 32.8597, 27.1384, 35.3213, 30.7133, 26.2833, 29.0200, 35.4800, 29.9400, 30.5000, 32.8600, 28.9900][id % 12] + rand(-0.5, 0.5);
        this.lat = this.baseLat;
        this.lng = this.baseLng;
        this.speed = 0;
        this.heading = rint(0, 359);
        this.engineHours = rand(10, 8000);
        this.batteryMv = rand(3700, 4200);
        this.fuelLevel = rand(10, 100);
        this.optoCount = rint(0, 200);
        this.moving = Math.random() > 0.4;
        this.engineOn = true;
        this.driver = id % 3 === 0 ? 'Mehmet Yılmaz' : id % 3 === 1 ? 'Ali Demir' : 'Veli Kaya';
        this.statusMsgs = ['Çalışıyor', 'Boşta', 'Sürüyor', 'Park Halinde'];
        this.status = this.statusMsgs[0];

        // Movement pattern - some roam, some stay local
        this.roamRadius = rand(0.002, 0.05);
        this.roamCenter = { lat: this.baseLat, lng: this.baseLng };
        this.angle = rand(0, Math.PI * 2);
    }

    update() {
        if (this.moving && this.engineOn) {
            this.angle += rand(-0.3, 0.3);
            this.lat = this.roamCenter.lat + Math.sin(this.angle) * this.roamRadius;
            this.lng = this.roamCenter.lng + Math.cos(this.angle) * this.roamRadius;
            this.speed = rand(5, 80);
            this.heading = (this.heading + rint(-10, 10)) % 360;
            this.status = this.statusMsgs[2];
        } else if (this.engineOn) {
            this.speed = 0;
            this.status = this.statusMsgs[1];
        } else {
            this.speed = 0;
            this.status = this.statusMsgs[3];
        }

        this.engineHours += rand(0, 0.5);
        this.batteryMv += rand(-20, 10);
        this.batteryMv = Math.max(3200, Math.min(4200, this.batteryMv));
        this.fuelLevel += rand(-0.5, 0.1);
        this.fuelLevel = Math.max(0, Math.min(100, this.fuelLevel));

        if (Math.random() < 0.03) this.moving = !this.moving;
        if (Math.random() < 0.02) this.engineOn = !this.engineOn;
    }

    liveJSON() {
        return {
            d: this.deviceId,
            t: Math.floor(Date.now() / 1000),
            lat: parseFloat(this.lat.toFixed(6)),
            lng: parseFloat(this.lng.toFixed(6)),
            s: parseFloat(this.speed.toFixed(1)),
            h: this.heading,
            eh: parseFloat(this.engineHours.toFixed(1)),
            fl: parseFloat(this.fuelLevel.toFixed(1)),
            bv: parseFloat(this.batteryMv.toFixed(0)),
            oc: this.optoCount,
            eng: this.engineOn ? 1 : 0,
            st: this.status
        };
    }

    statusJSON() {
        return {
            d: this.deviceId,
            bv: this.batteryMv,
            fl: this.fuelLevel,
            wifi: Math.random() > 0.1 ? 'connected' : 'disconnected',
            gsm: Math.random() > 0.05 ? 'online' : 'offline',
            rssi: -rand(40, 95),
            temp: rand(25, 65),
            driver: this.driver
        };
    }
}

async function registerDevices() {
    for (const device of devices) {
        try {
            const body = JSON.stringify({
                deviceId: device.deviceId, name: device.name, plate: device.plate,
                group: device.group, metadata: { simulated: true, driver: device.driver }
            });
            const headers = { 'Content-Type': 'application/json' };
            if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
            if (TENANT_ID) headers['X-Tenant-Id'] = TENANT_ID;

            const res = await fetch(`${API_URL}/api/device/register`, {
                method: 'POST', headers, body
            });
            const data = await res.json();
            if (res.ok) console.log(`[REG] ${device.deviceId}: OK`);
            else console.log(`[REG] ${device.deviceId}: ${data.error || '?'}`);
        } catch (err) {
            console.log(`[REG] ${device.deviceId}: ${err.message} (API hazir degil, bekliyoruz...)`);
            return false;
        }
    }
    return true;
}

function connectMQTT() {
    client = mqtt.connect(MQTT_BROKER, {
        clientId: `jcb-sim-${Date.now()}`,
        clean: true,
        reconnectPeriod: 5000
    });
    client.on('connect', () => console.log(`[MQTT] Baglandi: ${MQTT_BROKER}`));
    client.on('error', err => console.error('[MQTT]', err.message));
    client.on('close', () => console.log('[MQTT] Baglanti koptu, yeniden deneniyor...'));
}

function simulateOnce() {
    for (const device of devices) {
        device.update();
        const payload = JSON.stringify(device.liveJSON());
        if (client && client.connected) {
            client.publish(`jcb/${device.deviceId}/live`, payload, { qos: 1 });
        }
        if (Math.random() < 0.15) {
            const sp = JSON.stringify(device.statusJSON());
            if (client && client.connected) {
                client.publish(`jcb/${device.deviceId}/status`, sp, { qos: 1 });
            }
        }
    }
}

async function init() {
    console.log('=== JCB Tracker - Docker Simulator ===');
    console.log(`Cihaz: ${DEVICE_COUNT}, Aralik: ${INTERVAL_MS}ms`);
    console.log(`MQTT: ${MQTT_BROKER}, API: ${API_URL}`);

    for (let i = 1; i <= DEVICE_COUNT; i++) devices.push(new SimDevice(i));
    const registered = await registerDevices();
    if (!registered) {
        console.log('API 30sn bekleniyor...');
        await new Promise(r => setTimeout(r, 30000));
        await registerDevices();
    }
    connectMQTT();
    simulateOnce();
    setInterval(simulateOnce, INTERVAL_MS);
    console.log('[SIM] Simulasyon calisiyor...');
}

init();

process.on('SIGINT', () => { if (client) client.end(); process.exit(0); });
process.on('SIGTERM', () => { if (client) client.end(); process.exit(0); });

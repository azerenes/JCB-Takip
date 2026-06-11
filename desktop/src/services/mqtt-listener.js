const mqtt = require('mqtt');
const config = require('../config');
const Device = require('../database/models/Device');
const LocationLog = require('../database/models/LocationLog');
const geofenceService = require('./geofence');
const alertEngine = require('./alert-engine');

let client = null;
let io = null;

function init(socketIO) {
    io = socketIO;

    client = mqtt.connect(config.mqttBroker, {
        clientId: 'jcb-server-' + Date.now(),
        clean: true,
        reconnectPeriod: 5000
    });

    client.on('connect', () => {
        console.log('[MQTT] Brokera baglanildi:', config.mqttBroker);
        client.subscribe(config.mqttTopics.live, { qos: 1 });
        client.subscribe(config.mqttTopics.status, { qos: 1 });
    });

    client.on('message', async (topic, payload) => {
        try {
            const message = payload.toString();
            const parsed = JSON.parse(message);
            await handleMessage(topic, parsed);
        } catch (err) {
            console.error('[MQTT] Mesaj islenirken hata:', err.message);
        }
    });

    client.on('error', (err) => {
        console.error('[MQTT] Baglanti hatasi:', err.message);
    });

    client.on('close', () => {
        console.log('[MQTT] Baglanti kapandi');
    });
}

async function handleMessage(topic, data) {
    const topicParts = topic.split('/');
    const deviceId = topicParts[1];
    const subTopic = topicParts[2];

    if (!deviceId || !subTopic) return;

    switch (subTopic) {
        case 'live':
            await handleLiveData(deviceId, data);
            break;
        case 'status':
            await handleStatus(deviceId, data);
            break;
    }
}

async function handleLiveData(deviceId, data) {
    LocationLog.create({
        deviceId,
        timestamp: new Date((data.t || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        latitude: data.lat,
        longitude: data.lng,
        speed: data.s || 0,
        engineHours: data.eh || 0
    });

    await Device.findOneAndUpdate({ deviceId }, {
        lastLatitude: data.lat,
        lastLongitude: data.lng,
        lastSpeed: data.s || 0,
        lastEngineHours: data.eh || 0,
        lastUpdate: new Date().toISOString(),
        isOnline: 1,
        status: 'online'
    });

    if (io) {
        io.to(`device:${deviceId}`).emit('location:update', {
            deviceId,
            lat: data.lat,
            lng: data.lng,
            speed: data.s || 0,
            engineHours: data.eh || 0,
            timestamp: data.t
        });

        io.emit('live:update', {
            deviceId,
            lat: data.lat,
            lng: data.lng,
            speed: data.s || 0,
            timestamp: data.t,
            batteryMv: data.bv || 0
        });
    }

    await geofenceService.check(deviceId, data.lat, data.lng);
    await alertEngine.evaluate(deviceId, data);

    console.log(`[LIVE] ${deviceId}: ${data.lat},${data.lng} ${data.s || 0}km/h eh:${data.eh || 0}`);
}

async function handleStatus(deviceId, data) {
    console.log(`[STATUS] ${deviceId}: bat=${data.bv}mv, wifi=${data.wifi || 'n/a'}, gsm=${data.gsm || 'n/a'}`);

    if (data.bv && data.bv < 3400) {
        const Alert = require('../database/models/Alert');
        Alert.create({
            deviceId,
            type: 'battery_low',
            severity: 'warning',
            message: `Dusuk batarya: ${data.bv}mV`,
            timestamp: new Date().toISOString()
        });
    }
}

function sendCommand(deviceId, command) {
    const topic = config.mqttTopics.cmd.replace('{deviceId}', deviceId);
    if (client && client.connected) {
        client.publish(topic, command, { qos: 1 });
        console.log(`[MQTT] Komut gonderildi: ${topic} -> ${command}`);
        return true;
    }
    return false;
}

function sendConfig(deviceId, configPayload) {
    const topic = config.mqttTopics.config.replace('{deviceId}', deviceId);
    if (client && client.connected) {
        client.publish(topic, JSON.stringify(configPayload), { qos: 1 });
        console.log(`[MQTT] Konfig gonderildi: ${topic}`);
        return true;
    }
    return false;
}

module.exports = { init, sendCommand, sendConfig };



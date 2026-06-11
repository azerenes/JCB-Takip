const Alert = require('../database/models/Alert');
const Device = require('../database/models/Device');
const config = require('../config');

const deviceStates = new Map();

async function evaluate(deviceId, data) {
    try {
        const state = deviceStates.get(deviceId) || {
            lastSpeed: 0,
            lastEngineHours: 0,
            lastTimestamp: 0,
            ignitionOn: false,
            outOfHoursWarning: false,
            lastAlertTime: {}
        };

        const now = Date.now();
        const currentHour = new Date().getHours();

        // Hiz asimi kontrolu
        if (data.s && data.s > config.alert.speedThreshold) {
            await createAlert(deviceId, 'speed_exceeded',
                `Hiz asimi: ${data.s.toFixed(1)} km/h (limit: ${config.alert.speedThreshold})`,
                'warning', { speed: data.s, threshold: config.alert.speedThreshold });
        }

        // Mesai disi calisma kontrolu
        const isWorkHours = currentHour >= config.alert.workStartHour &&
                            currentHour < config.alert.workEndHour;
        if (!isWorkHours && data.s && data.s > 5 && !state.outOfHoursWarning) {
            if (!state.outOfHoursWarning) {
                await createAlert(deviceId, 'out_of_hours',
                    `Mesai disi calisma: ${currentHour}:00'de arac hareket halinde`,
                    'warning', { speed: data.s, hour: currentHour });
                state.outOfHoursWarning = true;
            }
        } else if (isWorkHours) {
            state.outOfHoursWarning = false;
        }

        // Calisma saati uyarisi
        if (data.eh && data.eh > 0) {
            const lastEH = state.lastEngineHours || data.eh;
            const diff = data.eh - lastEH;
            if (diff > 12) {
                await createAlert(deviceId, 'engine_hours_warning',
                    `Cihaz 12 saatten uzun suredir calisiyor: ${data.eh.toFixed(1)} saat`,
                    'info', { engineHours: data.eh });
            }
            state.lastEngineHours = data.eh;
        }

        // Dusuk batarya
        if (data.bv && data.bv < 3400) {
            await createAlert(deviceId, 'battery_low',
                `Dusuk batarya: ${data.bv}mV`,
                'warning', { value: data.bv, threshold: 3400 });
        }

        state.lastSpeed = data.s || 0;
        state.lastTimestamp = data.t || Math.floor(now / 1000);
        deviceStates.set(deviceId, state);

    } catch (err) {
        console.error('[AlertEngine] Degerlendirme hatasi:', err.message);
    }
}

async function createAlert(deviceId, type, message, severity, data) {
    const state = deviceStates.get(deviceId);
    if (!state) return;

    const lastAlertTime = state.lastAlertTime[type] || 0;
    if (Date.now() - lastAlertTime < 600000) return;

    try {
        Alert.create({
            deviceId,
            type,
            severity,
            message,
            timestamp: new Date().toISOString()
        });

        state.lastAlertTime[type] = Date.now();
        console.log(`[Alert] ${deviceId}: ${type} - ${message}`);
    } catch (err) {
        console.error('[Alert] Kayit hatasi:', err.message);
    }
}

async function checkDisconnectedDevices() {
    try {
        const threshold = new Date(Date.now() - 600000);
        const activeDeviceIds = await LocationLog.distinct('deviceId', {
            timestamp: { $gte: threshold }
        });

        const allDevices = await Device.find({ status: 'active' });
        for (const device of allDevices) {
            if (!activeDeviceIds.includes(device.deviceId)) {
                const state = deviceStates.get(device.deviceId);
                if (state && !state.disconnectedWarning) {
                    await createAlert(device.deviceId, 'disconnected',
                        `Cihaz 10 dakikadir bagli degil: ${device.name}`,
                        'critical', {});
                    state.disconnectedWarning = true;
                    deviceStates.set(device.deviceId, state);
                }
            }
        }
    } catch (err) {
        console.error('[AlertEngine] Disconnected check hatasi:', err.message);
    }
}

setInterval(checkDisconnectedDevices, 300000);

module.exports = { evaluate };



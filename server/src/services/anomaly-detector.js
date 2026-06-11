const AnomalyLog = require('../models/AnomalyLog');
const LocationLog = require('../models/LocationLog');
const Device = require('../models/Device');

const BASELINES = {};
const HISTORY_DAYS = 14;

function zScore(value, mean, std) {
    if (std === 0) return 0;
    return Math.abs((value - mean) / std);
}

async function detectFuelAnomalies(deviceId, logs) {
    if (logs.length < 3) return [];
    const results = [];
    const recent = logs.slice(-10);
    const fuelLevels = recent.filter(l => l.fuelLevel > 0).map(l => l.fuelLevel);

    if (fuelLevels.length < 3) return [];

    const mean = fuelLevels.reduce((a, b) => a + b, 0) / fuelLevels.length;
    const std = Math.sqrt(fuelLevels.reduce((a, b) => a + (b - mean) ** 2, 0) / fuelLevels.length);
    const last = fuelLevels[fuelLevels.length - 1];
    const prev = fuelLevels[fuelLevels.length - 2];
    const drop = prev - last;

    if (drop > 15 && zScore(last, mean, std) > 2) {
        results.push({
            deviceId, type: 'fuel_drop', severity: drop > 30 ? 'high' : 'medium',
            score: Math.min(100, drop * 3),
            title: 'Ani yakit dususu',
            description: `${drop.toFixed(1)}% yakit kaybi (${prev.toFixed(1)}% -> ${last.toFixed(1)}%)`,
            metric: { current: last, baseline: mean, threshold: prev - 10, unit: '%' },
            location: { lat: recent[recent.length - 1].latitude, lng: recent[recent.length - 1].longitude }
        });
    }

    if (last > prev + 10) {
        results.push({
            deviceId, type: 'fuel_surge', severity: 'high',
            score: 70, title: 'Yakit artisi',
            description: `${(last - prev).toFixed(1)}% yakit artisi, hirsizlik olabilir`,
            metric: { current: last, baseline: prev, threshold: prev + 5, unit: '%' },
            location: { lat: recent[recent.length - 1].latitude, lng: recent[recent.length - 1].longitude }
        });
    }

    return results;
}

async function detectSpeedAnomalies(deviceId, logs) {
    if (logs.length < 5) return [];
    const results = [];
    const recent = logs.slice(-20);
    const speeds = recent.map(l => l.speedKmh);
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const max = Math.max(...speeds);

    if (max > 60 && max > mean * 2.5) {
        results.push({
            deviceId, type: 'excessive_speed', severity: max > 80 ? 'critical' : 'high',
            score: Math.min(100, (max - mean) * 2),
            title: 'Asiri hiz',
            description: `Max ${max.toFixed(1)} km/h (ortalama ${mean.toFixed(1)} km/h)`,
            metric: { current: max, baseline: mean, threshold: mean * 2, unit: 'km/h' },
            location: { lat: recent[recent.length - 1].latitude, lng: recent[recent.length - 1].longitude }
        });
    }

    return results;
}

async function detectBatteryAnomalies(deviceId, logs) {
    if (logs.length < 3) return [];
    const results = [];
    const recent = logs.slice(-10);
    const bat = recent.filter(l => l.batteryMv > 0).map(l => l.batteryMv);

    if (bat.length < 3) return [];
    const mean = bat.reduce((a, b) => a + b, 0) / bat.length;
    const lastBat = bat[bat.length - 1];

    if (lastBat < 11000 && lastBat < mean * 0.8) {
        results.push({
            deviceId, type: 'battery_drain', severity: lastBat < 10000 ? 'critical' : 'high',
            score: Math.min(100, (mean - lastBat) / 50),
            title: 'Batarya dusuk',
            description: `${(lastBat / 1000).toFixed(1)}V (ortalama ${(mean / 1000).toFixed(1)}V)`,
            metric: { current: lastBat, baseline: mean, threshold: mean * 0.8, unit: 'mV' },
            location: { lat: recent[recent.length - 1].latitude, lng: recent[recent.length - 1].longitude }
        });
    }

    return results;
}

async function detectIdleAnomalies(deviceId, logs) {
    if (logs.length < 10) return [];
    const results = [];
    const recent = logs.slice(-30);
    const idleCount = recent.filter(l => l.speedKmh < 1 && l.engineHours > 0).length;
    const idleRatio = idleCount / recent.length;

    if (idleRatio > 0.6 && idleCount > 10) {
        results.push({
            deviceId, type: 'excessive_idle', severity: idleRatio > 0.8 ? 'high' : 'medium',
            score: Math.min(100, idleRatio * 100),
            title: 'Asiri bos calisma',
            description: `%${(idleRatio * 100).toFixed(0)} oraninda rölanti (${idleCount}/${recent.length} kayit)`,
            metric: { current: idleCount, baseline: recent.length * 0.3, threshold: recent.length * 0.6, unit: 'kayit' },
            location: { lat: recent[recent.length - 1].latitude, lng: recent[recent.length - 1].longitude }
        });
    }

    return results;
}

async function detectMaintenance(deviceId, logs) {
    if (logs.length < 5) return [];
    const results = [];
    const recent = logs.slice(-5);
    const engineHours = recent.map(l => l.engineHours).filter(h => h > 0);

    if (engineHours.length < 2) return [];
    const lastHours = engineHours[engineHours.length - 1];

    if (lastHours > 250 && lastHours % 250 < 10) {
        results.push({
            deviceId, type: 'maintenance_due', severity: lastHours % 250 < 3 ? 'high' : 'medium',
            score: 80,
            title: 'Bakim vakti',
            description: `Motor bakim periyodu: ${lastHours.toFixed(0)} saat`,
            metric: { current: lastHours, baseline: 250, threshold: 250, unit: 'saat' },
            location: { lat: recent[recent.length - 1].latitude, lng: recent[recent.length - 1].longitude }
        });
    }

    return results;
}

async function detectRouteDeviation(deviceId, logs) {
    if (logs.length < 20) return [];
    const results = [];
    const recent = logs.slice(-20);
    let totalDeviation = 0;
    let deviated = 0;

    for (let i = 2; i < recent.length; i++) {
        const p = recent[i - 2], c = recent[i - 1], n = recent[i];
        if (!p.latitude || !c.latitude || !n.latitude) continue;
        const d1 = Math.abs(c.latitude - p.latitude) + Math.abs(c.longitude - p.longitude);
        const d2 = Math.abs(n.latitude - c.latitude) + Math.abs(n.longitude - c.longitude);
        if (d2 > d1 * 5 && d2 > 0.01) {
            totalDeviation += d2;
            deviated++;
        }
    }

    if (deviated > 3 && totalDeviation > 0.05) {
        results.push({
            deviceId, type: 'route_deviation', severity: 'medium',
            score: Math.min(100, totalDeviation * 500),
            title: 'Rota sapmasi',
            description: `${deviated} noktada rotadan sapma tespit edildi`,
            metric: { current: totalDeviation, baseline: 0.01, threshold: 0.05, unit: 'derece' },
            location: { lat: recent[recent.length - 1].latitude, lng: recent[recent.length - 1].longitude }
        });
    }

    return results;
}

async function analyzeDevice(deviceId) {
    const results = [];
    const logs = await LocationLog.find({ deviceId })
        .sort({ timestamp: -1 })
        .limit(100);

    if (logs.length < 3) return [];

    const detectors = [
        detectFuelAnomalies, detectSpeedAnomalies,
        detectBatteryAnomalies, detectIdleAnomalies,
        detectMaintenance, detectRouteDeviation
    ];

    for (const detector of detectors) {
        try {
            const detected = await detector(deviceId, logs);
            for (const anomaly of detected) {
                const exists = await AnomalyLog.findOne({
                    deviceId: anomaly.deviceId,
                    type: anomaly.type,
                    createdAt: { $gte: new Date(Date.now() - 3600000) }
                });
                if (!exists) {
                    const saved = await AnomalyLog.create(anomaly);
                    results.push(saved);
                }
            }
        } catch (err) {
            console.error(`[Anomaly] Detector error for ${deviceId}:`, err.message);
        }
    }

    return results;
}

async function analyzeAllDevices() {
    const devices = await Device.find({ status: 'active' });
    const allResults = [];
    for (const device of devices) {
        const results = await analyzeDevice(device.deviceId);
        allResults.push(...results);
    }
    return allResults;
}

module.exports = { analyzeDevice, analyzeAllDevices };

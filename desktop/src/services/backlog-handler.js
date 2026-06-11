const LocationLog = require('../database/models/LocationLog');
const Device = require('../database/models/Device');

async function processBacklog(deviceId, logs) {
    if (!Array.isArray(logs) || logs.length === 0) {
        return { inserted: 0, errors: 0 };
    }

    let inserted = 0;
    let errors = 0;

    // Batch insert - 1000'erli gruplar
    const batchSize = 1000;
    for (let i = 0; i < logs.length; i += batchSize) {
        const batch = logs.slice(i, i + batchSize);
        const documents = batch.map(log => ({
            deviceId,
            timestamp: new Date((log.t || log.timestamp) * 1000),
            latitude: log.lat || log.latitude,
            longitude: log.lng || log.longitude,
            speedKmh: log.s || log.speedKmh || 0,
            engineHours: log.eh || log.engineHours || 0,
            optoCount: log.oc || log.optoCount || 0,
            batteryMv: log.bv || log.batteryMv || 0,
            ignition: log.ignition || false
        }));

        try {
            await LocationLog.insertMany(documents, { ordered: false });
            inserted += documents.length;
        } catch (err) {
            if (err.writeErrors) {
                inserted += err.insertedDocs?.length || 0;
                errors += err.writeErrors.length;
            } else {
                errors += documents.length;
                console.error('[Backlog] Batch hatasi:', err.message);
            }
        }
    }

    if (inserted > 0) {
        const lastLog = logs[logs.length - 1];
        await Device.findOneAndUpdate({ deviceId }, {
            'lastLocation.lat': lastLog.lat || lastLog.latitude,
            'lastLocation.lng': lastLog.lng || lastLog.longitude,
            'lastLocation.speed': lastLog.s || lastLog.speedKmh || 0,
            'lastLocation.engineHours': lastLog.eh || lastLog.engineHours || 0,
            'lastLocation.updatedAt': new Date()
        });
    }

    return { inserted, errors };
}

function parseCSVLine(line) {
    const parts = line.split(',');
    if (parts.length < 4) return null;

    return {
        t: parseInt(parts[0]) || Math.floor(Date.now() / 1000),
        lat: parseFloat(parts[1]),
        lng: parseFloat(parts[2]),
        s: parseFloat(parts[3]) || 0,
        eh: parseFloat(parts[4]) || 0,
        oc: parseInt(parts[5]) || 0,
        bv: parseFloat(parts[6]) || 0
    };
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const logs = [];
    let headerSkipped = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (!headerSkipped && trimmed.startsWith('timestamp')) {
            headerSkipped = true;
            continue;
        }

        const parsed = parseCSVLine(trimmed);
        if (parsed) {
            logs.push(parsed);
        }
    }

    return logs;
}

module.exports = { processBacklog, parseCSV };


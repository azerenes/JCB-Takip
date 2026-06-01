const Geofence = require('../models/Geofence');
const Alert = require('../models/Alert');
const turf = require('turf-junction');

function distance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const lastStates = new Map();

async function check(deviceId, lat, lng) {
    try {
        const geofences = await Geofence.find({ active: true });

        for (const fence of geofences) {
            const deviceInGroup = fence.devices.includes(deviceId) ||
                (fence.groups.length === 0 && fence.devices.length === 0);

            if (!deviceInGroup) continue;

            let inside = false;

            if (fence.type === 'circle') {
                const dist = distance(lat, lng, fence.center.lat, fence.center.lng);
                inside = dist <= fence.radius;
            } else if (fence.type === 'polygon' && fence.polygon.length >= 3) {
                inside = pointInPolygon(lat, lng, fence.polygon);
            }

            const key = `${deviceId}:${fence._id}`;
            const prevState = lastStates.get(key);

            if (inside && !prevState && fence.alertOnEnter) {
                await createAlert(deviceId, 'geofence_enter', `Arac ${fence.name} bolgesine girdi`, fence, lat, lng);
            } else if (!inside && prevState && fence.alertOnExit) {
                await createAlert(deviceId, 'geofence_exit', `Arac ${fence.name} bolgesinden cikti`, fence, lat, lng);
            }

            lastStates.set(key, inside);
        }
    } catch (err) {
        console.error('[Geofence] Kontrol hatasi:', err.message);
    }
}

function pointInPolygon(lat, lng, polygon) {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i].lat, yi = polygon[i].lng;
        const xj = polygon[j].lat, yj = polygon[j].lng;
        if ((yi > lng) !== (yj > lng) &&
            lat < (xj - xi) * (lng - yi) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}

async function createAlert(deviceId, type, message, fence, lat, lng) {
    const existing = await Alert.findOne({
        deviceId,
        type,
        createdAt: { $gte: new Date(Date.now() - 300000) }
    });
    if (existing) return;

    await new Alert({
        deviceId,
        type,
        severity: type.includes('enter') ? 'info' : 'warning',
        message,
        data: { latitude: lat, longitude: lng, geofenceName: fence.name }
    }).save();

    console.log(`[Geofence] ${deviceId}: ${message}`);
}

module.exports = { check };

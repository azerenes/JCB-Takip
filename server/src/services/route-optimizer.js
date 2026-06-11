// JCB Tracker - Rota Optimizasyon ve Yakit Analiz Servisi
const LocationLog = require('../models/LocationLog');
const Device = require('../models/Device');

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function calculateRouteStats(deviceId, startDate, endDate) {
    const filter = { deviceId };
    if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate);
        if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await LocationLog.find(filter)
        .sort({ timestamp: 1 })
        .lean();

    if (logs.length < 2) {
        return { totalKm: 0, avgSpeed: 0, maxSpeed: 0, idleMinutes: 0, movingMinutes: 0, fuelConsumed: 0 };
    }

    let totalKm = 0;
    let maxSpeed = 0;
    let idleMinutes = 0;
    let movingMinutes = 0;
    let speedSum = 0;
    let speedCount = 0;
    let prevFuel = null;

    for (let i = 1; i < logs.length; i++) {
        const prev = logs[i - 1];
        const curr = logs[i];

        const dist = haversine(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
        totalKm += dist;

        if (curr.speedKmh > maxSpeed) maxSpeed = curr.speedKmh;

        if (curr.speedKmh < 1) {
            idleMinutes += 0.5;
        } else {
            movingMinutes += 0.5;
            speedSum += curr.speedKmh;
            speedCount++;
        }

        if (curr.fuelLevel >= 0 && prevFuel === null) {
            prevFuel = curr.fuelLevel;
        }
    }

    const avgSpeed = speedCount > 0 ? speedSum / speedCount : 0;
    const totalHours = (movingMinutes + idleMinutes) / 60;

    // Yakit tuketimi (ortalama 15L/saat bazli)
    const fuelPerHour = 15.0;
    const fuelConsumed = (movingMinutes / 60) * fuelPerHour;

    return {
        totalKm: parseFloat(totalKm.toFixed(2)),
        avgSpeed: parseFloat(avgSpeed.toFixed(1)),
        maxSpeed: parseFloat(maxSpeed.toFixed(1)),
        idleMinutes: parseFloat(idleMinutes.toFixed(1)),
        movingMinutes: parseFloat(movingMinutes.toFixed(1)),
        totalHours: parseFloat(totalHours.toFixed(1)),
        fuelConsumed: parseFloat(fuelConsumed.toFixed(1))
    };
}

async function getDailySummary(deviceId, days = 7) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400000);

    const logs = await LocationLog.find({
        deviceId,
        timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: 1 }).lean();

    const daily = {};
    for (const log of logs) {
        const day = log.timestamp.toISOString().split('T')[0];
        if (!daily[day]) {
            daily[day] = { points: [], maxSpeed: 0, totalDistance: 0 };
        }
        daily[day].points.push(log);
        if (log.speedKmh > daily[day].maxSpeed) daily[day].maxSpeed = log.speedKmh;
    }

    const result = [];
    for (const [day, data] of Object.entries(daily)) {
        let dayDist = 0;
        for (let i = 1; i < data.points.length; i++) {
            dayDist += haversine(
                data.points[i-1].latitude, data.points[i-1].longitude,
                data.points[i].latitude, data.points[i].longitude
            );
        }
        result.push({
            date: day,
            distanceKm: parseFloat(dayDist.toFixed(2)),
            maxSpeed: parseFloat(data.maxSpeed.toFixed(1)),
            logCount: data.points.length
        });
    }

    return result;
}

async function getFuelAnalysis(deviceId, startDate, endDate) {
    const filter = { deviceId, fuelLevel: { $gte: 0 } };
    if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate);
        if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await LocationLog.find(filter)
        .sort({ timestamp: 1 })
        .select('timestamp fuelLevel engineHours')
        .lean();

    if (logs.length < 2) {
        return { avgFuelLevel: 0, minFuelLevel: 0, refuelEvents: [], estimatedConsumption: 0 };
    }

    let avgFuel = 0;
    let minFuel = 100;
    let prevEngineHours = null;
    let prevFuel = null;
    const refuelEvents = [];

    for (const log of logs) {
        avgFuel += log.fuelLevel;
        if (log.fuelLevel < minFuel) minFuel = log.fuelLevel;

        if (prevFuel !== null && log.fuelLevel > prevFuel + 10) {
            refuelEvents.push({
                timestamp: log.timestamp,
                from: prevFuel,
                to: log.fuelLevel,
                added: log.fuelLevel - prevFuel
            });
        }
        prevFuel = log.fuelLevel;
        if (log.engineHours > 0) prevEngineHours = log.engineHours;
    }

    avgFuel /= logs.length;

    return {
        avgFuelLevel: parseFloat(avgFuel.toFixed(1)),
        minFuelLevel: parseFloat(minFuel.toFixed(1)),
        refuelEvents,
        estimatedConsumption: logs.length > 1 ? 'Hesaplandi' : 'Yetersiz veri'
    };
}

module.exports = { calculateRouteStats, getDailySummary, getFuelAnalysis };

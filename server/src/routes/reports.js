const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { createObjectCsvWriter } = require('csv-writer');
const Device = require('../models/Device');
const LocationLog = require('../models/LocationLog');
const Alert = require('../models/Alert');
const auth = require('../middleware/auth');
const scope = require('../middleware/tenant-scope');
const config = require('../config');

router.get('/device-report/:deviceId', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const { start, end, format = 'json' } = req.query;
        const df = scope.deviceFilter(req);
        const device = await Device.findOne({ deviceId: req.params.deviceId, ...df });
        if (!device) return res.status(404).json({ error: 'Cihaz bulunamadi' });

        const filter = { deviceId: req.params.deviceId };
        if (start || end) {
            filter.timestamp = {};
            if (start) filter.timestamp.$gte = new Date(parseInt(start));
            if (end) filter.timestamp.$lte = new Date(parseInt(end));
        }

        const logs = await LocationLog.find(filter)
            .sort({ timestamp: 1 })
            .limit(config.export.maxRows);

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${device.deviceId}_report.csv`);

            const header = 'timestamp,latitude,longitude,speed_kmh,engine_hours,battery_mv,ignition\n';
            res.write(header);
            logs.forEach(log => {
                res.write(`${log.timestamp.toISOString()},${log.latitude},${log.longitude},${log.speedKmh},${log.engineHours},${log.batteryMv},${log.ignition}\n`);
            });
            res.end();
        } else if (format === 'pdf') {
            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${device.deviceId}_report.pdf`);
            doc.pipe(res);

            doc.fontSize(20).text(`JCB Raporu: ${device.name} (${device.deviceId})`, { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`);
            doc.text(`Plaka: ${device.plate}`);
            doc.text(`Grup: ${device.group}`);
            doc.text(`Toplam Kayit: ${logs.length}`);
            doc.moveDown();

            if (logs.length > 0) {
                const first = logs[0];
                const last = logs[logs.length - 1];
                doc.text(`Baslangic: ${first.timestamp.toLocaleDateString('tr-TR')}`);
                doc.text(`Bitis: ${last.timestamp.toLocaleDateString('tr-TR')}`);
                doc.text(`Toplam Calisma: ${(last.engineHours - first.engineHours).toFixed(1)} saat`);
                doc.moveDown();

                // Summarize by day
                const daily = {};
                logs.forEach(log => {
                    const day = log.timestamp.toISOString().split('T')[0];
                    if (!daily[day]) daily[day] = { count: 0, maxSpeed: 0, hours: 0 };
                    daily[day].count++;
                    daily[day].maxSpeed = Math.max(daily[day].maxSpeed, log.speedKmh);
                    daily[day].hours = log.engineHours;
                });

                doc.fontSize(14).text('Gunluk Ozet', { underline: true });
                doc.moveDown(0.5);
                doc.fontSize(10);
                Object.entries(daily).forEach(([day, data]) => {
                    doc.text(`${day}: ${data.count} kayit, max ${data.maxSpeed.toFixed(1)} km/h, motor ${data.hours.toFixed(1)}s`);
                });
            }

            doc.end();
        } else {
            res.json({ device, logs: logs.slice(0, 1000) });
        }
    } catch (err) {
        console.error('[Report] Hata:', err);
        res.status(500).json({ error: 'Rapor olusturulamadi' });
    }
});

router.get('/summary-report', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const { start, end } = req.query;
        const startDate = start ? new Date(parseInt(start)) : new Date(Date.now() - 7 * 86400000);
        const endDate = end ? new Date(parseInt(end)) : new Date();

        const df = scope.deviceFilter(req);
        const devices = await Device.find({ ...df, status: 'active' });
        const deviceIds = devices.map(d => d.deviceId);

        const logs = await LocationLog.aggregate([
            {
                $match: {
                    deviceId: { $in: deviceIds },
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$deviceId',
                    count: { $sum: 1 },
                    avgSpeed: { $avg: '$speedKmh' },
                    maxSpeed: { $max: '$speedKmh' },
                    firstLog: { $first: '$engineHours' },
                    lastLog: { $last: '$engineHours' }
                }
            }
        ]);

        const alerts = await Alert.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const result = devices.map(device => {
            const log = logs.find(l => l._id === device.deviceId);
            return {
                deviceId: device.deviceId,
                name: device.name,
                plate: device.plate,
                group: device.group,
                logCount: log ? log.count : 0,
                avgSpeed: log ? log.avgSpeed.toFixed(1) : 0,
                maxSpeed: log ? log.maxSpeed : 0,
                engineHoursUsed: log ? (log.lastLog - log.firstLog).toFixed(1) : 0,
                lastSeen: device.lastLocation?.updatedAt
            };
        });

        res.json({
            period: { start: startDate, end: endDate },
            totalDevices: devices.length,
            totalLogs: logs.reduce((sum, l) => sum + l.count, 0),
            totalAlerts: alerts,
            devices: result
        });
    } catch (err) {
        console.error('[Summary Report] Hata:', err);
        res.status(500).json({ error: 'Ozet rapor olusturulamadi' });
    }
});

module.exports = router;

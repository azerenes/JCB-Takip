const express = require('express');
const router = express.Router();
const DriverLog = require('../models/DriverLog');
const Device = require('../models/Device');
const auth = require('../middleware/auth');
const scope = require('../middleware/tenant-scope');
const requireRole = require('../middleware/require-role');

async function checkDeviceAccess(deviceId, req) {
    if (req.user.isSuperAdmin) return true;
    const filter = { deviceId };
    if (req.user.tenantId) filter.tenantId = req.user.tenantId;
    return !!(await Device.findOne(filter).select('_id').lean());
}

router.get('/daily/:deviceId', auth, async (req, res) => {
    try {
        if (!(await checkDeviceAccess(req.params.deviceId, req))) {
            return res.status(404).json({ error: 'Cihaz bulunamadi' });
        }
        const { date } = req.query;
        const dayStart = date ? new Date(date) : new Date();
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const logs = await DriverLog.find({
            deviceId: req.params.deviceId,
            startTime: { $gte: dayStart, $lte: dayEnd }
        }).sort({ startTime: 1 });

        const summary = { driving: 0, onDuty: 0, offDuty: 0, sleeper: 0 };
        logs.forEach(l => {
            const dur = (l.endTime || new Date()) - l.startTime;
            const hours = dur / 3600000;
            if (l.status === 'driving') summary.driving += hours;
            else if (l.status === 'on_duty') summary.onDuty += hours;
            else if (l.status === 'sleeper') summary.sleeper += hours;
            else summary.offDuty += hours;
        });

        res.json({ date: dayStart, deviceId: req.params.deviceId, logs, summary });
    } catch (err) {
        res.status(500).json({ error: 'ELD verisi alinamadi' });
    }
});

router.get('/weekly/:deviceId', auth, async (req, res) => {
    try {
        if (!(await checkDeviceAccess(req.params.deviceId, req))) {
            return res.status(404).json({ error: 'Cihaz bulunamadi' });
        }
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7);

        const logs = await DriverLog.find({
            deviceId: req.params.deviceId,
            startTime: { $gte: startDate, $lte: endDate }
        }).sort({ startTime: -1 });

        res.json({ deviceId: req.params.deviceId, period: { start: startDate, end: endDate }, logs });
    } catch (err) {
        res.status(500).json({ error: 'ELD verisi alinamadi' });
    }
});

router.get('/violations/:deviceId', auth, async (req, res) => {
    try {
        if (!(await checkDeviceAccess(req.params.deviceId, req))) {
            return res.status(404).json({ error: 'Cihaz bulunamadi' });
        }
        const violations = await DriverLog.find({
            deviceId: req.params.deviceId,
            cycleViolation: true
        }).sort({ startTime: -1 }).limit(50);
        res.json(violations);
    } catch (err) {
        res.status(500).json({ error: 'Ihlaller alinamadi' });
    }
});

router.post('/log', auth, requireRole(['admin', 'operator']), async (req, res) => {
    try {
        if (!(await checkDeviceAccess(req.body.deviceId, req))) {
            return res.status(400).json({ error: 'Gecersiz cihaz' });
        }
        const log = new DriverLog(req.body);
        await log.save();
        res.status(201).json(log);
    } catch (err) {
        res.status(500).json({ error: 'ELD kaydi olusturulamadi' });
    }
});

router.put('/log/:id', auth, requireRole(['admin', 'operator']), async (req, res) => {
    try {
        const existing = await DriverLog.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Kayit bulunamadi' });
        const deviceId = req.body.deviceId || existing.deviceId;
        if (!(await checkDeviceAccess(deviceId, req))) {
            return res.status(400).json({ error: 'Gecersiz cihaz' });
        }
        const log = await DriverLog.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(log);
    } catch (err) {
        res.status(500).json({ error: 'ELD kaydi guncellenemedi' });
    }
});

module.exports = router;

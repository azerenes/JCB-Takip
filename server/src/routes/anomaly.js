const express = require('express');
const router = express.Router();
const AnomalyLog = require('../models/AnomalyLog');
const Device = require('../models/Device');
const auth = require('../middleware/auth');
const scope = require('../middleware/tenant-scope');
const requireRole = require('../middleware/require-role');
const detector = require('../services/anomaly-detector');

router.get('/', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const { deviceId, severity, type, limit = 50, acknowledged } = req.query;
        const filter = {};
        if (deviceId) {
            if (req.tenantDeviceIds && !req.tenantDeviceIds.includes(deviceId)) return res.json([]);
            filter.deviceId = deviceId;
        } else if (req.tenantDeviceIds) {
            filter.deviceId = { $in: req.tenantDeviceIds };
        }
        if (severity) filter.severity = severity;
        if (type) filter.type = type;
        if (acknowledged === 'false') filter.acknowledged = false;
        else if (acknowledged === 'true') filter.acknowledged = true;

        const anomalies = await AnomalyLog.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));
        res.json(anomalies);
    } catch (err) {
        res.status(500).json({ error: 'Anomaliler alinamadi' });
    }
});

router.get('/stats', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const deviceIds = req.tenantDeviceIds;
        const matchStage = deviceIds ? { deviceId: { $in: deviceIds } } : {};
        const total = await AnomalyLog.countDocuments(matchStage);
        const critical = await AnomalyLog.countDocuments({ ...matchStage, severity: 'critical', acknowledged: false });
        const high = await AnomalyLog.countDocuments({ ...matchStage, severity: 'high', acknowledged: false });
        const types = await AnomalyLog.aggregate([
            { $match: matchStage },
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        const trend = await AnomalyLog.aggregate([
            {
                $match: {
                    ...matchStage,
                    createdAt: { $gte: new Date(Date.now() - 7 * 86400000) }
                }
            },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        res.json({ total, critical, high, types, trend });
    } catch (err) {
        res.status(500).json({ error: 'Anomali istatistikleri alinamadi' });
    }
});

router.put('/:id/acknowledge', auth, async (req, res) => {
    try {
        const anomaly = await AnomalyLog.findByIdAndUpdate(
            req.params.id,
            { acknowledged: true, acknowledgedBy: req.user.email || 'unknown' },
            { new: true }
        );
        if (!anomaly) return res.status(404).json({ error: 'Anomali bulunamadi' });
        res.json(anomaly);
    } catch (err) {
        res.status(500).json({ error: 'Anomali onaylanamadi' });
    }
});

router.post('/detect/:deviceId', auth, requireRole(['admin', 'operator']), async (req, res) => {
    try {
        const results = await detector.analyzeDevice(req.params.deviceId);
        res.json({ deviceId: req.params.deviceId, detected: results.length, anomalies: results });
    } catch (err) {
        res.status(500).json({ error: 'Anomali tespiti basarisiz' });
    }
});

module.exports = router;

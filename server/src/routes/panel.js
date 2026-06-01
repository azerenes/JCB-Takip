const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const LocationLog = require('../models/LocationLog');
const Alert = require('../models/Alert');
const Geofence = require('../models/Geofence');
const auth = require('../middleware/auth');

router.get('/summary', auth, async (req, res) => {
    try {
        const total = await Device.countDocuments();
        const active = await Device.countDocuments({ status: 'active' });
        const inactive = await Device.countDocuments({ status: 'inactive' });
        const maintenance = await Device.countDocuments({ status: 'maintenance' });

        const todayAlerts = await Alert.countDocuments({
            createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
        });
        const unacknowledged = await Alert.countDocuments({ acknowledged: false });
        const critical = await Alert.countDocuments({
            severity: 'critical',
            acknowledged: false
        });

        const groups = await Device.distinct('group');

        res.json({
            devices: { total, active, inactive, maintenance },
            alerts: { today: todayAlerts, unacknowledged, critical },
            groups
        });
    } catch (err) {
        console.error('[Panel] Ozet hatasi:', err);
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.get('/devices-live', auth, async (req, res) => {
    try {
        const { group } = req.query;
        const filter = {};
        if (group) filter.group = group;

        const devices = await Device.find(filter, {
            deviceId: 1, name: 1, plate: 1, group: 1, status: 1,
            'lastLocation': 1
        });

        // Son 5 dakikadaki aktif cihazlari isaretle
        const fiveMinAgo = new Date(Date.now() - 5 * 60000);
        const activeDeviceIds = await LocationLog.distinct('deviceId', {
            timestamp: { $gte: fiveMinAgo }
        });

        const result = devices.map(d => ({
            ...d.toJSON(),
            isOnline: activeDeviceIds.includes(d.deviceId)
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.get('/device-history/:deviceId', auth, async (req, res) => {
    try {
        const { start, end, limit = 1000 } = req.query;
        const filter = { deviceId: req.params.deviceId };

        if (start || end) {
            filter.timestamp = {};
            if (start) filter.timestamp.$gte = new Date(parseInt(start));
            if (end) filter.timestamp.$lte = new Date(parseInt(end));
        }

        const logs = await LocationLog.find(filter)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.get('/geofences', auth, async (req, res) => {
    try {
        const geofences = await Geofence.find({ active: true });
        res.json(geofences);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.post('/geofences', auth, async (req, res) => {
    try {
        const geofence = new Geofence(req.body);
        await geofence.save();
        res.status(201).json(geofence);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.delete('/geofences/:id', auth, async (req, res) => {
    try {
        await Geofence.findByIdAndDelete(req.params.id);
        res.json({ message: 'Geofence silindi' });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.get('/alerts', auth, async (req, res) => {
    try {
        const { deviceId, type, severity, acknowledged, limit = 100 } = req.query;
        const filter = {};
        if (deviceId) filter.deviceId = deviceId;
        if (type) filter.type = type;
        if (severity) filter.severity = severity;
        if (acknowledged !== undefined) filter.acknowledged = acknowledged === 'true';

        const alerts = await Alert.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.put('/alerts/:id/acknowledge', auth, async (req, res) => {
    try {
        const { acknowledgedBy } = req.body;
        const alert = await Alert.findByIdAndUpdate(req.params.id, {
            acknowledged: true,
            acknowledgedBy: acknowledgedBy || 'unknown',
            acknowledgedAt: new Date()
        }, { new: true });

        if (!alert) return res.status(404).json({ error: 'Uyari bulunamadi' });
        res.json(alert);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

module.exports = router;

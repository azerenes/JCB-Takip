const express = require('express');
const router = express.Router();
const Device = require('../database/models/Device');
const LocationLog = require('../database/models/LocationLog');
const Alert = require('../database/models/Alert');
const Geofence = require('../database/models/Geofence');
const auth = require('../middleware/auth');
const scope = require('../middleware/tenant-scope');

router.get('/summary', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const df = scope.deviceFilter(req);
        const total = await Device.countDocuments(df);
        const active = await Device.countDocuments({ ...df, status: 'active' });
        const inactive = await Device.countDocuments({ ...df, status: 'inactive' });
        const maintenance = await Device.countDocuments({ ...df, status: 'maintenance' });

        const deviceIds = req.tenantDeviceIds;
        const alertFilter = deviceIds ? { deviceId: { $in: deviceIds } } : {};
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayAlerts = await Alert.countDocuments({ ...alertFilter, createdAt: { $gte: todayStart } });
        const unacknowledged = await Alert.countDocuments({ ...alertFilter, acknowledged: false });
        const critical = await Alert.countDocuments({ ...alertFilter, severity: 'critical', acknowledged: false });

        const groups = await Device.distinct('group', df);

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

router.get('/devices-live', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const { group } = req.query;
        const filter = scope.deviceFilter(req);
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

router.get('/device-history/:deviceId', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const { start, end, limit = 1000 } = req.query;
        const deviceIds = req.tenantDeviceIds;
        if (deviceIds && !deviceIds.includes(req.params.deviceId)) {
            return res.status(404).json({ error: 'Cihaz bulunamadi' });
        }
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

router.get('/geofences', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const filter = { active: true };
        if (req.user.tenantId) filter.tenantId = req.user.tenantId;
        const geofences = await Geofence.find(filter);
        res.json(geofences);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.post('/geofences', auth, async (req, res) => {
    try {
        const data = { ...req.body };
        if (req.user.tenantId) data.tenantId = req.user.tenantId;
        const geofence = Geofence.create(data);
        await geofence.save();
        res.status(201).json(geofence);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.delete('/geofences/:id', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const filter = { _id: req.params.id };
        if (req.user.tenantId) filter.tenantId = req.user.tenantId;
        await Geofence.findOneAndDelete(filter);
        res.json({ message: 'Geofence silindi' });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.get('/alerts', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const { deviceId, type, severity, acknowledged, limit = 100 } = req.query;
        const deviceIds = req.tenantDeviceIds;
        const filter = {};
        if (deviceId) {
            if (deviceIds && !deviceIds.includes(deviceId)) return res.json([]);
            filter.deviceId = deviceId;
        } else if (deviceIds) {
            filter.deviceId = { $in: deviceIds };
        }
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

router.put('/alerts/:id/acknowledge', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const { acknowledgedBy } = req.body;
        const alert = await Alert.findById(req.params.id);
        if (!alert) return res.status(404).json({ error: 'Uyari bulunamadi' });
        if (req.tenantDeviceIds && !req.tenantDeviceIds.includes(alert.deviceId)) {
            return res.status(404).json({ error: 'Uyari bulunamadi' });
        }
        alert.acknowledged = true;
        alert.acknowledgedBy = acknowledgedBy || req.user.email || 'unknown';
        alert.acknowledgedAt = new Date();
        await alert.save();
        res.json(alert);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

module.exports = router;



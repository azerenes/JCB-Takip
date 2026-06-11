const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const LocationLog = require('../models/LocationLog');
const auth = require('../middleware/auth');
const scope = require('../middleware/tenant-scope');
const { v4: uuidv4 } = require('uuid');

router.post('/register', async (req, res) => {
    try {
        const { deviceId, name, plate, group, metadata } = req.body;
        if (!deviceId || !name) {
            return res.status(400).json({ error: 'deviceId ve name zorunludur' });
        }

        const existing = await Device.findOne({ deviceId });
        if (existing) {
            return res.status(409).json({ error: 'Bu deviceId zaten kayitli' });
        }

        const device = new Device({
            deviceId,
            name,
            plate: plate || '',
            apiKey: uuidv4(),
            group: group || 'Varsayilan',
            metadata: metadata || {}
        });

        await device.save();
        console.log(`[Device] Kayit: ${deviceId} -> ${device.apiKey}`);

        res.status(201).json({
            message: 'Cihaz basariyla kaydedildi',
            device: {
                deviceId: device.deviceId,
                name: device.name,
                apiKey: device.apiKey,
                group: device.group
            }
        });
    } catch (err) {
        console.error('[Device] Kayit hatasi:', err);
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.get('/', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const { group, status, search } = req.query;
        const filter = scope.deviceFilter(req);
        if (group) filter.group = group;
        if (status) filter.status = status;
        if (search) {
            filter.$or = [
                { deviceId: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { plate: { $regex: search, $options: 'i' } }
            ];
        }

        const devices = await Device.find(filter).sort({ 'lastLocation.updatedAt': -1 });
        res.json(devices);
    } catch (err) {
        console.error('[Device] Listeleme hatasi:', err);
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.get('/:deviceId', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const filter = { deviceId: req.params.deviceId, ...scope.deviceFilter(req) };
        const device = await Device.findOne(filter);
        if (!device) return res.status(404).json({ error: 'Cihaz bulunamadi' });

        const last24h = await LocationLog.countDocuments({
            deviceId: req.params.deviceId,
            timestamp: { $gte: new Date(Date.now() - 24 * 3600000) }
        });

        res.json({ ...device.toJSON(), stats: { last24hLogs: last24h } });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.put('/:deviceId', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const filter = { deviceId: req.params.deviceId, ...scope.deviceFilter(req) };
        const { name, plate, group, status, metadata } = req.body;
        const update = {};
        if (name) update.name = name;
        if (plate !== undefined) update.plate = plate;
        if (group) update.group = group;
        if (status) update.status = status;
        if (metadata) update.metadata = metadata;

        const device = await Device.findOneAndUpdate(
            filter,
            { $set: update },
            { new: true }
        );

        if (!device) return res.status(404).json({ error: 'Cihaz bulunamadi' });
        res.json(device);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.delete('/:deviceId', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const filter = { deviceId: req.params.deviceId, ...scope.deviceFilter(req) };
        const device = await Device.findOneAndDelete(filter);
        if (!device) return res.status(404).json({ error: 'Cihaz bulunamadi' });

        await LocationLog.deleteMany({ deviceId: req.params.deviceId });
        res.json({ message: 'Cihaz ve tum verileri silindi' });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.post('/backlog', async (req, res) => {
    try {
        const { deviceId, apiKey, logs } = req.body;
        if (!deviceId || !apiKey || !logs) {
            return res.status(400).json({ error: 'deviceId, apiKey ve logs zorunludur' });
        }

        const device = await Device.findOne({ deviceId, apiKey });
        if (!device) {
            return res.status(401).json({ error: 'Gecersiz kimlik bilgileri' });
        }

        if (!Array.isArray(logs) || logs.length === 0) {
            return res.status(400).json({ error: 'Log dizisi bos veya gecersiz' });
        }

        const documents = logs.map(log => ({
            deviceId,
            timestamp: new Date(log.timestamp * 1000),
            latitude: log.lat,
            longitude: log.lng,
            speedKmh: log.speed || 0,
            engineHours: log.engineHours || 0,
            optoCount: log.optoCount || 0,
            batteryMv: log.batteryMv || 0,
            ignition: log.ignition || false
        }));

        await LocationLog.insertMany(documents, { ordered: false });

        if (logs.length > 0) {
            const last = logs[logs.length - 1];
            await Device.findOneAndUpdate({ deviceId }, {
                'lastLocation.lat': last.lat,
                'lastLocation.lng': last.lng,
                'lastLocation.speed': last.speed || 0,
                'lastLocation.engineHours': last.engineHours || 0,
                'lastLocation.updatedAt': new Date(last.timestamp * 1000)
            });
        }

        console.log(`[Backlog] ${deviceId}: ${logs.length} kayit yuklendi`);
        res.json({ message: `${logs.length} kayit basariyla yuklendi`, count: logs.length });
    } catch (err) {
        console.error('[Backlog] Yukleme hatasi:', err);
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.post('/location', async (req, res) => {
    try {
        const { deviceId, apiKey, timestamp, lat, lng, speed, engineHours, batteryMv, ignition } = req.body;
        if (!deviceId || !apiKey || lat === undefined || lng === undefined) {
            return res.status(400).json({ error: 'Eksik parametreler' });
        }

        const device = await Device.findOne({ deviceId, apiKey });
        if (!device) {
            return res.status(401).json({ error: 'Gecersiz kimlik bilgileri' });
        }

        const log = new LocationLog({
            deviceId,
            timestamp: new Date((timestamp || Math.floor(Date.now() / 1000)) * 1000),
            latitude: lat,
            longitude: lng,
            speedKmh: speed || 0,
            engineHours: engineHours || 0,
            batteryMv: batteryMv || 0,
            ignition: ignition || false
        });

        await log.save();

        await Device.findOneAndUpdate({ deviceId }, {
            'lastLocation.lat': lat,
            'lastLocation.lng': lng,
            'lastLocation.speed': speed || 0,
            'lastLocation.engineHours': engineHours || 0,
            'lastLocation.updatedAt': new Date()
        });

        res.json({ message: 'Konum kaydedildi', id: log._id });
    } catch (err) {
        console.error('[Location] Kayit hatasi:', err);
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

module.exports = router;

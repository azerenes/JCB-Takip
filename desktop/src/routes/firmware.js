const express = require('express');
const router = express.Router();
const Device = require('../database/models/Device');
const auth = require('../middleware/auth');
const scope = require('../middleware/tenant-scope');

router.get('/config/:deviceId', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const filter = { deviceId: req.params.deviceId, ...scope.deviceFilter(req) };
        const device = await Device.findOne(filter);
        if (!device) return res.status(404).json({ error: 'Cihaz bulunamadi' });

        const config = {
            deviceId: device.deviceId,
            apiKey: device.apiKey,
            server: {
                api: `${req.protocol}://${req.get('host')}/api`,
                mqtt: process.env.MQTT_BROKER ? process.env.MQTT_BROKER.replace('mqtt://', '').split(':')[0] : req.hostname,
                mqttPort: parseInt(process.env.MQTT_PORT) || 1883,
                wsMqtt: process.env.MQTT_WS_BROKER || '',
            },
            gps: {
                intervalMs: device.metadata?.loopIntervalMs || 30000,
                timeoutMs: device.metadata?.gpsTimeoutMs || 10000,
            },
            wifi: {
                ssid: device.metadata?.wifiSsid || '',
                password: '',
            },
            gsm: {
                apn: device.metadata?.gsmApn || 'superonline',
            },
            thresholds: {
                speedKmh: device.metadata?.speedThreshold || 90,
                batteryLowMv: 3500,
                engineTempHigh: 105,
            },
            firmware: {
                version: '2.0.0',
                updateUrl: `${req.protocol}://${req.get('host')}/api/ota/check`,
            }
        };

        res.json(config);
    } catch (err) {
        res.status(500).json({ error: 'Firmware config alinamadi' });
    }
});

router.get('/template/:type', auth, async (req, res) => {
    const templates = {
        truck: { name: 'Kamyon', loopIntervalMs: 30000, gpsTimeoutMs: 10000, speedThreshold: 90, gsmApn: 'superonline' },
        bus: { name: 'Otobus', loopIntervalMs: 15000, gpsTimeoutMs: 8000, speedThreshold: 100, gsmApn: 'superonline' },
        construction: { name: 'Is Makinesi', loopIntervalMs: 60000, gpsTimeoutMs: 15000, speedThreshold: 40, gsmApn: 'superonline' },
        trailer: { name: 'Dorse', loopIntervalMs: 120000, gpsTimeoutMs: 20000, speedThreshold: 90, gsmApn: 'superonline' },
    };
    const t = templates[req.params.type];
    if (!t) return res.status(404).json({ error: 'Sablon bulunamadi' });
    res.json(t);
});

module.exports = router;


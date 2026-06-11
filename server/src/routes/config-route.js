const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const auth = require('../middleware/auth');
const scope = require('../middleware/tenant-scope');
const requireRole = require('../middleware/require-role');

router.get('/:deviceId', auth, scope.scopeMiddleware, async (req, res) => {
    try {
        const filter = { deviceId: req.params.deviceId, ...scope.deviceFilter(req) };
        const device = await Device.findOne(filter);
        if (!device) {
            return res.status(404).json({ error: 'Cihaz bulunamadi' });
        }

        const config = {
            mqtt_broker: process.env.MQTT_BROKER || 'mqtt://your-server.com',
            mqtt_port: parseInt(process.env.MQTT_PORT) || 1883,
            loop_interval_ms: 30000,
            gps_timeout_ms: 10000,
            speed_threshold: 90.0,
            wifi_ssid: device.metadata?.wifiSsid || '',
            gsm_apn: device.metadata?.gsmApn || 'superonline'
        };

        res.json(config);
    } catch (err) {
        res.status(500).json({ error: 'Config alinamadi' });
    }
});

router.put('/:deviceId', auth, scope.scopeMiddleware, requireRole('operator'), async (req, res) => {
    try {
        const { loop_interval_ms, gps_timeout_ms, speed_threshold, wifi_ssid, wifi_pass, gsm_apn } = req.body;
        const metadata = {};

        if (loop_interval_ms) metadata.loopIntervalMs = loop_interval_ms;
        if (gps_timeout_ms) metadata.gpsTimeoutMs = gps_timeout_ms;
        if (speed_threshold) metadata.speedThreshold = speed_threshold;
        if (wifi_ssid) metadata.wifiSsid = wifi_ssid;
        if (wifi_pass) metadata.wifiPass = wifi_pass;
        if (gsm_apn) metadata.gsmApn = gsm_apn;

        const filter = { deviceId: req.params.deviceId, ...scope.deviceFilter(req) };
        const device = await Device.findOneAndUpdate(
            filter,
            { $set: { metadata } },
            { new: true }
        );

        if (!device) return res.status(404).json({ error: 'Cihaz bulunamadi' });
        res.json({ message: 'Config guncellendi', deviceId: device.deviceId });
    } catch (err) {
        res.status(500).json({ error: 'Config guncellenemedi' });
    }
});

module.exports = router;

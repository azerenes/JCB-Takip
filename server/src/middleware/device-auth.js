const Device = require('../models/Device');

module.exports = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.body?.apiKey;
    const deviceId = req.headers['x-device-id'] || req.body?.deviceId;

    if (!apiKey || !deviceId) {
        return res.status(401).json({ error: 'API Key ve Device ID gerekli' });
    }

    try {
        const device = await Device.findOne({ deviceId, apiKey });
        if (!device) {
            return res.status(403).json({ error: 'Gecersiz cihaz kimligi' });
        }
        req.device = device;
        next();
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
};

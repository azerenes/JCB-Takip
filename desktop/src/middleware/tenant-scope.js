// Tenant kapsaminda veri filtreleme yardimcisi
// Kullanicinin sadece kendi tenant'ina ait verileri gormesini saglar
const Device = require('../database/models/Device');

module.exports = {
    // Device sorgulari icin tenantId filtreleme
    deviceFilter(req) {
        if (!req.user) return {};
        if (req.user.isSuperAdmin) return {};
        if (req.user.tenantId) return { tenantId: req.user.tenantId };
        return {};
    },

    // deviceId uzerinden tenant filtreleme (Alert, LocationLog vb. icin)
    async deviceIdsForTenant(req) {
        if (!req.user) return [];
        if (req.user.isSuperAdmin) return null; // null = tum cihazlar

        const filter = {};
        if (req.user.tenantId) filter.tenantId = req.user.tenantId;

        const devices = await Device.find(filter).select('deviceId').lean();
        const ids = devices.map(d => d.deviceId);
        if (ids.length === 0) return ['__none__']; // hic cihaz yoksa eslesmeyen deger
        return ids;
    },

    // Express middleware: req.tenantDeviceIds'i doldurur
    async scopeMiddleware(req, res, next) {
        try {
            req.tenantDeviceIds = await module.exports.deviceIdsForTenant(req);
            next();
        } catch (err) {
            res.status(500).json({ error: 'Veri erisim hatasi' });
        }
    }
};




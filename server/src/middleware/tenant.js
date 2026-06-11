const Tenant = require('../models/Tenant');

module.exports = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Giris yapilmadi' });
    }

    const tenantId = req.user.tenantId || req.headers['x-tenant-id'];
    if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID gerekli' });
    }

    try {
        const tenant = await Tenant.findById(tenantId);
        if (!tenant || !tenant.isActive) {
            return res.status(403).json({ error: 'Hesap aktif degil veya bulunamadi' });
        }
        if (tenant.isExpired()) {
            return res.status(403).json({ error: 'Lisans suresi dolmus', code: 'LICENSE_EXPIRED' });
        }
        req.tenant = tenant;

        if (req.method !== 'GET') {
            tenant.stats.lastActive = new Date();
            await tenant.save();
        }

        next();
    } catch (err) {
        return res.status(500).json({ error: 'Tenant dogrulama hatasi' });
    }
};

module.exports.requireTenant = (req, res, next) => {
    if (!req.tenant) {
        return res.status(403).json({ error: 'Gecerli bir tenant bulunamadi' });
    }
    next();
};

module.exports.checkDeviceLimit = async (req, res, next) => {
    if (req.tenant && !req.tenant.canAddDevice()) {
        return res.status(403).json({
            error: 'Cihaz limitine ulasildi',
            code: 'DEVICE_LIMIT',
            limit: req.tenant.license.deviceLimit
        });
    }
    next();
};

module.exports.superAdminOnly = (req, res, next) => {
    if (!req.user || !req.user.isSuperAdmin) {
        return res.status(403).json({ error: 'Super admin yetkisi gerekli' });
    }
    next();
};

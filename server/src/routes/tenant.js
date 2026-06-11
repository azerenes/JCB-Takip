const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const tenantMw = require('../middleware/tenant');
const Tenant = require('../models/Tenant');

router.get('/my', auth, async (req, res) => {
    if (!req.user.tenantId) return res.status(400).json({ error: 'Tenant baglantisi yok' });
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant bulunamadi' });
    res.json(tenant);
});

router.put('/branding', auth, tenantMw, async (req, res) => {
    const { logoUrl, primaryColor, companyTagline } = req.body;
    req.tenant.branding = { logoUrl, primaryColor, companyTagline };
    await req.tenant.save();
    res.json(req.tenant.branding);
});

router.get('/limits', auth, tenantMw, (req, res) => {
    res.json({
        deviceLimit: req.tenant.license.deviceLimit,
        deviceCount: req.tenant.stats.deviceCount,
        userLimit: req.tenant.license.userLimit,
        userCount: req.tenant.stats.userCount,
        expiresAt: req.tenant.license.expiresAt,
        type: req.tenant.license.type
    });
});

router.post('/register', async (req, res) => {
    const { companyName, contactEmail, password } = req.body;
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);

    if (await Tenant.findOne({ slug })) return res.status(400).json({ error: 'Bu firma adi zaten kayitli' });

    const cfg = { deviceLimit: 50, userLimit: 10, durationDays: 30 };

    const tenant = await Tenant.create({
        companyName, slug, contactEmail,
        license: {
            type: plan, deviceLimit: cfg.deviceLimit, userLimit: cfg.userLimit,
            activatedAt: new Date(),
            expiresAt: new Date(Date.now() + cfg.durationDays * 86400000)
        }
    });

    const User = require('../models/User');
    const adminUser = await User.create({
        tenantId: tenant._id,
        email: contactEmail,
        password,
        name: 'Admin',
        role: 'admin',
        permissions: {
            canManageDevices: true, canViewReports: true, canExportData: true,
            canManageUsers: true, canUpdateFirmware: true, canConfigureAlerts: true
        }
    });

    res.status(201).json({ tenant, user: { id: adminUser._id, email: adminUser.email, name: adminUser.name } });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { superAdminOnly } = require('../middleware/tenant');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Device = require('../models/Device');
const LicenseActivation = require('../models/LicenseActivation');

const sa = [auth, superAdminOnly];

router.get('/tenants', sa, async (req, res) => {
    try {
        const tenants = await Tenant.find().sort({ createdAt: -1 });
        res.json(tenants);
    } catch (err) { res.status(500).json({ error: 'Sunucu hatasi' }); }
});

router.get('/tenants/:id', sa, async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Tenant bulunamadi' });
        const users = await User.find({ tenantId: tenant._id }).select('-password');
        const devices = await Device.find({ tenantId: tenant._id });
        res.json({ tenant, users, devices });
    } catch (err) { res.status(500).json({ error: 'Sunucu hatasi' }); }
});

router.post('/tenants', sa, async (req, res) => {
    try {
        const { companyName, slug, contactEmail, contactPhone, address, taxNumber, license } = req.body;
        if (await Tenant.findOne({ slug })) return res.status(400).json({ error: 'Bu slug zaten kullaniliyor' });
        const tenant = await Tenant.create({
            companyName, slug, contactEmail, contactPhone, address, taxNumber,
            license: {
                type: license?.type || 'trial',
                deviceLimit: license?.deviceLimit || 5,
                userLimit: license?.userLimit || 3,
                expiresAt: license?.expiresAt || new Date(Date.now() + 30 * 86400000),
                activatedAt: new Date()
            }
        });
        res.status(201).json(tenant);
    } catch (err) { res.status(500).json({ error: 'Sunucu hatasi' }); }
});

router.put('/tenants/:id', sa, async (req, res) => {
    try {
        const tenant = await Tenant.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!tenant) return res.status(404).json({ error: 'Tenant bulunamadi' });
        res.json(tenant);
    } catch (err) { res.status(500).json({ error: 'Sunucu hatasi' }); }
});

router.delete('/tenants/:id', sa, async (req, res) => {
    try {
        await Device.deleteMany({ tenantId: req.params.id });
        await User.deleteMany({ tenantId: req.params.id });
        await Tenant.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Sunucu hatasi' }); }
});

router.get('/tenants/:id/stats', sa, async (req, res) => {
    try {
        const tenantDevices = await Device.find({ tenantId: req.params.id }).select('deviceId').lean();
        const deviceIds = tenantDevices.map(d => d.deviceId);
        const [deviceCount, userCount, alertCount] = await Promise.all([
            Device.countDocuments({ tenantId: req.params.id }),
            User.countDocuments({ tenantId: req.params.id }),
            deviceIds.length ? require('../models/Alert').countDocuments({ deviceId: { $in: deviceIds } }) : 0
        ]);
        res.json({ deviceCount, userCount, alertCount });
    } catch (err) { res.status(500).json({ error: 'Sunucu hatasi' }); }
});

router.post('/licenses/generate', sa, async (req, res) => {
    try {
        const { count = 1, type = 'trial', deviceLimit = 5, userLimit = 3, durationDays = 30 } = req.body;
        const keys = LicenseActivation.generateBulk(count, type, deviceLimit, userLimit, durationDays);
        const licenses = await LicenseActivation.insertMany(keys);
        res.status(201).json(licenses);
    } catch (err) { res.status(500).json({ error: 'Lisans olusturulamadi' }); }
});

router.get('/licenses', sa, async (req, res) => {
    try {
        const licenses = await LicenseActivation.find().sort({ createdAt: -1 });
        res.json(licenses);
    } catch (err) { res.status(500).json({ error: 'Sunucu hatasi' }); }
});

router.post('/licenses/:key/activate', sa, async (req, res) => {
    try {
        const { tenantSlug } = req.body;
        const license = await LicenseActivation.findOne({ key: req.params.key });
        if (!license) return res.status(404).json({ error: 'Gecersiz aktivasyon kodu' });
        if (license.isUsed) return res.status(400).json({ error: 'Bu kod daha once kullanilmis' });

        const tenant = await Tenant.findOne({ slug: tenantSlug });
        if (!tenant) return res.status(404).json({ error: 'Tenant bulunamadi' });

        license.isUsed = true;
        license.tenantSlug = tenantSlug;
        license.activatedAt = new Date();
        license.expiresAt = new Date(Date.now() + license.durationDays * 86400000);
        await license.save();

        tenant.license.type = license.type;
        tenant.license.deviceLimit = license.deviceLimit;
        tenant.license.userLimit = license.userLimit;
        tenant.license.expiresAt = license.expiresAt;
        tenant.license.activatedAt = license.activatedAt;
        tenant.license.activationKey = license.key;
        await tenant.save();

        res.json({ success: true, tenant });
    } catch (err) { res.status(500).json({ error: 'Lisans aktif edilemedi' }); }
});

router.get('/dashboard', sa, async (req, res) => {
    try {
        const [totalTenants, totalDevices, totalUsers, activeTenants, trialTenants] = await Promise.all([
            Tenant.countDocuments(),
            Device.countDocuments(),
            User.countDocuments({ isSuperAdmin: { $ne: true } }),
            Tenant.countDocuments({ isActive: true }),
            Tenant.countDocuments({ 'license.type': 'trial' })
        ]);
        res.json({ totalTenants, totalDevices, totalUsers, activeTenants, trialTenants });
    } catch (err) { res.status(500).json({ error: 'Sunucu hatasi' }); }
});

module.exports = router;

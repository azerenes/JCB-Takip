const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const SystemConfig = require('../models/SystemConfig');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const config = require('../config');

function validateLicenseKey(key, type, deviceLimit, userLimit) {
    if (!key || key.split('-').length !== 5) return false;
    const parts = key.split('-');
    if (parts[0] !== 'JCB') return false;
    const data = `${type}|${deviceLimit}|${userLimit}|${config.jwtSecret}`;
    const expectedSuffix = crypto.createHash('sha256').update(data).digest('hex').substring(0, 6).toUpperCase();
    if (parts[4] !== expectedSuffix) return false;
    return true;
}

router.get('/status', async (req, res) => {
    try {
        const cfg = await SystemConfig.findOne();
        const adminExists = await User.countDocuments({ isSuperAdmin: true });
        res.json({
            setupComplete: cfg ? cfg.setupComplete : false,
            setupStep: cfg ? cfg.setupStep : 0,
            hasAdmin: adminExists > 0,
            systemName: cfg?.companyName || 'JCB Tracker',
            defaultLanguage: cfg?.defaultLanguage || 'tr'
        });
    } catch (err) {
        res.status(500).json({ error: 'System durumu alinamadi' });
    }
});

router.post('/validate-key', async (req, res) => {
    try {
        const { key } = req.body;
        if (!key) return res.status(400).json({ error: 'Lisans anahtari gerekli' });

        const LicenseActivation = require('../models/LicenseActivation');
        const license = await LicenseActivation.findOne({ key: key.toUpperCase() });

        if (!license) {
            return res.status(400).json({ error: 'Gecersiz lisans anahtari' });
        }
        if (license.isUsed && license.tenantSlug) {
            return res.status(400).json({ error: 'Bu lisans anahtari daha once kullanilmis' });
        }

        res.json({
            valid: true,
            type: license.type,
            deviceLimit: license.deviceLimit,
            userLimit: license.userLimit,
            durationDays: license.durationDays
        });
    } catch (err) {
        res.status(500).json({ error: 'Lisans dogrulama basarisiz' });
    }
});

router.post('/complete', async (req, res) => {
    try {
        const {
            licenseKey, companyName, adminEmail, adminPassword,
            companyTagline, primaryColor, supportEmail, supportPhone,
            language, timezone, externalDomain
        } = req.body;

        if (!companyName || !adminEmail || !adminPassword) {
            return res.status(400).json({ error: 'Firma adi, email ve sifre zorunludur' });
        }
        if (adminPassword.length < 6) {
            return res.status(400).json({ error: 'Sifre en az 6 karakter olmalidir' });
        }

        const existingAdmin = await User.findOne({ email: adminEmail });
        if (existingAdmin) {
            return res.status(409).json({ error: 'Bu email ile kayitli kullanici var' });
        }

        let licenseData = { type: 'trial', deviceLimit: 10, userLimit: 5, durationDays: 30 };
        if (licenseKey) {
            const LicenseActivation = require('../models/LicenseActivation');
            const license = await LicenseActivation.findOne({ key: licenseKey.toUpperCase() });
            if (license) {
                licenseData = {
                    type: license.type,
                    deviceLimit: license.deviceLimit,
                    userLimit: license.userLimit,
                    durationDays: license.durationDays
                };
            }
        }

        const tenant = await Tenant.create({
            companyName,
            slug: companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30),
            contactEmail: adminEmail,
            license: {
                type: licenseData.type,
                deviceLimit: licenseData.deviceLimit,
                userLimit: licenseData.userLimit,
                activatedAt: new Date(),
                expiresAt: new Date(Date.now() + licenseData.durationDays * 86400000)
            },
            branding: {
                logoUrl: '',
                primaryColor: primaryColor || '#2563eb',
                companyTagline: companyTagline || ''
            }
        });

        const adminUser = await User.create({
            tenantId: tenant._id,
            email: adminEmail,
            password: adminPassword,
            name: 'Admin',
            role: 'admin',
            isSuperAdmin: true,
            permissions: {
                canManageDevices: true, canViewReports: true, canExportData: true,
                canManageUsers: true, canUpdateFirmware: true, canConfigureAlerts: true
            }
        });

        if (licenseKey) {
            const LicenseActivation = require('../models/LicenseActivation');
            await LicenseActivation.findOneAndUpdate(
                { key: licenseKey.toUpperCase() },
                { isUsed: true, tenantSlug: tenant.slug, activatedAt: new Date() }
            );
        }

        let cfg = await SystemConfig.findOne();
        if (!cfg) {
            cfg = new SystemConfig();
        }

        cfg.setupComplete = true;
        cfg.setupStep = 5;
        cfg.companyName = companyName;
        cfg.companyTagline = companyTagline || '';
        cfg.primaryColor = primaryColor || '#2563eb';
        cfg.supportEmail = supportEmail || adminEmail;
        cfg.supportPhone = supportPhone || '';
        cfg.licenseKey = licenseKey || '';
        cfg.licenseType = licenseData.type;
        cfg.licenseDeviceLimit = licenseData.deviceLimit;
        cfg.licenseUserLimit = licenseData.userLimit;
        cfg.licenseExpiresAt = new Date(Date.now() + licenseData.durationDays * 86400000);
        cfg.licenseActivatedAt = new Date();
        cfg.defaultLanguage = language || 'tr';
        cfg.timezone = timezone || 'Europe/Istanbul';
        cfg.externalDomain = externalDomain || '';
        await cfg.save();

        console.log(`[Setup] Sistem kurulumu tamamlandi: ${companyName}, lisans: ${licenseData.type}`);

        res.json({
            success: true,
            message: 'Kurulum basariyla tamamlandi',
            adminEmail,
            licenseType: licenseData.type
        });
    } catch (err) {
        console.error('[Setup] Kurulum hatasi:', err);
        res.status(500).json({ error: 'Kurulum tamamlanamadi' });
    }
});

router.get('/info', async (req, res) => {
    try {
        const cfg = await SystemConfig.findOne();
        if (!cfg || !cfg.setupComplete) {
            return res.status(404).json({ error: 'Sistem henuz yapilandirilmamis' });
        }
        res.json({
            companyName: cfg.companyName,
            companyTagline: cfg.companyTagline,
            primaryColor: cfg.primaryColor,
            logoUrl: cfg.logoUrl,
            supportEmail: cfg.supportEmail,
            supportPhone: cfg.supportPhone,
            licenseType: cfg.licenseType,
            licenseDeviceLimit: cfg.licenseDeviceLimit,
            licenseUserLimit: cfg.licenseUserLimit,
            licenseExpiresAt: cfg.licenseExpiresAt,
            defaultLanguage: cfg.defaultLanguage,
            timezone: cfg.timezone,
            version: '2.0.0'
        });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

module.exports = router;

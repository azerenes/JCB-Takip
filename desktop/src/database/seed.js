const User = require('./models/User');
const Tenant = require('./models/Tenant');
const SystemConfig = require('./models/SystemConfig');
const bcrypt = require('bcryptjs');

function seedData() {
    const cfg = SystemConfig.findOne();
    if (cfg && cfg.setupComplete) {
        console.log('[Seed] Sistem zaten kurulu, seed atlaniyor');
        return;
    }

    const requireSetup = process.env.REQUIRE_SETUP !== 'false';

    // Create default admin if not exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@jcbtracker.com';
    let admin = User.findOne({ email: adminEmail });

    if (!admin && !requireSetup) {
        const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
        admin = User.create({
            email: adminEmail,
            password: hashedPassword,
            name: 'Super Admin',
            role: 'admin',
            isSuperAdmin: true,
            permissions: {
                canManageDevices: true, canViewReports: true, canExportData: true,
                canManageUsers: true, canUpdateFirmware: true, canConfigureAlerts: true
            }
        });
        console.log(`[Seed] Super Admin olusturuldu: ${admin.email}`);
    }

    if (!requireSetup) {
        let demoTenant = Tenant.findOne({ slug: 'demo-sirket' });
        if (!demoTenant) {
            demoTenant = Tenant.create({
                companyName: 'Demo Sirket',
                slug: 'demo-sirket',
                contactEmail: 'demo@jcbtracker.com',
                licenseType: 'trial',
                deviceLimit: 10,
                userLimit: 5
            });
            const demoPass = bcrypt.hashSync('demo123', 10);
            User.create({
                tenantId: demoTenant._id,
                email: 'demo@jcbtracker.com',
                password: demoPass,
                name: 'Demo Kullanici',
                role: 'admin',
                permissions: {
                    canManageDevices: true, canViewReports: true, canExportData: true,
                    canManageUsers: true, canUpdateFirmware: true, canConfigureAlerts: true
                }
            });
            console.log(`[Seed] Demo tenant olusturuldu: ${demoTenant.companyName}`);
        }
    }

    // Create default system config
    if (!cfg) {
        SystemConfig.create({
            setupComplete: !requireSetup,
            setupStep: requireSetup ? 0 : 5,
            companyName: 'JCB Tracker',
            licenseType: 'trial',
            defaultLanguage: 'tr'
        });
        console.log('[Seed] SystemConfig olusturuldu');
    }
}

module.exports = seedData;


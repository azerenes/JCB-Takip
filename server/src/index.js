const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const bcrypt = require('bcryptjs');

const app = express();
let server = null;

if (config.ssl.enabled && fs.existsSync(config.ssl.key) && fs.existsSync(config.ssl.cert)) {
    const sslOptions = {
        key: fs.readFileSync(config.ssl.key),
        cert: fs.readFileSync(config.ssl.cert)
    };
    server = https.createServer(sslOptions, app);
    console.log(`[SSL] HTTPS aktif, port: ${config.httpsPort}`);
} else {
    server = http.createServer(app);
    console.log('[SSL] HTTPS kapali, HTTP kullaniliyor');
}

const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Setup redirect middleware - /setup haric tum sayfalari kontrol et
app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/setup' || req.path === '/setup.html' || req.path.startsWith('/login')) return next();
    const SystemConfig = require('./models/SystemConfig');
    SystemConfig.isSetupComplete().then(done => {
        if (!done && req.method === 'GET' && !req.path.startsWith('/setup')) {
            return res.redirect('/setup');
        }
        next();
    }).catch(() => next());
});

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false, message: { error: 'Cok fazla istek, lutfen bekleyin' } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Cok fazla giris denemesi' } });
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);

// Auth middleware
const auth = require('./middleware/auth');

// Routes
app.use('/api/setup', require('./routes/setup'));
app.use('/api/firmware', require('./routes/firmware'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// API Documentation
app.get('/api/docs', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/api-docs.html'));
});
app.use('/api/device', require('./routes/device'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/ota', require('./routes/ota'));
app.use('/api/config', require('./routes/config-route'));
app.use('/api/panel', require('./routes/panel'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/eld', require('./routes/eld'));
app.use('/api/anomaly', require('./routes/anomaly'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/tenant', require('./routes/tenant'));

// Admin seeding
const User = require('./models/User');
const Tenant = require('./models/Tenant');
const SystemConfig = require('./models/SystemConfig');
async function seedAdmin() {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@jcbtracker.com';
        const existingAdmin = await User.findOne({ email: adminEmail });
        let cfg = await SystemConfig.findOne();

        if (!cfg && existingAdmin) {
            cfg = await SystemConfig.create({
                setupComplete: true, setupStep: 5,
                companyName: 'JCB Tracker',
                licenseType: 'trial',
                defaultLanguage: 'tr'
            });
            console.log('[Seed] Mevcut sistem icin SystemConfig olusturuldu');
        }

        if (cfg && cfg.setupComplete) {
            console.log('[Seed] Sistem zaten kurulu, seed atlaniyor');
            return;
        }

        const requireSetup = process.env.REQUIRE_SETUP !== 'false';
        let superAdmin = existingAdmin;
        if (!superAdmin && !requireSetup) {
            superAdmin = await User.create({
                email: adminEmail,
                password: process.env.ADMIN_PASSWORD || 'admin123',
                name: 'Super Admin',
                role: 'admin',
                isSuperAdmin: true,
                permissions: { canManageDevices: true, canViewReports: true, canExportData: true, canManageUsers: true, canUpdateFirmware: true, canConfigureAlerts: true }
            });
            console.log(`[Seed] Super Admin olusturuldu: ${superAdmin.email}`);
        } else if (superAdmin && !superAdmin.isSuperAdmin) {
            await User.updateOne({ email: adminEmail }, { $set: { isSuperAdmin: true } });
            console.log(`[Seed] Mevcut admin super admin yapildi: ${adminEmail}`);
        }

        if (!requireSetup) {
            const demoSlug = 'demo-sirket';
            let demoTenant = await Tenant.findOne({ slug: demoSlug });
            if (!demoTenant) {
                demoTenant = await Tenant.create({
                    companyName: 'Demo Sirket',
                    slug: demoSlug,
                    contactEmail: 'demo@jcbtracker.com',
                    license: { type: 'trial', deviceLimit: 10, userLimit: 5, activatedAt: new Date(), expiresAt: new Date(Date.now() + 60 * 86400000) }
                });
                await User.create({
                    tenantId: demoTenant._id,
                    email: 'demo@jcbtracker.com',
                    password: 'demo123',
                    name: 'Demo Kullanici',
                    role: 'admin',
                    permissions: { canManageDevices: true, canViewReports: true, canExportData: true, canManageUsers: true, canUpdateFirmware: true, canConfigureAlerts: true }
                });
                console.log(`[Seed] Demo tenant olusturuldu: ${demoTenant.companyName}`);
            }
        }
    } catch (err) {
        console.error('[Seed] Admin olusturulamadi:', err.message);
    }
}

// MQTT Listener
const mqttListener = require('./services/mqtt-listener');
mqttListener.init(io);

// Bildirim servisi
const notification = require('./services/notification');
notification.initEmail();

// Socket.IO
io.on('connection', (socket) => {
    console.log(`[WS] Kullanici baglandi: ${socket.id}`);

    socket.on('subscribe:device', (deviceId) => {
        socket.join(`device:${deviceId}`);
    });

    socket.on('unsubscribe:device', (deviceId) => {
        socket.leave(`device:${deviceId}`);
    });

    socket.on('register:push', (userId) => {
        if (userId) {
            notification.registerPushClient(userId, socket);
            console.log(`[WS] Push kayit: ${userId}`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[WS] Kullanici ayrildi: ${socket.id}`);
    });
});

// MongoDB connection
mongoose.connect(config.mongodbUri)
    .then(() => {
        console.log('[Mongo] Baglanti basarili');
        seedAdmin();
    })
    .catch(err => {
        console.error('[Mongo] Baglanti hatasi:', err.message);
        process.exit(1);
    });

const port = config.ssl.enabled ? config.httpsPort : config.port;
server.listen(port, () => {
    console.log(`[Server] JCB Tracker ${port} portunda calisiyor (${config.ssl.enabled ? 'HTTPS' : 'HTTP'})`);
});

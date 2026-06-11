const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');
const { connect, initSchema } = require('./database/db');
const seedData = require('./database/seed');

const app = express();

async function createServer() {
    // Initialize database
    await connect();
    initSchema();
    seedData();

    const server = http.createServer(app);
    const io = new Server(server, {
        cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.static(config.publicDir));

    // Setup redirect middleware
    app.use((req, res, next) => {
        if (req.path.startsWith('/api/') || req.path === '/setup.html' || req.path.startsWith('/login')) return next();
        const SystemConfig = require('./database/models/SystemConfig');
        const cfg = SystemConfig.findOne();
        if (!cfg || !cfg.setupComplete) {
            if (req.method === 'GET' && !req.path.startsWith('/setup')) {
                return res.redirect('/setup.html');
            }
        }
        next();
    });

    // Rate limiting
    const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, message: { error: 'Cok fazla istek' } });
    const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Cok fazla giris denemesi' } });
    app.use('/api/', apiLimiter);
    app.use('/api/auth/login', authLimiter);

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
            database: 'sqlite'
        });
    });

    // API Documentation
    app.get('/api/docs', (req, res) => {
        res.sendFile(path.join(config.publicDir, 'api-docs.html'));
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

    // MQTT Listener (desktop'ta opsiyonel)
    try {
        const mqttListener = require('./services/mqtt-listener');
        mqttListener.init(io);
    } catch (err) {
        console.log('[Desktop] MQTT baslatilamadi (opsiyonel):', err.message);
    }

    // Notification service
    try {
        const notification = require('./services/notification');
        notification.initEmail();
    } catch (err) {
        console.log('[Desktop] Email servisi baslatilamadi:', err.message);
    }

    // Socket.IO
    io.on('connection', (socket) => {
        console.log(`[WS] Kullanici baglandi: ${socket.id}`);
        socket.on('subscribe:device', (deviceId) => socket.join(`device:${deviceId}`));
        socket.on('unsubscribe:device', (deviceId) => socket.leave(`device:${deviceId}`));
        socket.on('register:push', (userId) => {
            try {
                const notification = require('./services/notification');
                if (userId) notification.registerPushClient(userId, socket);
            } catch (e) {}
        });
    });

    return { app, server, io };
}

module.exports = { createServer };

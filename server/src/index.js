const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
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

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Auth middleware
const auth = require('./middleware/auth');

// Routes
app.use('/api/device', require('./routes/device'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/ota', require('./routes/ota'));
app.use('/api/config', require('./routes/config-route'));
app.use('/api/panel', require('./routes/panel'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/eld', require('./routes/eld'));
app.use('/api/anomaly', require('./routes/anomaly'));

// Admin seeding
const User = require('./models/User');
async function seedAdmin() {
    try {
        const existing = await User.findOne({ email: config.smtp.from || 'admin@jcbtracker.com' });
        if (!existing) {
            const admin = new User({
                email: process.env.ADMIN_EMAIL || 'admin@jcbtracker.com',
                password: process.env.ADMIN_PASSWORD || 'admin123',
                name: 'Admin',
                role: 'admin',
                permissions: {
                    canManageDevices: true, canViewReports: true, canExportData: true,
                    canManageUsers: true, canUpdateFirmware: true, canConfigureAlerts: true
                }
            });
            await admin.save();
            console.log(`[Seed] Admin kullanici olusturuldu: ${admin.email}`);
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

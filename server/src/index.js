const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./config');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Routes
app.use('/api/device', require('./routes/device'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/panel', require('./routes/panel'));
app.use('/api/reports', require('./routes/reports'));

// MQTT Listener
const mqttListener = require('./services/mqtt-listener');
mqttListener.init(io);

// Socket.IO
io.on('connection', (socket) => {
    console.log(`[WS] Kullanici baglandi: ${socket.id}`);

    socket.on('subscribe:device', (deviceId) => {
        socket.join(`device:${deviceId}`);
        console.log(`[WS] ${socket.id} -> device:${deviceId} izleniyor`);
    });

    socket.on('unsubscribe:device', (deviceId) => {
        socket.leave(`device:${deviceId}`);
    });

    socket.on('disconnect', () => {
        console.log(`[WS] Kullanici ayrildi: ${socket.id}`);
    });
});

// MongoDB connection
mongoose.connect(config.mongodbUri)
    .then(() => console.log('[Mongo] Baglanti basarili'))
    .catch(err => {
        console.error('[Mongo] Baglanti hatasi:', err.message);
        process.exit(1);
    });

server.listen(config.port, () => {
    console.log(`[Server] JCB Tracker ${config.port} portunda calisiyor`);
});

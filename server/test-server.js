// JCB Tracker - Test Sunucusu (MongoDB gerektirmez)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');
const PDFDocument = require('pdfkit');

const PORT = 3000;
const JWT_SECRET = 'test_secret_jcb_2026';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== SAHTE VERI =====
const groups = ['Santiye-A', 'Santiye-B', 'Kiralik', 'Bakimda'];
const deviceTypes = ['JCB 3CX', 'JCB 4CX', 'JCB JS220', 'JCB 531-70'];
const plates = ['34 ABC 123', '06 DEF 456', '35 GHI 789', '16 JKL 012', '07 MNO 345', '38 PQR 678', '61 STU 901', '23 VWX 234', '42 YZA 567', '15 BCD 890'];
const statuses = ['active', 'active', 'active', 'inactive', 'maintenance'];
const severity = ['critical', 'warning', 'info'];
const alertTypes = ['geofence', 'speed', 'engine', 'battery', 'connection', 'maintenance'];
const alertMessages = [
    'Cihaz bolgeden cikti', 'Hiz siniri asimi', 'Motor arızasi', 'Dusuk batarya', 'Baglanti koptu',
    'Bakim zamani geldi', 'Yakıt seviyesi dustu', 'Sensor hatasi', 'GPS sinyali kayboldu', 'CAN iletisim hatasi'
];

// Merkezi noktalar (Turkiye)
const locations = [
    { lat: 41.0082, lng: 28.9784, name: 'Istanbul' },
    { lat: 39.9334, lng: 32.8597, name: 'Ankara' },
    { lat: 38.4192, lng: 27.1287, name: 'Izmir' },
    { lat: 37.0662, lng: 37.3833, name: 'Gaziantep' },
    { lat: 41.2867, lng: 36.3300, name: 'Samsun' },
    { lat: 36.8969, lng: 30.7133, name: 'Antalya' },
    { lat: 37.8719, lng: 32.4848, name: 'Konya' },
    { lat: 38.7225, lng: 35.4875, name: 'Kayseri' },
    { lat: 40.1828, lng: 29.0670, name: 'Bursa' },
    { lat: 38.6815, lng: 39.2260, name: 'Elazig' }
];

function random(min, max) { return Math.random() * (max - min) + min; }
function randomInt(min, max) { return Math.floor(random(min, max + 1)); }
function rnd(n) { return Math.round(n * 100) / 100; }

function pick(arr) { return arr[randomInt(0, arr.length - 1)]; }

const devices = [];
for (let i = 0; i < 12; i++) {
    const loc = locations[i % locations.length];
    const offsetLat = random(-0.02, 0.02);
    const offsetLng = random(-0.02, 0.02);
    devices.push({
        _id: `dev_${i + 1}`,
        deviceId: `JCB-${String(i + 1).padStart(3, '0')}`,
        name: `JCB ${i + 1}`,
        plate: plates[i % plates.length],
        group: pick(groups),
        status: pick(statuses),
        type: pick(deviceTypes),
        lastLocation: {
            lat: rnd(loc.lat + offsetLat),
            lng: rnd(loc.lng + offsetLng),
            speed: random(0, 45),
            engineHours: random(150, 8500),
            updatedAt: new Date(Date.now() - randomInt(0, 600000)).toISOString()
        },
        stats: { last24hLogs: randomInt(50, 480) }
    });
}

function generateLogs(deviceId, count = 100) {
    const dev = devices.find(d => d.deviceId === deviceId) || devices[0];
    const baseLat = dev.lastLocation.lat;
    const baseLng = dev.lastLocation.lng;
    const logs = [];
    for (let i = 0; i < count; i++) {
        logs.push({
            timestamp: new Date(Date.now() - i * 300000).toISOString(),
            latitude: rnd(baseLat + random(-0.01, 0.01)),
            longitude: rnd(baseLng + random(-0.01, 0.01)),
            speedKmh: rnd(random(0, 50)),
            engineHours: rnd(random(200, 8000))
        });
    }
    return logs;
}

const logsCache = {};

const alerts = [];
for (let i = 0; i < 30; i++) {
    const dev = pick(devices);
    alerts.push({
        _id: `alert_${i + 1}`,
        deviceId: dev.deviceId,
        type: pick(alertTypes),
        message: pick(alertMessages),
        severity: i < 5 ? 'critical' : pick(severity),
        acknowledged: i > 10,
        createdAt: new Date(Date.now() - i * 7200000).toISOString()
    });
}

const users = [
    { id: 'u1', name: 'Admin Kullanici', email: 'admin@jcbtracker.com', password: '$2a$10$dummy', role: 'admin' },
    { id: 'u2', name: 'Operator Kullanici', email: 'operator@jcbtracker.com', password: '$2a$10$dummy', role: 'operator' },
    { id: 'u3', name: 'Izleyici', email: 'viewer@jcbtracker.com', password: '$2a$10$dummy', role: 'viewer' }
];

function createToken(user) {
    return jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
}

function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Yetkisiz' });
    try {
        const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
        req.user = users.find(u => u.id === decoded.id) || { id: decoded.id, ...decoded };
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token gecersiz' });
    }
}

// ===== AUTH ROUTES =====
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user || password !== 'admin123') {
        return res.status(401).json({ error: 'Gecersiz email veya sifre' });
    }
    const token = createToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({ id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role });
});

app.put('/api/auth/password', authMiddleware, (req, res) => {
    res.json({ success: true });
});

// ===== USER ROUTES =====
app.get('/api/users', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Yetkiniz yok' });
    res.json(users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })));
});

app.post('/api/users', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Yetkiniz yok' });
    res.json({ success: true });
});

app.put('/api/users/:id', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Yetkiniz yok' });
    res.json({ success: true });
});

app.delete('/api/users/:id', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Yetkiniz yok' });
    res.json({ success: true });
});

// ===== DEVICE ROUTES =====
app.get('/api/device', authMiddleware, (req, res) => {
    const group = req.query.group;
    let result = devices;
    if (group) result = devices.filter(d => d.group === group);
    res.json(result);
});

app.get('/api/device/:deviceId', authMiddleware, (req, res) => {
    const dev = devices.find(d => d.deviceId === req.params.deviceId);
    if (!dev) return res.status(404).json({ error: 'Cihaz bulunamadi' });
    res.json(dev);
});

app.put('/api/device/:deviceId', authMiddleware, (req, res) => {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Yetkiniz yok' });
    res.json({ success: true });
});

app.delete('/api/device/:deviceId', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Yetkiniz yok' });
    res.json({ success: true });
});

// ===== PANEL ROUTES =====
app.get('/api/panel/summary', authMiddleware, (req, res) => {
    const active = devices.filter(d => d.status === 'active').length;
    const inactive = devices.filter(d => d.status === 'inactive').length;
    const maintenance = devices.filter(d => d.status === 'maintenance').length;
    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const unacknowledged = alerts.filter(a => !a.acknowledged).length;
    res.json({
        devices: { total: devices.length, active, inactive, maintenance },
        alerts: { total: alerts.length, critical: criticalCount, unacknowledged, today: alerts.length },
        groups
    });
});

app.get('/api/panel/devices-live', authMiddleware, (req, res) => {
    res.json(devices.map(d => ({
        deviceId: d.deviceId,
        name: d.name,
        isOnline: d.status === 'active',
        lastLocation: d.lastLocation
    })));
});

app.get('/api/panel/alerts', authMiddleware, (req, res) => {
    const severity = req.query.severity;
    let result = alerts;
    if (severity) result = alerts.filter(a => a.severity === severity);
    res.json(result.slice(0, parseInt(req.query.limit || '50')));
});

app.put('/api/panel/alerts/:id/acknowledge', authMiddleware, (req, res) => {
    const alert = alerts.find(a => a._id === req.params.id);
    if (alert) alert.acknowledged = true;
    res.json({ success: true });
});

app.get('/api/panel/device-history/:deviceId', authMiddleware, (req, res) => {
    const deviceId = req.params.deviceId;
    if (!logsCache[deviceId]) logsCache[deviceId] = generateLogs(deviceId, 200);
    res.json(logsCache[deviceId]);
});

// ===== REPORT ROUTES =====
app.get('/api/reports/device-report/:deviceId', authMiddleware, (req, res) => {
    const deviceId = req.params.deviceId;
    const dev = devices.find(d => d.deviceId === deviceId);
    if (!dev) return res.status(404).json({ error: 'Cihaz bulunamadi' });
    const logs = logsCache[deviceId] || generateLogs(deviceId, 100);
    const format = req.query.format;

    if (format === 'csv') {
        let csv = 'timestamp,latitude,longitude,speedKmh,engineHours\n';
        csv += logs.slice(0, 500).map(l =>
            `${l.timestamp},${l.latitude},${l.longitude},${l.speedKmh},${l.engineHours}`
        ).join('\n');
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', `attachment; filename=${deviceId}_report.csv`);
        return res.send(csv);
    }

    if (format === 'pdf') {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${deviceId}_report.pdf`);
        doc.pipe(res);

        doc.fontSize(20).font('Helvetica-Bold').text('JCB Tracker Raporu', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica-Normal');
        doc.text(`Cihaz: ${dev.name} (${dev.deviceId})`);
        doc.text(`Plaka: ${dev.plate}`);
        doc.text(`Grup: ${dev.group}`);
        doc.text(`Toplam Kayit: ${logs.length}`);
        doc.moveDown();

        if (logs.length > 0) {
            const first = logs[0];
            const last = logs[logs.length - 1];
            doc.text(`Ilk: ${new Date(first.timestamp).toLocaleString('tr-TR')}`);
            doc.text(`Son: ${new Date(last.timestamp).toLocaleString('tr-TR')}`);
            doc.moveDown();

            const daily = {};
            logs.forEach(l => {
                const day = l.timestamp.split('T')[0];
                if (!daily[day]) daily[day] = { count: 0, maxSpeed: 0, hours: 0 };
                daily[day].count++;
                daily[day].maxSpeed = Math.max(daily[day].maxSpeed, l.speedKmh);
                daily[day].hours = l.engineHours;
            });

            doc.fontSize(14).font('Helvetica-Bold').text('Gunluk Ozet');
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica-Normal');
            Object.entries(daily).forEach(([day, data]) => {
                doc.text(`${day}: ${data.count} kayit, max ${data.maxSpeed.toFixed(1)} km/h, motor ${data.hours.toFixed(1)}s`);
            });
        }

        doc.end();
        return;
    }

    res.json({ device: dev, logs: logs.slice(0, 200) });
});

app.get('/api/reports/summary-report', authMiddleware, (req, res) => {
    res.json({
        totalDevices: devices.length,
        totalLogs: 2850,
        totalAlerts: alerts.length,
        devices: devices.map(d => ({
            deviceId: d.deviceId,
            name: d.name,
            plate: d.plate,
            logCount: randomInt(50, 400),
            avgSpeed: rnd(random(8, 35)),
            maxSpeed: rnd(random(30, 65)),
            engineHoursUsed: rnd(random(5, 16))
        }))
    });
});

// ===== ELD ROUTES =====
const driverNames = ['Ahmet Yilmaz', 'Mehmet Demir', 'Ali Kaya', 'Veli Celik', 'Hasan Ozturk', 'Huseyin Sahin'];
const driverIds = ['DRV-001', 'DRV-002', 'DRV-003', 'DRV-004', 'DRV-005', 'DRV-006'];
const locationNames = ['Santiye-A', 'Santiye-B', 'Depo', 'Santiye-C', 'Ana Merkez', 'Santiye-D'];

function generateEldLogs(deviceId, dateStr) {
    const logs = [];
    const baseDriver = pick(driverNames);
    const baseDriverId = driverIds[driverNames.indexOf(baseDriver)];
    const dayStart = dateStr ? new Date(dateStr) : new Date();
    dayStart.setHours(6, 0, 0, 0);
    let cursor = dayStart.getTime();
    const statuses = ['off_duty', 'driving', 'on_duty', 'driving', 'off_duty', 'driving', 'on_duty', 'driving', 'off_duty', 'sleeper'];
    const locs = locationNames.slice();

    statuses.forEach((status, i) => {
        const start = new Date(cursor + i * random(30, 120) * 60000);
        const dur = status === 'driving' ? random(1, 4) : status === 'on_duty' ? random(0.5, 2) : status === 'sleeper' ? random(4, 8) : random(0.5, 2);
        const end = new Date(start.getTime() + dur * 3600000);
        logs.push({
            _id: `eld_${deviceId}_${i}`,
            deviceId,
            driverId: baseDriverId,
            driverName: baseDriver,
            status,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            duration: dur,
            vehicleMiles: rnd(random(0, status === 'driving' ? 80 : 5)),
            locationStart: { lat: 39.0 + random(-1, 1), lng: 35.0 + random(-1, 1), name: pick(locs) },
            locationEnd: { lat: 39.0 + random(-1, 1), lng: 35.0 + random(-1, 1), name: pick(locs) },
            cycleViolation: i === 0 && Math.random() > 0.85,
            remark: ''
        });
        cursor = end.getTime();
    });
    return logs;
}

const eldCache = {};

app.get('/api/eld/daily/:deviceId', authMiddleware, (req, res) => {
    const deviceId = req.params.deviceId;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const cacheKey = `${deviceId}_${date}`;
    if (!eldCache[cacheKey]) eldCache[cacheKey] = generateEldLogs(deviceId, date);

    const logs = eldCache[cacheKey];
    const summary = { driving: 0, onDuty: 0, offDuty: 0, sleeper: 0 };
    logs.forEach(l => {
        summary[l.status === 'sleeper' ? 'sleeper' : l.status === 'driving' ? 'driving' : l.status === 'on_duty' ? 'onDuty' : 'offDuty'] += l.duration;
    });

    res.json({ date, deviceId, logs, summary });
});

app.get('/api/eld/weekly/:deviceId', authMiddleware, (req, res) => {
    res.json({ deviceId: req.params.deviceId, logs: eldCache[`${req.params.deviceId}_${new Date().toISOString().split('T')[0]}`] || [] });
});

// ===== ANOMALI ROUTES =====
const anomalyTypes = ['fuel_drop', 'fuel_surge', 'route_deviation', 'excessive_speed', 'excessive_idle', 'battery_drain', 'maintenance_due', 'gps_loss'];
const anomalySeverities = ['low', 'medium', 'high', 'critical'];

function generateAnomalies(count = 40) {
    const items = [];
    for (let i = 0; i < count; i++) {
        const dev = pick(devices);
        const type = pick(anomalyTypes);
        const sev = i < 3 ? 'critical' : i < 8 ? 'high' : pick(anomalySeverities);
        items.push({
            _id: `anomaly_${i + 1}`,
            deviceId: dev.deviceId,
            type,
            severity: sev,
            score: randomInt(20, 100),
            title: ['Ani yakit dususu', 'Rota sapmasi', 'Asiri hiz tespiti', 'Batarya sorunu', 'Bakim zamani', 'GPS kaybi', 'Asiri rolanti', 'Yakit hirsizligi'][i % 8],
            description: `${dev.name} icin anomali tespit edildi`,
            metric: { current: rnd(random(5, 95)), baseline: rnd(random(20, 80)), threshold: 50, unit: '%' },
            location: { lat: dev.lastLocation.lat, lng: dev.lastLocation.lng },
            acknowledged: i > 25,
            createdAt: new Date(Date.now() - i * random(1, 12) * 3600000).toISOString()
        });
    }
    return items;
}

const anomalies = generateAnomalies(45);

app.get('/api/anomaly', authMiddleware, (req, res) => {
    let result = anomalies;
    if (req.query.deviceId) result = result.filter(a => a.deviceId === req.query.deviceId);
    if (req.query.severity) result = result.filter(a => a.severity === req.query.severity);
    if (req.query.type) result = result.filter(a => a.type === req.query.type);
    if (req.query.acknowledged === 'false') result = result.filter(a => !a.acknowledged);
    res.json(result.slice(0, parseInt(req.query.limit || '100')));
});

app.get('/api/anomaly/stats', authMiddleware, (req, res) => {
    const critical = anomalies.filter(a => a.severity === 'critical' && !a.acknowledged).length;
    const high = anomalies.filter(a => a.severity === 'high' && !a.acknowledged).length;
    const types = [];
    const typeCounts = {};
    anomalies.forEach(a => {
        typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
    });
    Object.entries(typeCounts).forEach(([k, v]) => types.push({ _id: k, count: v }));

    const trend = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
        trend.push({ _id: d, count: randomInt(1, 8) });
    }

    res.json({ total: anomalies.length, critical, high, types, trend });
});

app.put('/api/anomaly/:id/acknowledge', authMiddleware, (req, res) => {
    const a = anomalies.find(x => x._id === req.params.id);
    if (a) a.acknowledged = true;
    res.json({ success: true });
});

// ===== OTA ROUTES =====
app.get('/api/ota/firmware', authMiddleware, (req, res) => {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Yetkiniz yok' });
    res.json({
        currentVersion: '2.0.0',
        availableVersion: '2.0.0',
        releaseDate: new Date().toISOString(),
        changelog: 'OTA destegi eklendi, watchdog iyilestirmeleri',
        fileSize: 524288,
        checksum: 'a1b2c3d4e5f6'
    });
});

app.post('/api/ota/request', authMiddleware, (req, res) => {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Yetkiniz yok' });
    res.json({ success: true, message: 'OTA guncellemesi baslatildi' });
});

// ===== CONFIG ROUTES =====
app.get('/api/config', authMiddleware, (req, res) => {
    res.json({
        mqtt: { broker: 'mqtt://localhost:1883', wsBroker: 'ws://localhost:8083' },
        notifications: { email: false, sms: false, push: true },
        gps: { interval: 30, minDistance: 10 },
        geofence: { checkInterval: 60 }
    });
});

// ===== SOCKET.IO =====
io.on('connection', (socket) => {
    console.log(`[WS] Baglanti: ${socket.id}`);
    socket.on('register:push', (userId) => {
        console.log(`[WS] Push kaydi: ${userId}`);
    });

    // Simule edilmis canli veri akisi
    const interval = setInterval(() => {
        const dev = pick(devices);
        const newLoc = {
            lat: rnd(dev.lastLocation.lat + random(-0.005, 0.005)),
            lng: rnd(dev.lastLocation.lng + random(-0.005, 0.005)),
            speed: rnd(random(0, 50)),
            engineHours: rnd(dev.lastLocation.engineHours + random(0, 0.5))
        };
        dev.lastLocation.lat = newLoc.lat;
        dev.lastLocation.lng = newLoc.lng;
        dev.lastLocation.speed = newLoc.speed;
        dev.lastLocation.engineHours = newLoc.engineHours;
        dev.lastLocation.updatedAt = new Date().toISOString();

        socket.emit('live:update', {
            deviceId: dev.deviceId,
            lat: newLoc.lat,
            lng: newLoc.lng,
            speed: newLoc.speed,
            engineHours: newLoc.engineHours
        });
    }, 5000);

    socket.on('disconnect', () => {
        clearInterval(interval);
        console.log(`[WS] Ayrildi: ${socket.id}`);
    });
});

// ===== BASLAT =====
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════╗
║     JCB Tracker - TEST SUNUCUSU          ║
║     Port: ${PORT}                          ║
║                                          ║
║     Web Panel: http://localhost:${PORT}    ║
║     Giris: admin@jcbtracker.com          ║
║     Sifre: admin123                      ║
║                                          ║
║     Diger hesaplar:                      ║
║     operator@jcbtracker.com / admin123   ║
║     viewer@jcbtracker.com / admin123     ║
╚══════════════════════════════════════════╝
    `);
});

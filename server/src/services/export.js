const PDFDocument = require('pdfkit');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');
const Device = require('../models/Device');
const LocationLog = require('../models/LocationLog');
const Alert = require('../models/Alert');

const EXPORT_DIR = path.join(__dirname, '../../exports');

if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

async function exportToCSV(deviceId, startDate, endDate) {
    const device = await Device.findOne({ deviceId });
    if (!device) throw new Error('Cihaz bulunamadi');

    const filter = { deviceId };
    if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate);
        if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await LocationLog.find(filter).sort({ timestamp: 1 });

    const filename = `${deviceId}_${Date.now()}.csv`;
    const filepath = path.join(EXPORT_DIR, filename);

    const csvWriter = createObjectCsvWriter({
        path: filepath,
        header: [
            { id: 'timestamp', title: 'TIMESTAMP' },
            { id: 'latitude', title: 'LATITUDE' },
            { id: 'longitude', title: 'LONGITUDE' },
            { id: 'speedKmh', title: 'SPEED_KMH' },
            { id: 'engineHours', title: 'ENGINE_HOURS' },
            { id: 'batteryMv', title: 'BATTERY_MV' },
            { id: 'ignition', title: 'IGNITION' }
        ]
    });

    await csvWriter.writeRecords(logs.map(log => ({
        timestamp: log.timestamp.toISOString(),
        latitude: log.latitude.toFixed(6),
        longitude: log.longitude.toFixed(6),
        speedKmh: log.speedKmh.toFixed(2),
        engineHours: log.engineHours.toFixed(2),
        batteryMv: log.batteryMv,
        ignition: log.ignition ? '1' : '0'
    })));

    return { filename, filepath, count: logs.length };
}

async function exportToPDF(deviceId, startDate, endDate) {
    const device = await Device.findOne({ deviceId });
    if (!device) throw new Error('Cihaz bulunamadi');

    const filter = { deviceId };
    if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate);
        if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await LocationLog.find(filter).sort({ timestamp: 1 });
    const alerts = await Alert.find({ deviceId }).sort({ createdAt: -1 }).limit(50);

    const filename = `${deviceId}_${Date.now()}.pdf`;
    const filepath = path.join(EXPORT_DIR, filename);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    doc.fontSize(22).font('Helvetica-Bold').text('JCB Tracker Raporu', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Normal');

    doc.text(`Cihaz: ${device.name} (${device.deviceId})`);
    doc.text(`Plaka: ${device.plate}`);
    doc.text(`Grup: ${device.group}`);
    doc.text(`Tarih Araligi: ${startDate || 'Tum'} - ${endDate || 'Tum'}`);
    doc.text(`Toplam Kayit: ${logs.length}`);
    doc.moveDown();

    if (logs.length > 0) {
        const first = logs[0];
        const last = logs[logs.length - 1];
        doc.text(`Ilk Kayit: ${first.timestamp.toLocaleString('tr-TR')}`);
        doc.text(`Son Kayit: ${last.timestamp.toLocaleString('tr-TR')}`);
        const totalHours = last.engineHours - first.engineHours;
        doc.text(`Toplam Calisma: ${totalHours.toFixed(1)} saat`);
        doc.moveDown();

        doc.fontSize(14).font('Helvetica-Bold').text('Gunluk Ozet', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica-Normal');

        const daily = {};
        logs.forEach(log => {
            const day = log.timestamp.toISOString().split('T')[0];
            if (!daily[day]) daily[day] = { count: 0, maxSpeed: 0, maxHours: 0 };
            daily[day].count++;
            daily[day].maxSpeed = Math.max(daily[day].maxSpeed, log.speedKmh);
            daily[day].maxHours = Math.max(daily[day].maxHours, log.engineHours);
        });

        Object.entries(daily).forEach(([day, data]) => {
            doc.text(`${day}: ${data.count} kayit, ${data.maxSpeed.toFixed(1)} km/h, ${data.maxHours.toFixed(1)}s`);
        });

        doc.moveDown();
        doc.fontSize(14).font('Helvetica-Bold').text('Son Uyarilar', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica-Normal');

        alerts.slice(0, 20).forEach(alert => {
            doc.text(`[${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message} (${alert.createdAt.toLocaleString('tr-TR')})`);
        });
    }

    doc.end();

    return new Promise((resolve, reject) => {
        stream.on('finish', () => resolve({ filename, filepath, count: logs.length }));
        stream.on('error', reject);
    });
}

function cleanupOldExports(maxAgeHours = 24) {
    const files = fs.readdirSync(EXPORT_DIR);
    const now = Date.now();

    for (const file of files) {
        const filepath = path.join(EXPORT_DIR, file);
        const stats = fs.statSync(filepath);
        const ageHours = (now - stats.mtimeMs) / 3600000;

        if (ageHours > maxAgeHours) {
            fs.unlinkSync(filepath);
            console.log(`[Export] Temizlendi: ${file}`);
        }
    }
}

setInterval(() => cleanupOldExports(24), 3600000);

module.exports = { exportToCSV, exportToPDF };

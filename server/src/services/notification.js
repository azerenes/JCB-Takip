// JCB Tracker - Bildirim Servisi
const nodemailer = require('nodemailer');
const config = require('../config');

let emailTransporter = null;
let smsClient = null;
let pushClients = new Set();

function initEmail() {
    if (!config.smtp.host) {
        console.log('[NOTIFY] SMTP ayarlanmamis, eposta kapali');
        return;
    }

    emailTransporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
            user: config.smtp.user,
            pass: config.smtp.pass
        }
    });
    console.log('[NOTIFY] E-posta servisi hazir');
}

async function sendEmail(to, subject, html) {
    if (!emailTransporter) return false;
    try {
        await emailTransporter.sendMail({
            from: `"JCB Tracker" <${config.smtp.from}>`,
            to,
            subject,
            html
        });
        console.log(`[NOTIFY] E-posta gonderildi: ${to}`);
        return true;
    } catch (err) {
        console.error('[NOTIFY] E-posta hatasi:', err.message);
        return false;
    }
}

async function sendSMS(to, message) {
    if (!config.sms.apiKey || !config.sms.apiSecret) {
        console.log('[NOTIFY] SMS ayarlanmamis');
        return false;
    }

    // SMS API entegrasyonu (Twilio, Netgsm, vs.)
    // Ornek: Twilio
    try {
        const accountSid = config.sms.apiKey;
        const authToken = config.sms.apiSecret;
        const client = require('twilio')(accountSid, authToken);

        await client.messages.create({
            body: message,
            from: config.sms.from,
            to: to
        });
        console.log(`[NOTIFY] SMS gonderildi: ${to}`);
        return true;
    } catch (err) {
        console.error('[NOTIFY] SMS hatasi:', err.message);
        return false;
    }
}

async function sendPush(userId, title, body, data = {}) {
    // Web Push (WebSocket üzerinden)
    if (pushClients.has(userId)) {
        const socket = pushClients.get(userId);
        socket.emit('notification', { title, body, data, time: new Date() });
        return true;
    }
    return false;
}

function registerPushClient(userId, socket) {
    pushClients.set(userId, socket);
    socket.on('disconnect', () => {
        pushClients.delete(userId);
    });
}

async function sendAlert(alert, user) {
    const subject = `[JCB] ${alert.severity.toUpperCase()}: ${alert.type}`;
    const message = `${alert.message}\nCihaz: ${alert.deviceId}\nTarih: ${new Date().toLocaleString('tr-TR')}`;
    const html = `
        <h2>🚜 JCB Tracker Uyarisi</h2>
        <p><strong>Seviye:</strong> ${alert.severity}</p>
        <p><strong>Tur:</strong> ${alert.type}</p>
        <p><strong>Mesaj:</strong> ${alert.message}</p>
        <p><strong>Cihaz:</strong> ${alert.deviceId}</p>
        <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
        <hr>
        <p style="color:#888;">JCB Tracker - Otomatik bildirim</p>
    `;

    const results = { email: false, sms: false, push: false };

    if (user.notificationPreferences.email && user.email) {
        results.email = await sendEmail(user.email, subject, html);
    }
    if (user.notificationPreferences.sms && user.phone) {
        results.sms = await sendSMS(user.phone, message);
    }
    if (user.notificationPreferences.push) {
        results.push = await sendPush(user._id.toString(), subject, message);
    }

    return results;
}

module.exports = { initEmail, sendEmail, sendSMS, sendPush, sendAlert, registerPushClient };

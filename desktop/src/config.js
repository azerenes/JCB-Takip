const path = require('path');

function getDataDir() {
    if (process.env.JCB_DATA_DIR) return process.env.JCB_DATA_DIR;
    try {
        const { app } = require('electron');
        if (app && typeof app.getPath === 'function') {
            return path.join(app.getPath('userData'), 'data');
        }
    } catch (_) {}
    return path.join(process.cwd(), 'data');
}

const config = {
    port: parseInt(process.env.JCB_PORT || '3000', 10),
    get dataDir() { return getDataDir(); },
    mongodbUri: '',
    mqttBroker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
    mqttWsBroker: process.env.MQTT_WS_BROKER || 'ws://localhost:8083',
    mqttTopics: {
        live: 'jcb/+/live',
        status: 'jcb/+/status',
        cmd: 'jcb/{deviceId}/cmd',
        config: 'jcb/{deviceId}/config'
    },
    jwtSecret: process.env.JWT_SECRET || 'jcb_desktop_default_secret',
    jwtExpiresIn: '7d',
    ssl: { enabled: false },
    publicDir: path.join(__dirname, '../public'),
    smtp: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'noreply@jcbtracker.com'
    },
    geofence: { checkIntervalMs: 30000, defaultRadius: 100 },
    alert: { speedThreshold: 90, workStartHour: 7, workEndHour: 19, idleMinutes: 15 }
};

module.exports = config;

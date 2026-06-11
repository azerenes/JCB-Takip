require('dotenv').config();

module.exports = {
    port: parseInt(process.env.PORT) || 3000,
    httpsPort: parseInt(process.env.HTTPS_PORT) || 3443,
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/jcb_tracker',
    jwtSecret: process.env.JWT_SECRET || 'default_secret_change_me',

    ssl: {
        enabled: process.env.SSL_ENABLED === 'true',
        key: process.env.SSL_KEY_PATH || './ssl/server.key',
        cert: process.env.SSL_CERT_PATH || './ssl/server.crt'
    },

    mqttBroker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
    mqttBrokerTLS: process.env.MQTT_BROKER_TLS || 'mqtts://localhost:8883',
    mqttWsBroker: process.env.MQTT_WS_BROKER || 'ws://localhost:8083',

    smtp: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'noreply@jcbtracker.com'
    },

    sms: {
        apiKey: process.env.SMS_API_KEY || '',
        apiSecret: process.env.SMS_API_SECRET || '',
        from: process.env.SMS_FROM || '+905555555555'
    },

    mqttTopics: {
        live: 'jcb/+/live',
        status: 'jcb/+/status',
        cmd: 'jcb/{deviceId}/cmd',
        config: 'jcb/{deviceId}/config'
    },

    geofence: {
        checkIntervalMs: 30000,
        defaultRadius: 100
    },

    alert: {
        speedThreshold: 90,
        workStartHour: 7,
        workEndHour: 19,
        idleMinutes: 15
    },

    export: {
        maxDays: 365,
        maxRows: 100000
    }
};

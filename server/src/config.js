require('dotenv').config();

module.exports = {
    port: parseInt(process.env.PORT) || 3000,
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/jcb_tracker',
    mqttBroker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
    mqttWsBroker: process.env.MQTT_WS_BROKER || 'ws://localhost:8083',
    jwtSecret: process.env.JWT_SECRET || 'default_secret_change_me',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@jcbtracker.com',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',

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

const mongoose = require('mongoose');

const locationLogSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        required: true
    },
    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },
    speedKmh: {
        type: Number,
        default: 0
    },
    engineHours: {
        type: Number,
        default: 0
    },
    optoCount: {
        type: Number,
        default: 0
    },
    batteryMv: {
        type: Number,
        default: 0
    },
    ignition: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: false
});

locationLogSchema.index({ deviceId: 1, timestamp: -1 });
locationLogSchema.index({ timestamp: -1 });

// Günlük bazında otomatik temizlik için TTL indeksi (30 gün)
locationLogSchema.index({ timestamp: 1 }, {
    expireAfterSeconds: 30 * 24 * 3600
});

module.exports = mongoose.model('LocationLog', locationLogSchema);

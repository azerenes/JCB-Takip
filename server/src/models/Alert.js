const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: [
            'geofence_enter',
            'geofence_exit',
            'speed_exceeded',
            'out_of_hours',
            'battery_low',
            'ignition_on',
            'ignition_off',
            'engine_hours_warning',
            'disconnected'
        ],
        required: true
    },
    severity: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        default: 'warning'
    },
    message: {
        type: String,
        required: true
    },
    data: {
        latitude: Number,
        longitude: Number,
        speed: Number,
        value: Number,
        threshold: Number
    },
    acknowledged: {
        type: Boolean,
        default: false
    },
    acknowledgedBy: {
        type: String,
        default: ''
    },
    acknowledgedAt: {
        type: Date
    }
}, {
    timestamps: true
});

alertSchema.index({ deviceId: 1, createdAt: -1 });
alertSchema.index({ type: 1, createdAt: -1 });
alertSchema.index({ acknowledged: 1, severity: 1 });

module.exports = mongoose.model('Alert', alertSchema);

const mongoose = require('mongoose');

const anomalyLogSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, index: true },
    type: {
        type: String,
        enum: [
            'fuel_drop', 'fuel_surge', 'route_deviation',
            'excessive_speed', 'excessive_idle', 'battery_drain',
            'engine_overrun', 'maintenance_due', 'gps_loss',
            'unexpected_movement', 'geofence_violation'
        ],
        required: true
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    score: { type: Number, default: 0, min: 0, max: 100 },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    metric: {
        current: { type: Number, default: 0 },
        baseline: { type: Number, default: 0 },
        threshold: { type: Number, default: 0 },
        unit: { type: String, default: '' }
    },
    location: {
        lat: { type: Number, default: 0 },
        lng: { type: Number, default: 0 }
    },
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: { type: String, default: '' },
    resolvedAt: { type: Date },
    autoResolve: { type: Boolean, default: false }
}, { timestamps: true });

anomalyLogSchema.index({ deviceId: 1, createdAt: -1 });
anomalyLogSchema.index({ type: 1, severity: 1 });
anomalyLogSchema.index({ acknowledged: 1, severity: 1 });

module.exports = mongoose.model('AnomalyLog', anomalyLogSchema);

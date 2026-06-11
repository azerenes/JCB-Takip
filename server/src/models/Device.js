const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    deviceId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    plate: {
        type: String,
        trim: true,
        default: ''
    },
    apiKey: {
        type: String,
        required: true,
        unique: true
    },
    group: {
        type: String,
        trim: true,
        default: 'Varsayilan'
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'maintenance'],
        default: 'active'
    },
    firmware: {
        version: { type: String, default: '' },
        lastUpdate: { type: Date }
    },
    lastLocation: {
        lat: { type: Number, default: 0 },
        lng: { type: Number, default: 0 },
        speed: { type: Number, default: 0 },
        engineHours: { type: Number, default: 0 },
        updatedAt: { type: Date }
    },
    metadata: {
        brand: { type: String, default: 'JCB' },
        model: { type: String, default: '' },
        year: { type: Number },
        notes: { type: String }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true }
});

deviceSchema.index({ tenantId: 1, deviceId: 1 });
deviceSchema.index({ tenantId: 1, group: 1, status: 1 });
deviceSchema.index({ tenantId: 1, 'lastLocation.updatedAt': -1 });

module.exports = mongoose.model('Device', deviceSchema);

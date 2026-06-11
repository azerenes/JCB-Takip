const mongoose = require('mongoose');

const geofenceSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true, default: null },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    type: {
        type: String,
        enum: ['circle', 'polygon'],
        default: 'circle'
    },
    center: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    radius: {
        type: Number,
        default: 100
    },
    polygon: [{
        lat: Number,
        lng: Number
    }],
    devices: [{
        type: String
    }],
    groups: [{
        type: String
    }],
    active: {
        type: Boolean,
        default: true
    },
    alertOnEnter: {
        type: Boolean,
        default: true
    },
    alertOnExit: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Geofence', geofenceSchema);

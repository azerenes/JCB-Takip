const mongoose = require('mongoose');

const driverLogSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, index: true },
    driverId: { type: String, required: true },
    driverName: { type: String, default: '' },
    status: {
        type: String,
        enum: ['driving', 'on_duty', 'off_duty', 'sleeper'],
        default: 'off_duty'
    },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    duration: { type: Number, default: 0 },
    vehicleMiles: { type: Number, default: 0 },
    locationStart: {
        lat: { type: Number, default: 0 },
        lng: { type: Number, default: 0 },
        name: { type: String, default: '' }
    },
    locationEnd: {
        lat: { type: Number, default: 0 },
        lng: { type: Number, default: 0 },
        name: { type: String, default: '' }
    },
    remark: { type: String, default: '' },
    cycleViolation: { type: Boolean, default: false }
}, { timestamps: true });

driverLogSchema.index({ deviceId: 1, startTime: -1 });
driverLogSchema.index({ driverId: 1, startTime: -1 });
driverLogSchema.index({ status: 1, startTime: -1 });

module.exports = mongoose.model('DriverLog', driverLogSchema);

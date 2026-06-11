const mongoose = require('mongoose');
const crypto = require('crypto');

const licenseSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    tenantSlug: { type: String, default: '' },
    type: { type: String, enum: ['trial', 'basic', 'professional', 'enterprise'], default: 'trial' },
    deviceLimit: { type: Number, default: 5 },
    userLimit: { type: Number, default: 3 },
    durationDays: { type: Number, default: 30 },
    isUsed: { type: Boolean, default: false },
    activatedAt: { type: Date },
    expiresAt: { type: Date },
    notes: { type: String, default: '' }
}, { timestamps: true });

licenseSchema.statics.generateKey = function() {
    const prefix = 'JCB';
    const segments = [];
    for (let i = 0; i < 4; i++) {
        segments.push(crypto.randomBytes(3).toString('hex').toUpperCase());
    }
    return `${prefix}-${segments.join('-')}`;
};

licenseSchema.statics.generateBulk = function(count, type, deviceLimit, userLimit, durationDays) {
    const keys = [];
    for (let i = 0; i < count; i++) {
        keys.push({
            key: this.generateKey(),
            type,
            deviceLimit,
            userLimit,
            durationDays
        });
    }
    return keys;
};

module.exports = mongoose.model('LicenseActivation', licenseSchema);

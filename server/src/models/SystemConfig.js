const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
    setupComplete: { type: Boolean, default: false },
    setupStep: { type: Number, default: 0 },
    companyName: { type: String, default: '' },
    companyTagline: { type: String, default: '' },
    primaryColor: { type: String, default: '#2563eb' },
    logoUrl: { type: String, default: '' },
    supportEmail: { type: String, default: '' },
    supportPhone: { type: String, default: '' },

    licenseKey: { type: String, default: '' },
    licenseType: { type: String, enum: ['trial', 'basic', 'professional', 'enterprise', 'unlimited'], default: 'trial' },
    licenseDeviceLimit: { type: Number, default: 10 },
    licenseUserLimit: { type: Number, default: 5 },
    licenseExpiresAt: { type: Date },
    licenseActivatedAt: { type: Date },

    defaultLanguage: { type: String, enum: ['tr', 'en', 'ar'], default: 'tr' },
    timezone: { type: String, default: 'Europe/Istanbul' },
    externalDomain: { type: String, default: '' },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

systemConfigSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

systemConfigSchema.statics.isSetupComplete = async function () {
    const cfg = await this.findOne();
    return cfg ? cfg.setupComplete : false;
};

module.exports = mongoose.model('SystemConfig', systemConfigSchema);

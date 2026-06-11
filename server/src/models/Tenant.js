const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
    companyName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    contactPhone: { type: String, default: '' },
    address: { type: String, default: '' },
    taxNumber: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    license: {
        type: { type: String, enum: ['trial', 'basic', 'professional', 'enterprise'], default: 'trial' },
        deviceLimit: { type: Number, default: 5 },
        userLimit: { type: Number, default: 3 },
        expiresAt: { type: Date },
        activatedAt: { type: Date },
        activationKey: { type: String, unique: true, sparse: true }
    },
    branding: {
        logoUrl: { type: String, default: '' },
        primaryColor: { type: String, default: '#2563eb' },
        companyTagline: { type: String, default: '' }
    },
    features: {
        eldEnabled: { type: Boolean, default: false },
        anomalyDetection: { type: Boolean, default: false },
        geofence: { type: Boolean, default: false },
        apiAccess: { type: Boolean, default: false },
        whiteLabel: { type: Boolean, default: false }
    },
    stats: {
        deviceCount: { type: Number, default: 0 },
        userCount: { type: Number, default: 0 },
        lastActive: { type: Date }
    }
}, { timestamps: true });

tenantSchema.index({ slug: 1 });
tenantSchema.index({ 'license.activationKey': 1 });
tenantSchema.index({ 'license.expiresAt': 1 });

tenantSchema.methods.isExpired = function() {
    return this.license.expiresAt && new Date() > this.license.expiresAt;
};

tenantSchema.methods.canAddDevice = function() {
    return this.stats.deviceCount < this.license.deviceLimit;
};

tenantSchema.methods.canAddUser = function() {
    return this.stats.userCount < this.license.userLimit;
};

module.exports = mongoose.model('Tenant', tenantSchema);

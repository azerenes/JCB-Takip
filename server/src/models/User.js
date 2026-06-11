// JCB Tracker - Kullanici Modeli
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['admin', 'operator', 'viewer'],
        default: 'operator'
    },
    permissions: {
        canManageDevices: { type: Boolean, default: false },
        canViewReports: { type: Boolean, default: true },
        canExportData: { type: Boolean, default: false },
        canManageUsers: { type: Boolean, default: false },
        canUpdateFirmware: { type: Boolean, default: false },
        canConfigureAlerts: { type: Boolean, default: false }
    },
    assignedDevices: [{
        type: String
    }],
    phone: {
        type: String,
        default: ''
    },
    notificationPreferences: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: false }
    },
    lastLogin: Date,
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.hasPermission = function(permission) {
    if (this.role === 'admin') return true;
    return this.permissions[permission] || false;
};

userSchema.statics.getRolePermissions = function(role) {
    const permissions = {
        admin: {
            canManageDevices: true, canViewReports: true, canExportData: true,
            canManageUsers: true, canUpdateFirmware: true, canConfigureAlerts: true
        },
        operator: {
            canManageDevices: true, canViewReports: true, canExportData: true,
            canManageUsers: false, canUpdateFirmware: false, canConfigureAlerts: true
        },
        viewer: {
            canManageDevices: false, canViewReports: true, canExportData: false,
            canManageUsers: false, canUpdateFirmware: false, canConfigureAlerts: false
        }
    };
    return permissions[role] || permissions.viewer;
};

module.exports = mongoose.model('User', userSchema);

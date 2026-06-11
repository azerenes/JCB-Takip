const Model = require('../Model');
const bcrypt = require('bcryptjs');

const User = new Model('users', {});

// Add methods to all returned user documents
const origFind = User._find.bind(User);
User._find = function(filter, opts) {
    const rows = origFind(filter, opts);
    return rows.map(r => attachMethods(r));
};

const origFindOne = User.findOne.bind(User);
User.findOne = function(filter) {
    return attachMethods(origFindOne(filter));
};

const origFindById = User.findById.bind(User);
User.findById = function(id) {
    return attachMethods(origFindById(id));
};

User.comparePassword = async function(candidatePassword, hashedPassword) {
    return bcrypt.compare(candidatePassword, hashedPassword);
};

User.getRolePermissions = function(role) {
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
            canManageDevices: false, canViewReports: true, canExportData: true,
            canManageUsers: false, canUpdateFirmware: false, canConfigureAlerts: false
        }
    };
    return permissions[role] || permissions.viewer;
};

function attachMethods(doc) {
    if (!doc) return null;
    doc.comparePassword = async function(candidatePassword) {
        return bcrypt.compare(candidatePassword, this.password);
    };
    doc.hasPermission = function(permission) {
        if (this.role === 'admin') return true;
        return this.permissions?.[permission] || false;
    };
    return doc;
}

module.exports = User;

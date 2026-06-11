const Model = require('../Model');

const Tenant = new Model('tenants', {});

// Add Mongoose-compatible methods
Object.assign(Tenant, {
    isExpired: function() {
        if (!this.expiresAt) return false;
        return new Date(this.expiresAt) < new Date();
    },
    canAddDevice: function() {
        const count = this.deviceLimit || 0;
        return true;
    },
    canAddUser: function() {
        const count = this.userLimit || 0;
        return true;
    }
});

// Wrap _toDoc to attach methods
const origFind = Tenant._find.bind(Tenant);
Tenant._find = function(filter, opts) {
    const rows = origFind(filter, opts);
    return rows.map(r => Object.assign(r, {
        isExpired: Tenant.isExpired,
        canAddDevice: Tenant.canAddDevice,
        canAddUser: Tenant.canAddUser
    }));
};

const origFindOne = Tenant.findOne.bind(Tenant);
Tenant.findOne = function(filter) {
    const doc = origFindOne(filter);
    if (doc) Object.assign(doc, {
        isExpired: Tenant.isExpired,
        canAddDevice: Tenant.canAddDevice,
        canAddUser: Tenant.canAddUser
    });
    return doc;
};

const origFindById = Tenant.findById.bind(Tenant);
Tenant.findById = function(id) {
    const doc = origFindById(id);
    if (doc) Object.assign(doc, {
        isExpired: Tenant.isExpired,
        canAddDevice: Tenant.canAddDevice,
        canAddUser: Tenant.canAddUser
    });
    return doc;
};

module.exports = Tenant;

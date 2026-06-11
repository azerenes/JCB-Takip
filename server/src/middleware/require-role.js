const User = require('../models/User');

module.exports = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Yetkilendirme gerekli' });
        }

        const roleHierarchy = { admin: 3, operator: 2, viewer: 1 };
        const required = roleHierarchy[role] || 0;
        const current = roleHierarchy[req.user.role] || 0;

        if (current < required) {
            return res.status(403).json({
                error: `Bu islem icin ${role} yetkisi gerekli. Mevcut: ${req.user.role}`
            });
        }

        next();
    };
};

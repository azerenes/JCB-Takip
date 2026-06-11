const User = require('../models/User');

module.exports = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Yetkilendirme gerekli' });
        }

        const allowed = Array.isArray(roles) ? roles : [roles];
        const roleHierarchy = { admin: 3, operator: 2, viewer: 1 };
        const current = roleHierarchy[req.user.role] || 0;

        const hasRole = allowed.some(r => roleHierarchy[r] <= current) || allowed.includes(req.user.role);
        if (!hasRole) {
            return res.status(403).json({
                error: `Bu islem icin ${allowed.join(' veya ')} yetkisi gerekli. Mevcut: ${req.user.role}`
            });
        }

        next();
    };
};

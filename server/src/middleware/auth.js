const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

module.exports = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Yetkilendirme basligi eksik' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        const user = await User.findById(decoded.userId);
        if (!user || !user.isActive) {
            return res.status(403).json({ error: 'Kullanici bulunamadi veya pasif' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Gecersiz veya sure dolmus token' });
    }
};

module.exports.requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Giris yapilmadi' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Bu islem icin yetkiniz yok',
                required: roles,
                yourRole: req.user.role
            });
        }
        next();
    };
};

module.exports.requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Giris yapilmadi' });
        }
        if (!req.user.hasPermission(permission)) {
            return res.status(403).json({
                error: 'Bu islem icin yetkiniz yok',
                required: permission,
                yourRole: req.user.role
            });
        }
        next();
    };
};

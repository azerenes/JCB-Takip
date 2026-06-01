const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Yetkilendirme basligi eksik' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Gecersiz veya sure dolmus token' });
    }
};

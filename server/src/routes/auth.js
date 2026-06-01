const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../config');

const adminCredentials = {
    email: config.adminEmail,
    password: config.adminPassword
};

router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email ve sifre gerekli' });
    }

    if (email !== adminCredentials.email || password !== adminCredentials.password) {
        return res.status(401).json({ error: 'Gecersiz email veya sifre' });
    }

    const token = jwt.sign(
        { email, role: 'admin' },
        config.jwtSecret,
        { expiresIn: '24h' }
    );

    res.json({
        token,
        user: { email, role: 'admin' },
        expiresIn: '24h'
    });
});

router.post('/verify', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token gerekli' });

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        res.json({ valid: true, user: decoded });
    } catch (err) {
        res.json({ valid: false, error: 'Token gecersiz veya sure dolmus' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const auth = require('../middleware/auth');

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email ve sifre gerekli' });
    }

    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ error: 'Gecersiz email veya sifre' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Gecersiz email veya sifre' });
        }

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            config.jwtSecret,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                permissions: user.permissions
            },
            expiresIn: '24h'
        });
    } catch (err) {
        console.error('[Auth] Login hatasi:', err);
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.get('/me', auth, async (req, res) => {
    res.json({
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        permissions: req.user.permissions,
        notificationPreferences: req.user.notificationPreferences,
        lastLogin: req.user.lastLogin
    });
});

router.put('/me', auth, async (req, res) => {
    const { name, phone, notificationPreferences } = req.body;
    if (name) req.user.name = name;
    if (phone !== undefined) req.user.phone = phone;
    if (notificationPreferences) req.user.notificationPreferences = notificationPreferences;
    await req.user.save();
    res.json({ message: 'Profil guncellendi' });
});

router.put('/me/password', auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Mevcut ve yeni sifre gerekli' });
    }
    const isMatch = await req.user.comparePassword(currentPassword);
    if (!isMatch) {
        return res.status(401).json({ error: 'Mevcut sifre yanlis' });
    }
    req.user.password = newPassword;
    await req.user.save();
    res.json({ message: 'Sifre basariyla degistirildi' });
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

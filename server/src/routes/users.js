const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/require-role');

router.get('/', auth, requireRole('admin'), async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Kullanicilar listelenemedi' });
    }
});

router.post('/', auth, requireRole('admin'), async (req, res) => {
    try {
        const { email, password, name, role, phone, permissions } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, sifre ve isim zorunludur' });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({ error: 'Bu email zaten kayitli' });
        }

        const defaultPerms = User.getRolePermissions(role || 'viewer');
        const user = new User({
            email, password, name,
            role: role || 'viewer',
            phone: phone || '',
            permissions: permissions || defaultPerms
        });

        await user.save();
        res.status(201).json({
            message: 'Kullanici olusturuldu',
            user: { id: user._id, email: user.email, name: user.name, role: user.role }
        });
    } catch (err) {
        res.status(500).json({ error: 'Kullanici olusturulamadi' });
    }
});

router.put('/:id', auth, requireRole('admin'), async (req, res) => {
    try {
        const { name, role, phone, isActive, permissions, assignedDevices } = req.body;
        const update = {};
        if (name) update.name = name;
        if (role) { update.role = role; update.permissions = User.getRolePermissions(role); }
        if (phone !== undefined) update.phone = phone;
        if (isActive !== undefined) update.isActive = isActive;
        if (permissions) update.permissions = permissions;
        if (assignedDevices) update.assignedDevices = assignedDevices;

        const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).select('-password');
        if (!user) return res.status(404).json({ error: 'Kullanici bulunamadi' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Kullanici guncellenemedi' });
    }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            return res.status(400).json({ error: 'Kendinizi silemezsiniz' });
        }
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'Kullanici silindi' });
    } catch (err) {
        res.status(500).json({ error: 'Kullanici silinemedi' });
    }
});

router.put('/:id/permissions', auth, requireRole('admin'), async (req, res) => {
    try {
        const { permissions } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: { permissions } },
            { new: true }
        ).select('-password');
        if (!user) return res.status(404).json({ error: 'Kullanici bulunamadi' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Yetkiler guncellenemedi' });
    }
});

router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Kullanici bilgisi alinamadi' });
    }
});

router.put('/me/preferences', auth, async (req, res) => {
    try {
        const { notificationPreferences } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { notificationPreferences } },
            { new: true }
        ).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Tercihler guncellenemedi' });
    }
});

module.exports = router;

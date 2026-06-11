const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

router.get('/users', auth, auth.requireRole('admin'), async (req, res) => {
    try {
        const { role, isActive, search } = req.query;
        const filter = {};
        if (role) filter.role = role;
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 });

        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.post('/users', auth, auth.requireRole('admin'), async (req, res) => {
    try {
        const { email, password, name, role, phone, notificationPreferences } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, sifre ve isim zorunludur' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ error: 'Bu email zaten kayitli' });
        }

        const userRole = role || 'operator';
        const permissions = User.getRolePermissions(userRole);

        const user = new User({
            email,
            password,
            name,
            role: userRole,
            permissions,
            phone: phone || '',
            notificationPreferences: notificationPreferences || { email: true, sms: false, push: false }
        });

        await user.save();

        res.status(201).json({
            message: 'Kullanici basariyla olusturuldu',
            user: { id: user._id, email: user.email, name: user.name, role: user.role }
        });
    } catch (err) {
        console.error('[Admin] Kullanici olusturma hatasi:', err);
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.put('/users/:id', auth, auth.requireRole('admin'), async (req, res) => {
    try {
        const { name, role, isActive, phone, notificationPreferences, permissions } = req.body;
        const update = {};
        if (name) update.name = name;
        if (role) {
            update.role = role;
            update.permissions = User.getRolePermissions(role);
        }
        if (isActive !== undefined) update.isActive = isActive;
        if (phone !== undefined) update.phone = phone;
        if (notificationPreferences) update.notificationPreferences = notificationPreferences;
        if (permissions && req.body.role === 'admin') update.permissions = permissions;

        const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
            .select('-password');

        if (!user) return res.status(404).json({ error: 'Kullanici bulunamadi' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.delete('/users/:id', auth, auth.requireRole('admin'), async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ error: 'Kendinizi silemezsiniz' });
        }
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ error: 'Kullanici bulunamadi' });
        res.json({ message: 'Kullanici silindi' });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

router.get('/users/stats', auth, auth.requireRole('admin'), async (req, res) => {
    try {
        const total = await User.countDocuments();
        const byRole = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);
        const active = await User.countDocuments({ isActive: true });
        const inactive = await User.countDocuments({ isActive: false });

        res.json({ total, active, inactive, byRole });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

module.exports = router;

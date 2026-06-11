const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const otaService = require('../services/ota-service');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/require-role');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 }
});

router.post('/upload', auth, requireRole('admin'), upload.single('firmware'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Firmware dosyasi gerekli' });
        }

        const { version, changelog } = req.body;
        if (!version) {
            return res.status(400).json({ error: 'Versiyon numarasi gerekli' });
        }

        const result = await otaService.uploadFirmware(
            version,
            req.file.buffer,
            changelog || ''
        );

        res.json({
            message: 'Firmware yuklendi',
            ...result
        });
    } catch (err) {
        console.error('[OTA] Yukleme hatasi:', err);
        res.status(500).json({ error: 'Firmware yuklenemedi' });
    }
});

router.get('/check', async (req, res) => {
    try {
        const { device, version } = req.query;
        if (!device || !version) {
            return res.status(400).json({ error: 'device ve version parametreleri gerekli' });
        }

        const update = otaService.checkUpdate(device, version);
        res.json(update);
    } catch (err) {
        res.status(500).json({ error: 'Guncelleme kontrolu basarisiz' });
    }
});

router.get('/download/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const stream = otaService.getBinaryStream(filename);

        if (!stream) {
            return res.status(404).json({ error: 'Dosya bulunamadi' });
        }

        const size = otaService.getBinarySize(filename);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', size);
        stream.pipe(res);
    } catch (err) {
        res.status(500).json({ error: 'Indirme basarisiz' });
    }
});

router.get('/versions', auth, requireRole('admin'), async (req, res) => {
    try {
        const versions = otaService.listVersions();
        res.json(versions);
    } catch (err) {
        res.status(500).json({ error: 'Versiyonlar listelenemedi' });
    }
});

module.exports = router;

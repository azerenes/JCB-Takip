// JCB Tracker - OTA Firmware Y??netim Servisi
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Device = require('../database/models/Device');

const FW_DIR = path.join(__dirname, '../../firmware_bin');
const FW_META_FILE = path.join(FW_DIR, 'firmware.json');

if (!fs.existsSync(FW_DIR)) {
    fs.mkdirSync(FW_DIR, { recursive: true });
}

function loadMeta() {
    try {
        if (fs.existsSync(FW_META_FILE)) {
            return JSON.parse(fs.readFileSync(FW_META_FILE, 'utf-8'));
        }
    } catch (err) {
        console.error('[OTA] Meta yuklenemedi:', err.message);
    }
    return { versions: [], latest: null };
}

function saveMeta(meta) {
    fs.writeFileSync(FW_META_FILE, JSON.stringify(meta, null, 2));
}

async function uploadFirmware(version, binaryBuffer, changelog = '') {
    const filename = `jcb_firmware_${version.replace(/\./g, '_')}.bin`;
    const filepath = path.join(FW_DIR, filename);
    const hash = crypto.createHash('sha256').update(binaryBuffer).digest('hex');
    const size = binaryBuffer.length;

    fs.writeFileSync(filepath, binaryBuffer);

    const meta = loadMeta();
    meta.versions.push({
        version,
        filename,
        hash,
        size,
        changelog,
        uploadedAt: new Date().toISOString()
    });
    meta.latest = version;
    saveMeta(meta);

    console.log(`[OTA] Firmware yuklendi: ${version} (${(size / 1024).toFixed(1)} KB)`);
    return { version, filename, hash, size };
}

function checkUpdate(deviceId, currentVersion) {
    const meta = loadMeta();
    if (!meta.latest) return null;
    if (meta.latest === currentVersion) return null;

    const ver = meta.versions.find(v => v.version === meta.latest);
    if (!ver) return null;

    return {
        version: ver.version,
        binary_url: `/api/ota/download/${ver.filename}`,
        hash: ver.hash,
        size: ver.size,
        changelog: ver.changelog
    };
}

function getBinaryStream(filename) {
    const filepath = path.join(FW_DIR, filename);
    if (!fs.existsSync(filepath)) return null;
    return fs.createReadStream(filepath);
}

function getBinarySize(filename) {
    const filepath = path.join(FW_DIR, filename);
    if (!fs.existsSync(filepath)) return 0;
    return fs.statSync(filepath).size;
}

function listVersions() {
    return loadMeta().versions.sort((a, b) => {
        return new Date(b.uploadedAt) - new Date(a.uploadedAt);
    });
}

module.exports = { uploadFirmware, checkUpdate, getBinaryStream, getBinarySize, listVersions };


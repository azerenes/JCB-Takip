// JCB CSV Log Parser
// SD karttan alinan CSV dosyasini isler ve API'ye yukler
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:3000/api/backlog';
const API_KEY = process.env.API_KEY || '';

function parseCSVLine(line) {
    const parts = line.split(',');
    if (parts.length < 4) return null;

    const timestamp = parseInt(parts[0].trim());
    const lat = parseFloat(parts[1].trim());
    const lng = parseFloat(parts[2].trim());
    const speed = parseFloat(parts[3].trim()) || 0;
    const engineHours = parseFloat(parts[4].trim()) || 0;
    const optoCount = parseInt(parts[5].trim()) || 0;
    const batteryMv = parseFloat(parts[6].trim()) || 0;

    if (isNaN(timestamp) || isNaN(lat) || isNaN(lng)) return null;

    return {
        timestamp,
        lat,
        lng,
        speed,
        engineHours,
        optoCount,
        batteryMv
    };
}

function parseCSVFile(filepath) {
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.trim().split('\n');
    const logs = [];
    let headerSkipped = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (!headerSkipped && trimmed.startsWith('timestamp')) {
            headerSkipped = true;
            continue;
        }

        const parsed = parseCSVLine(trimmed);
        if (parsed) {
            logs.push(parsed);
        }
    }

    return logs;
}

async function uploadToAPI(deviceId, apiKey, logs, batchSize = 1000) {
    const totalLogs = logs.length;
    let uploaded = 0;

    console.log(`[Upload] ${totalLogs} kayit yukleniyor...`);

    for (let i = 0; i < totalLogs; i += batchSize) {
        const batch = logs.slice(i, i + batchSize);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                    'X-Device-Id': deviceId
                },
                body: JSON.stringify({
                    deviceId,
                    apiKey,
                    logs: batch
                })
            });

            const result = await response.json();
            uploaded += batch.length;
            console.log(`[Upload] ${Math.min(i + batchSize, totalLogs)}/${totalLogs} - ${result.message || 'OK'}`);
        } catch (err) {
            console.error(`[Upload] Batch hatasi (${i}):`, err.message);
        }
    }

    console.log(`[Upload] Tamamlandi: ${uploaded}/${totalLogs}`);
    return { uploaded, total: totalLogs };
}

// CLI kullanimi
async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log('Kullanim: node csv_parser.js <deviceId> <csv_file> [apiKey]');
        console.log('Ornek: node csv_parser.js JCB-001 log.csv my_api_key');
        process.exit(1);
    }

    const deviceId = args[0];
    const filepath = args[1];
    const apiKey = args[2] || API_KEY;

    if (!fs.existsSync(filepath)) {
        console.error(`Dosya bulunamadi: ${filepath}`);
        process.exit(1);
    }

    console.log(`[Parser] Dosya: ${filepath}`);
    const logs = parseCSVFile(filepath);
    console.log(`[Parser] ${logs.length} gecerli kayit bulundu`);

    if (logs.length === 0) {
        console.log('Yuklenecek kayit yok');
        process.exit(0);
    }

    await uploadToAPI(deviceId, apiKey, logs);
}

if (require.main === module) {
    main();
}

module.exports = { parseCSVLine, parseCSVFile, uploadToAPI };

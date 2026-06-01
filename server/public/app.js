// JCB Tracker - Web Panel Uygulamasi
const API_BASE = '/api';
let token = localStorage.getItem('jcb_token');
let map = null;
let markers = {};
let socket = null;
let deviceChart = null;
let alertChart = null;

// ===== AUTH =====
async function checkAuth() {
    if (!token) {
        const email = prompt('Email:');
        const password = prompt('Sifre:');
        if (email && password) {
            await login(email, password);
        } else {
            window.location.href = '/';
        }
    }
}

async function login(email, password) {
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.token) {
            token = data.token;
            localStorage.setItem('jcb_token', token);
            return true;
        }
        alert('Giris basarisiz');
        return false;
    } catch (err) {
        alert('Sunucuya baglanilamadi');
        return false;
    }
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// ===== SOCKET.IO =====
function connectSocket() {
    socket = io({
        auth: { token },
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => console.log('[WS] Baglandi'));

    socket.on('live:update', (data) => {
        updateMarker(data);
        const deviceItem = document.querySelector(`[data-device="${data.deviceId}"]`);
        if (deviceItem) {
            const dot = deviceItem.querySelector('.status-dot');
            if (dot) dot.className = 'status-dot online';
        }
    });

    socket.on('disconnect', () => console.log('[WS] Baglanti koptu'));
}

function updateMarker(data) {
    if (!map) return;
    const id = data.deviceId;
    const lat = data.lat;
    const lng = data.lng;

    if (markers[id]) {
        markers[id].setLatLng([lat, lng]);
        markers[id].setPopupContent(`${id}<br>${data.speed ? data.speed + ' km/h' : 'Duraklı'}`);
    } else {
        const color = data.speed > 0 ? '#16a34a' : '#2563eb';
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
        markers[id] = L.marker([lat, lng], { icon }).addTo(map);
        markers[id].bindPopup(`<b>${id}</b><br>${data.speed || 0} km/h`);
    }
}

// ===== HARITA =====
function initMap(devices) {
    if (map) return;
    map = L.map('map').setView([39.0, 35.0], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    }).addTo(map);

    if (devices) {
        devices.forEach(d => {
            if (d.lastLocation && d.lastLocation.lat) {
                updateMarker({
                    deviceId: d.deviceId,
                    lat: d.lastLocation.lat,
                    lng: d.lastLocation.lng,
                    speed: d.lastLocation.speed
                });
            }
        });

        if (devices.length > 0 && devices[0].lastLocation?.lat) {
            map.setView([devices[0].lastLocation.lat, devices[0].lastLocation.lng], 12);
        }
    }
}

// ===== CIHAZ LISTESI =====
async function loadDevices() {
    try {
        const groupFilter = document.getElementById('groupFilter')?.value || '';
        const url = `${API_BASE}/device${groupFilter ? '?group=' + groupFilter : ''}`;
        const res = await fetch(url, { headers: getHeaders() });
        const devices = await res.json();

        const container = document.getElementById('deviceItems');
        if (!container) return;

        container.innerHTML = devices.map(d => {
            const isOnline = d.lastLocation?.updatedAt &&
                (Date.now() - new Date(d.lastLocation.updatedAt).getTime()) < 300000;
            return `
                <div class="device-item" data-device="${d.deviceId}" onclick="showDeviceInfo('${d.deviceId}')">
                    <div class="device-name">${d.name || d.deviceId}</div>
                    <div class="device-id">${d.deviceId} ${d.plate ? '| ' + d.plate : ''}</div>
                    <div class="device-status">
                        <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
                        ${isOnline ? 'Çevrimiçi' : 'Çevrimdışı'} · ${d.group}
                    </div>
                </div>
            `;
        }).join('');

        return devices;
    } catch (err) {
        console.error('Cihaz listesi hatasi:', err);
    }
}

async function loadGroups() {
    try {
        const res = await fetch(`${API_BASE}/panel/summary`, { headers: getHeaders() });
        const data = await res.json();
        const select = document.getElementById('groupFilter');
        if (select && data.groups) {
            select.innerHTML = '<option value="">Tüm Gruplar</option>' +
                data.groups.map(g => `<option value="${g}">${g}</option>`).join('');
        }
    } catch (err) {
        console.error('Grup yukleme hatasi:', err);
    }
}

async function showDeviceInfo(deviceId) {
    try {
        const res = await fetch(`${API_BASE}/device/${deviceId}`, { headers: getHeaders() });
        const device = await res.json();

        const content = document.getElementById('infoContent');
        if (!content) return;

        document.getElementById('infoTitle').textContent = device.name || device.deviceId;

        content.innerHTML = `
            <div class="info-row"><span class="label">Cihaz ID</span><span class="value">${device.deviceId}</span></div>
            <div class="info-row"><span class="label">Plaka</span><span class="value">${device.plate || '-'}</span></div>
            <div class="info-row"><span class="label">Grup</span><span class="value">${device.group}</span></div>
            <div class="info-row"><span class="label">Durum</span><span class="value">${device.status}</span></div>
            <div class="info-row"><span class="label">Enlem</span><span class="value">${device.lastLocation?.lat?.toFixed(6) || '-'}</span></div>
            <div class="info-row"><span class="label">Boylam</span><span class="value">${device.lastLocation?.lng?.toFixed(6) || '-'}</span></div>
            <div class="info-row"><span class="label">Hız</span><span class="value">${device.lastLocation?.speed?.toFixed(1) || '0'} km/h</span></div>
            <div class="info-row"><span class="label">Motor Saati</span><span class="value">${device.lastLocation?.engineHours?.toFixed(1) || '0'} h</span></div>
            <div class="info-row"><span class="label">Son Güncelleme</span><span class="value">${device.lastLocation?.updatedAt ? new Date(device.lastLocation.updatedAt).toLocaleString('tr-TR') : '-'}</span></div>
            <div class="info-row"><span class="label">24s Kayıt</span><span class="value">${device.stats?.last24hLogs || 0}</span></div>
            <div style="margin-top:16px;text-align:center">
                <div style="display:flex;gap:8px;justify-content:center">
                    <button onclick="loadDeviceRoute('${deviceId}')" class="btn-outline">Rotayı Göster</button>
                    <button onclick="loadDeviceHistory('${deviceId}')" class="btn-outline">Geçmiş</button>
                </div>
            </div>
        `;

        document.getElementById('infoPanel')?.classList.add('open');

        if (device.lastLocation?.lat) {
            map.setView([device.lastLocation.lat, device.lastLocation.lng], 15);
            if (markers[deviceId]) {
                markers[deviceId].openPopup();
            }
        }
    } catch (err) {
        console.error('Cihaz detay hatasi:', err);
    }
}

function closeInfo() {
    document.getElementById('infoPanel')?.classList.remove('open');
}

async function loadDeviceRoute(deviceId) {
    const end = Date.now();
    const start = end - 24 * 3600000;
    const res = await fetch(`${API_BASE}/panel/device-history/${deviceId}?start=${start}&end=${end}`, {
        headers: getHeaders()
    });
    const logs = await res.json();

    if (logs.length < 2) {
        alert('Rota icin yeterli veri yok');
        return;
    }

    const points = logs.map(l => [l.latitude, l.longitude]).reverse();
    L.polyline(points, { color: '#2563eb', weight: 3 }).addTo(map);
    map.fitBounds(points);
}

async function loadDeviceHistory(deviceId) {
    const end = Date.now();
    const start = end - 24 * 3600000;
    const res = await fetch(`${API_BASE}/panel/device-history/${deviceId}?start=${start}&end=${end}`, {
        headers: getHeaders()
    });
    const logs = await res.json();
    // History list view
}

// ===== DASHBOARD =====
async function loadDashboard() {
    try {
        const res = await fetch(`${API_BASE}/panel/summary`, { headers: getHeaders() });
        const data = await res.json();

        document.getElementById('totalDevices').textContent = data.devices.total;
        document.getElementById('activeDevices').textContent = data.devices.active;
        document.getElementById('unacknowledgedAlerts').textContent = data.alerts.unacknowledged;
        document.getElementById('criticalAlerts').textContent = data.alerts.critical;
        document.getElementById('totalGroups').textContent = data.groups?.length || 0;

        // Cevrimici cihaz sayisi
        const liveRes = await fetch(`${API_BASE}/panel/devices-live`, { headers: getHeaders() });
        const liveDevices = await liveRes.json();
        const online = liveDevices.filter(d => d.isOnline).length;
        document.getElementById('onlineDevices').textContent = online;

        // Chart: Cihaz Durumu
        const ctx1 = document.getElementById('deviceChart')?.getContext('2d');
        if (ctx1 && deviceChart) deviceChart.destroy();
        if (ctx1) {
            deviceChart = new Chart(ctx1, {
                type: 'doughnut',
                data: {
                    labels: ['Aktif', 'Pasif', 'Bakımda'],
                    datasets: [{
                        data: [data.devices.active, data.devices.inactive, data.devices.maintenance],
                        backgroundColor: ['#16a34a', '#64748b', '#ca8a04']
                    }]
                }
            });
        }

        // Chart: Uyari Dagilimi
        const ctx2 = document.getElementById('alertChart')?.getContext('2d');
        if (ctx2 && alertChart) alertChart.destroy();
        if (ctx2) {
            alertChart = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Kritik', 'Uyarı', 'Bilgi'],
                    datasets: [{
                        data: [data.alerts.critical, data.alerts.unacknowledged - data.alerts.critical, data.alerts.today - data.alerts.unacknowledged],
                        backgroundColor: ['#dc2626', '#ca8a04', '#2563eb']
                    }]
                }
            });
        }
    } catch (err) {
        console.error('Dashboard yukleme hatasi:', err);
    }
}

async function loadAlerts() {
    try {
        const severity = document.getElementById('alertSeverityFilter')?.value || '';
        const url = `${API_BASE}/panel/alerts?limit=50${severity ? '&severity=' + severity : ''}`;
        const res = await fetch(url, { headers: getHeaders() });
        const alerts = await res.json();

        const body = document.getElementById('alertsBody');
        if (!body) return;

        body.innerHTML = alerts.map(a => `
            <tr>
                <td>${a.deviceId}</td>
                <td>${a.type}</td>
                <td>${a.message}</td>
                <td><span class="severity-badge ${a.severity}">${a.severity}</span></td>
                <td>${new Date(a.createdAt).toLocaleString('tr-TR')}</td>
                <td>
                    ${!a.acknowledged ? `<button onclick="acknowledgeAlert('${a._id}')" class="btn-outline" style="padding:4px 12px">Onayla</button>` : '✓'}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Uyari listesi hatasi:', err);
    }
}

async function acknowledgeAlert(id) {
    try {
        await fetch(`${API_BASE}/panel/alerts/${id}/acknowledge`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ acknowledgedBy: 'admin' })
        });
        loadAlerts();
    } catch (err) {
        console.error('Uyari onaylama hatasi:', err);
    }
}

// ===== RAPORLAR =====
async function loadReportDevices() {
    try {
        const res = await fetch(`${API_BASE}/device`, { headers: getHeaders() });
        const devices = await res.json();
        const select = document.getElementById('reportDevice');
        if (select) {
            select.innerHTML = devices.map(d =>
                `<option value="${d.deviceId}">${d.name || d.deviceId} ${d.plate ? '(' + d.plate + ')' : ''}</option>`
            ).join('');
        }
    } catch (err) {
        console.error('Rapor cihaz yukleme hatasi:', err);
    }
}

async function downloadCSV() {
    const deviceId = document.getElementById('reportDevice')?.value;
    if (!deviceId) return alert('Cihaz secin');

    const start = document.getElementById('reportStart')?.value;
    const end = document.getElementById('reportEnd')?.value;
    const params = new URLSearchParams({ format: 'csv' });
    if (start) params.set('start', new Date(start).getTime());
    if (end) params.set('end', new Date(end).getTime());

    window.open(`${API_BASE}/reports/device-report/${deviceId}?${params}`, '_blank');
}

async function downloadPDF() {
    const deviceId = document.getElementById('reportDevice')?.value;
    if (!deviceId) return alert('Cihaz secin');

    const start = document.getElementById('reportStart')?.value;
    const end = document.getElementById('reportEnd')?.value;
    const params = new URLSearchParams({ format: 'pdf' });
    if (start) params.set('start', new Date(start).getTime());
    if (end) params.set('end', new Date(end).getTime());

    window.open(`${API_BASE}/reports/device-report/${deviceId}?${params}`, '_blank');
}

async function loadDeviceReport() {
    const deviceId = document.getElementById('reportDevice')?.value;
    if (!deviceId) return alert('Cihaz secin');

    const start = document.getElementById('reportStart')?.value;
    const end = document.getElementById('reportEnd')?.value;
    const params = new URLSearchParams();
    if (start) params.set('start', new Date(start).getTime());
    if (end) params.set('end', new Date(end).getTime());

    try {
        const res = await fetch(`${API_BASE}/reports/device-report/${deviceId}?${params}`, { headers: getHeaders() });
        const data = await res.json();

        const container = document.getElementById('deviceReportResult');
        if (!container) return;

        if (data.device && data.logs) {
            container.innerHTML = `
                <h4>${data.device.name} (${data.device.deviceId})</h4>
                <p>Toplam: ${data.logs.length} kayit</p>
                <table class="report-table">
                    <thead><tr><th>Tarih</th><th>Enlem</th><th>Boylam</th><th>Hız</th><th>Motor</th></tr></thead>
                    <tbody>
                        ${data.logs.slice(0, 100).map(l => `
                            <tr>
                                <td>${new Date(l.timestamp).toLocaleString('tr-TR')}</td>
                                <td>${l.latitude.toFixed(6)}</td>
                                <td>${l.longitude.toFixed(6)}</td>
                                <td>${l.speedKmh.toFixed(1)}</td>
                                <td>${l.engineHours.toFixed(1)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    } catch (err) {
        console.error('Rapor yukleme hatasi:', err);
    }
}

async function loadSummaryReport() {
    const start = document.getElementById('summaryStart')?.value;
    const end = document.getElementById('summaryEnd')?.value;
    const params = new URLSearchParams();
    if (start) params.set('start', new Date(start).getTime());
    if (end) params.set('end', new Date(end).getTime());

    try {
        const res = await fetch(`${API_BASE}/reports/summary-report?${params}`, { headers: getHeaders() });
        const data = await res.json();

        const container = document.getElementById('summaryReportResult');
        if (!container) return;

        container.innerHTML = `
            <h4>Ozet Rapor</h4>
            <p>Toplam Cihaz: ${data.totalDevices} · Toplam Kayit: ${data.totalLogs} · Toplam Uyari: ${data.totalAlerts}</p>
            <table class="report-table">
                <thead><tr><th>Cihaz</th><th>Plaka</th><th>Kayit</th><th>Ort. Hız</th><th>Max Hız</th><th>Calisma</th></tr></thead>
                <tbody>
                    ${data.devices.map(d => `
                        <tr>
                            <td>${d.name || d.deviceId}</td>
                            <td>${d.plate || '-'}</td>
                            <td>${d.logCount}</td>
                            <td>${d.avgSpeed} km/h</td>
                            <td>${d.maxSpeed} km/h</td>
                            <td>${d.engineHoursUsed} h</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error('Ozet rapor hatasi:', err);
    }
}

// ===== SEARCH =====
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchDevice');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('.device-item').forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(q) ? 'block' : 'none';
            });
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('jcb_token');
            window.location.reload();
        });
    }
});

// ===== INIT BY PAGE =====
async function initPage() {
    await checkAuth();
    if (!token) return;

    connectSocket();

    const path = window.location.pathname;

    if (path.endsWith('index.html') || path === '/' || path.endsWith('/')) {
        const devices = await loadDevices();
        await loadGroups();
        initMap(devices);

        setInterval(async () => {
            await loadDevices();
        }, 30000);
    }

    if (path.includes('dashboard.html')) {
        await loadDashboard();
        await loadAlerts();
        setInterval(loadDashboard, 30000);
        setInterval(loadAlerts, 60000);
    }

    if (path.includes('reports.html')) {
        await loadReportDevices();
    }
}

initPage();

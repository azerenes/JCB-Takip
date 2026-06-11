let saToken = null;

function getSAToken() { return saToken || localStorage.getItem('token'); }

async function saApi(path, opts = {}) {
    const res = await fetch(`/api/superadmin${path}`, {
        ...opts,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSAToken()}`, ...opts.headers }
    });
    const data = await res.json();
    if (!res.ok) { showNotification(data.error || 'Hata', 'error'); return null; }
    return data;
}

function loadSuperAdmin() {
    saToken = localStorage.getItem('token');
    const main = document.getElementById('mainContent');

    let html = `
    <div style="margin-bottom:20px;">
        <h2 style="font-size:20px;font-weight:600;margin-bottom:4px;">Super Admin Paneli</h2>
        <p style="color:var(--text2);font-size:14px;">Tum tenant'lari ve sistemi yonetin</p>
    </div>
    <div class="stats-grid" id="saStats">
        <div class="stat-card"><div class="label">Toplam Tenant</div><div class="value" id="saTenants">-</div></div>
        <div class="stat-card"><div class="label">Toplam Cihaz</div><div class="value" id="saDevices">-</div></div>
        <div class="stat-card"><div class="label">Toplam Kullanici</div><div class="value" id="saUsers">-</div></div>
        <div class="stat-card"><div class="label">Aktif Tenant</div><div class="value" id="saActiveTenants">-</div></div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:16px;">
        <button onclick="showAddTenant()" style="padding:10px 20px;background:var(--primary);border:none;border-radius:8px;color:#fff;cursor:pointer;">+ Tenant Ekle</button>
        <button onclick="showGenerateLicenses()" style="padding:10px 20px;background:var(--surface2);border:none;border-radius:8px;color:var(--text);cursor:pointer;">Lisans Uret</button>
        <button onclick="loadTenantList()" style="padding:10px 20px;background:var(--surface2);border:none;border-radius:8px;color:var(--text);cursor:pointer;">Yenile</button>
    </div>
    <div id="saTenantList"><p style="color:var(--text2);">Yukleniyor...</p></div>`;

    main.innerHTML = html;
    loadSADashboard();
    loadTenantList();
}

async function loadSADashboard() {
    const d = await saApi('/dashboard');
    if (!d) return;
    document.getElementById('saTenants').textContent = d.totalTenants;
    document.getElementById('saDevices').textContent = d.totalDevices;
    document.getElementById('saUsers').textContent = d.totalUsers;
    document.getElementById('saActiveTenants').textContent = d.activeTenants;
}

async function loadTenantList() {
    const tenants = await saApi('/tenants');
    if (!tenants) return;
    const c = document.getElementById('saTenantList');
    if (tenants.length === 0) { c.innerHTML = '<p style="color:var(--text2);">Henuz tenant yok</p>'; return; }

    c.innerHTML = `<table style="width:100%;border-collapse:collapse;">
        <tr style="color:var(--text2);font-size:13px;"><th style="text-align:left;padding:8px;">Firma</th><th style="text-align:left;padding:8px;">E-posta</th><th style="text-align:left;padding:8px;">Lisans</th><th style="text-align:left;padding:8px;">Cihaz</th><th style="text-align:left;padding:8px;">Kullanici</th><th style="text-align:left;padding:8px;">Bitis</th><th></th></tr>
        ${tenants.map(t => `<tr style="border-bottom:1px solid var(--surface2);font-size:14px;">
            <td style="padding:8px;">${t.companyName}</td>
            <td style="padding:8px;color:var(--text2);font-size:13px;">${t.contactEmail}</td>
            <td style="padding:8px;"><span style="background:var(--surface2);padding:2px 8px;border-radius:4px;font-size:12px;">${t.license.type}</span></td>
            <td style="padding:8px;">${t.stats?.deviceCount || 0}</td>
            <td style="padding:8px;">${t.stats?.userCount || 0}</td>
            <td style="padding:8px;font-size:12px;color:${new Date(t.license.expiresAt) < new Date() ? 'var(--danger)' : 'var(--text2)'}">${new Date(t.license.expiresAt).toLocaleDateString('tr-TR')}</td>
            <td style="padding:8px;"><button onclick="deleteTenant('${t._id}')" style="padding:4px 8px;background:var(--danger);border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:11px;">Sil</button></td>
        </tr>`).join('')}</table>`;
}

function showAddTenant() {
    const name = prompt('Firma adi:');
    if (!name) return;
    const email = prompt('E-posta:');
    if (!email) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);
    saApi('/tenants', { method:'POST', body:JSON.stringify({ companyName:name, slug, contactEmail:email }) }).then(r => {
        if (r) { showNotification('Tenant olusturuldu', 'success'); loadTenantList(); loadSADashboard(); }
    });
}

function deleteTenant(id) {
    if (!confirm('Bu tenant ve tum verilerini silmek istediginize emin misiniz?')) return;
    saApi(`/tenants/${id}`, { method:'DELETE' }).then(() => { showNotification('Silindi', 'success'); loadTenantList(); loadSADashboard(); });
}

function showGenerateLicenses() {
    const count = prompt('Kac adet lisans uretilecek?', '1');
    if (!count) return;
    const type = prompt('Lisans turu (trial/basic/professional/enterprise):', 'professional');
    if (!type) return;
    const deviceLimit = prompt('Cihaz limiti:', '50');
    if (!deviceLimit) return;
    saApi('/licenses/generate', { method:'POST', body:JSON.stringify({ count:parseInt(count), type, deviceLimit:parseInt(deviceLimit) }) }).then(r => {
        if (r) {
            const keys = r.map(l => l.key).join('\n');
            alert('Lisanslar olusturuldu:\n\n' + keys);
            showNotification(`${r.length} lisans olusturuldu`, 'success');
        }
    });
}

function showNotification(msg, type) {
    const n = document.createElement('div');
    n.textContent = msg;
    Object.assign(n.style, { padding:'10px 16px', borderRadius:'8px', marginBottom:'8px', fontSize:'13px', background: type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--primary)', color:'#fff', position:'fixed', bottom:'20px', right:'20px', zIndex:'9999', animation:'slideIn 0.3s' });
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

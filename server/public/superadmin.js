const API = '/api';
let token = localStorage.getItem('jcb_token');

async function api(path, opts = {}) {
    const res = await fetch(`${API}/superadmin${path}`, {
        ...opts,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers }
    });
    if (res.status === 401) { window.location.href = '/app.html'; return null; }
    if (res.status === 403) { showNotification('Yetkiniz yok', 'error'); return null; }
    const data = await res.json();
    if (!res.ok) { showNotification(data.error || 'Hata', 'error'); return null; }
    return data;
}

function showNotification(msg, type = 'info') {
    const c = document.getElementById('notificationContainer');
    if (!c) return;
    const n = document.createElement('div');
    n.textContent = msg;
    Object.assign(n.style, { padding: '12px 20px', borderRadius: '8px', marginBottom: '8px', fontSize: '13px', fontWeight: '500', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', animation: 'slideIn 0.3s ease' });
    n.style.background = type === 'error' ? '#fee2e2' : type === 'success' ? '#dcfce7' : '#e0f2fe';
    n.style.color = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--primary)';
    c.appendChild(n);
    setTimeout(() => { n.style.opacity = '0'; n.style.transition = 'opacity 0.3s'; setTimeout(() => n.remove(), 300); }, 3000);
}

async function loadTenants() {
    const data = await api('/tenants');
    if (!data) return;
    const tbody = document.getElementById('saTenantBody');
    tbody.innerHTML = data.tenants.map(t => {
        const lic = t.license || {};
        const expDate = lic.expiresAt ? new Date(lic.expiresAt) : null;
        const expired = expDate && expDate < new Date();
        const badgeCls = expired ? 'badge-expired' : lic.type === 'trial' ? 'badge-trial' : 'badge-active';
        return `<tr>
            <td><strong>${t.companyName}</strong></td>
            <td>${t.contactEmail || '-'}</td>
            <td><span class="badge ${badgeCls}">${lic.type || 'trial'}</span></td>
            <td>${t.deviceCount || 0} / ${lic.deviceLimit || '-'}</td>
            <td>${t.userCount || 0} / ${lic.userLimit || '-'}</td>
            <td>${expDate ? expDate.toLocaleDateString('tr-TR') : '-'}</td>
            <td>
                <button onclick="editTenant('${t._id}')" style="padding:4px 12px;font-size:12px;border:1px solid var(--border);border-radius:6px;background:transparent;cursor:pointer">Düzenle</button>
                <button onclick="deleteTenant('${t._id}')" style="padding:4px 12px;font-size:12px;border:1px solid var(--danger);border-radius:6px;background:transparent;color:var(--danger);cursor:pointer">Sil</button>
            </td>
        </tr>`;
    }).join('');
}

async function loadLicenses() {
    const data = await api('/licenses');
    if (!data) return;
    const tbody = document.getElementById('saLicenseBody');
    tbody.innerHTML = data.licenses.map(l => {
        const created = new Date(l.createdAt).toLocaleDateString('tr-TR');
        const expires = l.expiresAt ? new Date(l.expiresAt).toLocaleDateString('tr-TR') : '-';
        return `<tr>
            <td>${l.tenantName || '-'}</td>
            <td style="font-family:monospace;font-size:12px">${l.activationKey}</td>
            <td>${l.type}</td>
            <td>${l.deviceLimit}</td>
            <td>${created}</td>
            <td>${expires}</td>
        </tr>`;
    }).join('');
}

async function loadStats() {
    const data = await api('/dashboard');
    if (!data) return;
    document.getElementById('saTotalTenants').textContent = data.totalTenants;
    document.getElementById('saActiveLicenses').textContent = data.activeLicenses;
    document.getElementById('saTrialTenants').textContent = data.trialTenants;
    document.getElementById('saExpiredTenants').textContent = data.expiredLicenses;
    document.getElementById('saSystemInfo').textContent = JSON.stringify(data.system, null, 2);
    document.getElementById('saRecentActivity').textContent = data.recentActivity || 'Veri bulunamadı';
}

function switchSaTab(tab, btn) {
    document.querySelectorAll('.sa-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    ['tenants', 'licenses', 'stats'].forEach(t => {
        document.getElementById(`saTab${t.charAt(0).toUpperCase() + t.slice(1)}`).style.display = t === tab ? 'block' : 'none';
    });
    if (tab === 'tenants') loadTenants();
    if (tab === 'licenses') loadLicenses();
    if (tab === 'stats') loadStats();
}

function showTenantModal(data) {
    document.getElementById('tenantId').value = data?._id || '';
    document.getElementById('tCompanyName').value = data?.companyName || '';
    document.getElementById('tSlug').value = data?.slug || '';
    document.getElementById('tEmail').value = data?.contactEmail || '';
    document.getElementById('tPhone').value = data?.contactPhone || '';
    document.getElementById('tLicenseType').value = data?.license?.type || 'trial';
    document.getElementById('tDeviceLimit').value = data?.license?.deviceLimit || 10;
    document.getElementById('tUserLimit').value = data?.license?.userLimit || 5;
    if (data?.license?.expiresAt) {
        document.getElementById('tExpires').value = new Date(data.license.expiresAt).toISOString().slice(0, 10);
    } else {
        const d = new Date(); d.setDate(d.getDate() + 30);
        document.getElementById('tExpires').value = d.toISOString().slice(0, 10);
    }
    document.getElementById('tenantModalTitle').textContent = data ? 'Firma Düzenle' : 'Yeni Firma Ekle';
    document.getElementById('tenantModal').style.display = 'flex';
}

function closeTenantModal() { document.getElementById('tenantModal').style.display = 'none'; }

function editTenant(id) {
    fetch(`${API}/superadmin/tenants`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => {
            const t = d.tenants.find(x => x._id === id);
            if (t) showTenantModal(t);
        });
}

async function saveTenant() {
    const id = document.getElementById('tenantId').value;
    const body = {
        companyName: document.getElementById('tCompanyName').value,
        slug: document.getElementById('tSlug').value,
        contactEmail: document.getElementById('tEmail').value,
        contactPhone: document.getElementById('tPhone').value,
        license: {
            type: document.getElementById('tLicenseType').value,
            deviceLimit: parseInt(document.getElementById('tDeviceLimit').value),
            userLimit: parseInt(document.getElementById('tUserLimit').value),
            expiresAt: document.getElementById('tExpires').value
        }
    };
    if (!body.companyName || !body.slug) { showNotification('Firma adı ve slug zorunlu', 'error'); return; }
    const data = id ? await api(`/tenants/${id}`, { method: 'PUT', body: JSON.stringify(body) }) : await api('/tenants', { method: 'POST', body: JSON.stringify(body) });
    if (data) { showNotification(id ? 'Firma güncellendi' : 'Firma oluşturuldu', 'success'); closeTenantModal(); loadTenants(); }
}

async function deleteTenant(id) {
    if (!confirm('Bu firmayı silmek istediğinize emin misiniz?')) return;
    const data = await api(`/tenants/${id}`, { method: 'DELETE' });
    if (data) { showNotification('Firma silindi', 'success'); loadTenants(); }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!token) { window.location.href = '/app.html'; return; }
    const me = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    if (!me.isSuperAdmin) { showNotification('Bu sayfaya erişim yetkiniz yok', 'error'); setTimeout(() => { window.location.href = '/app.html'; }, 1500); return; }
    document.getElementById('userName').textContent = `👤 ${me.name || me.email}`;
    loadTenants();
});

document.getElementById('logoutBtn').addEventListener('click', () => { localStorage.removeItem('jcb_token'); window.location.href = '/app.html'; });
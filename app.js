// app.js - Dirgantara Jaya Driving School App
// Menggunakan Firebase Firestore sebagai database real-time

import {
  db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy
} from './firebase-config.js';

// ================================================================
//  STATE GLOBAL
// ================================================================
let currentRole = 'admin';
let siswaCacheList = []; // cache data siswa dari Firestore
let currentBayarId = null;
let currentAbsenSiswaId = null;
let currentAbsenRole = null;

// ================================================================
//  INISIALISASI
// ================================================================
window.addEventListener('DOMContentLoaded', () => {
  setTodayDate();
  listenSiswa();
});

function setTodayDate() {
  const today = new Date().toISOString().split('T')[0];
  const el = document.getElementById('dTglDaftar');
  const el2 = document.getElementById('modalAbsenTgl');
  if (el) el.value = today;
  if (el2) el2.value = today;
}

// ================================================================
//  REAL-TIME LISTENER FIRESTORE
// ================================================================
function listenSiswa() {
  const q = query(collection(db, 'siswa'), orderBy('tglDaftar', 'desc'));
  onSnapshot(q, (snapshot) => {
    siswaCacheList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  }, (err) => {
    console.error('Firestore error:', err);
    showToast('⚠️ Gagal koneksi ke database. Cek konsol.', 'error');
  });
}

function renderAll() {
  renderKeuanganTable(siswaCacheList);
  renderBiodataTable(siswaCacheList);
  renderLedger(siswaCacheList);
  renderStats(siswaCacheList);
  populateSiswaDropdowns();
  updateStatBelajar();
}

// ================================================================
//  RENDER STATS
// ================================================================
function renderStats(list) {
  const totalMurid = list.length;
  let kasMasuk = 0;
  let tunggakan = 0;
  list.forEach(s => {
    kasMasuk += Number(s.terbayar || 0);
    tunggakan += Math.max(0, Number(s.biaya || 0) - Number(s.terbayar || 0));
  });
  document.getElementById('statTotalMurid').textContent = totalMurid;
  document.getElementById('statKasMasuk').textContent = formatRp(kasMasuk);
  document.getElementById('statTunggakan').textContent = formatRp(tunggakan);
}

function updateStatBelajar() {
  document.getElementById('statSiswaBelajar').textContent = siswaCacheList.length;
}

// ================================================================
//  RENDER TABEL KEUANGAN
// ================================================================
function renderKeuanganTable(list) {
  const tbody = document.getElementById('tbodyKeuangan');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Kosong / Tidak ditemukan.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(s => {
    const sisa = Math.max(0, Number(s.biaya || 0) - Number(s.terbayar || 0));
    const status = sisa === 0 ? 'lunas' : (Number(s.terbayar) > 0 ? 'cicil' : 'tunggak');
    const badgeClass = { lunas: 'badge-lunas', cicil: 'badge-cicil', tunggak: 'badge-tunggak' }[status];
    const badgeLabel = { lunas: 'LUNAS', cicil: 'CICILAN', tunggak: 'TUNGGAKAN' }[status];
    return `
      <tr>
        <td>
          <strong>${escHtml(s.nama)}</strong>
          <div style="font-size:11px;color:#9ca3af">${escHtml(s.hp || '-')}</div>
        </td>
        <td>${formatRp(s.biaya)}</td>
        <td style="color:#166534;font-weight:700">${formatRp(s.terbayar)}</td>
        <td style="color:${sisa > 0 ? '#991b1b' : '#166534'};font-weight:700">${formatRp(sisa)}</td>
        <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
        <td>
          <button class="btn-sm yellow" onclick="openModalBayar('${s.id}')">
            <i class="fas fa-plus"></i> Bayar
          </button>
          <button class="btn-sm red" style="margin-left:4px" onclick="hapusSiswa('${s.id}','${escHtml(s.nama)}')">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>`;
  }).join('');
}

// ================================================================
//  RENDER TABEL BIODATA
// ================================================================
function renderBiodataTable(list) {
  const tbody = document.getElementById('tbodyBiodata');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Kosong / Tidak ditemukan.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(s => `
    <tr>
      <td><strong>${escHtml(s.nama)}</strong></td>
      <td>${escHtml(s.hp || '-')}</td>
      <td>${escHtml(s.alamat || '-')}</td>
      <td>${formatTgl(s.tglDaftar)}</td>
      <td>${escHtml(s.paket || '-')}</td>
      <td>
        <button class="btn-sm green" onclick="lihatProfilAdmin('${s.id}')">
          <i class="fas fa-eye"></i> Detail
        </button>
      </td>
    </tr>`).join('');
}

// ================================================================
//  RENDER LEDGER
// ================================================================
function renderLedger(list) {
  const el = document.getElementById('ledgerContent');
  if (!list || list.length === 0) {
    el.innerHTML = `<p class="empty-state">Belum ada transaksi tercatat.</p>`;
    return;
  }

  // Group by month
  const groups = {};
  list.forEach(s => {
    const tgl = s.tglDaftar ? new Date(s.tglDaftar) : new Date();
    const key = `${tgl.getFullYear()}-${String(tgl.getMonth()+1).padStart(2,'0')}`;
    if (!groups[key]) groups[key] = { label: formatBulan(tgl), items: [], total: 0 };
    groups[key].items.push(s);
    groups[key].total += Number(s.terbayar || 0);
  });

  el.innerHTML = Object.values(groups).map(g => `
    <div class="absen-container" style="margin-bottom:14px">
      <div class="absen-header">
        <h3><i class="fas fa-calendar"></i> ${g.label}</h3>
        <span style="font-weight:700;color:var(--yellow)">${formatRp(g.total)}</span>
      </div>
      <div>
        ${g.items.map(s => `
          <div class="absen-row">
            <div class="absen-row-info">
              <strong>${escHtml(s.nama)}</strong>
              <span>${escHtml(s.paket || '-')}</span>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700;color:#166534">${formatRp(s.terbayar)}</div>
              <div style="font-size:11px;color:#9ca3af">dari ${formatRp(s.biaya)}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

// ================================================================
//  DROPDOWN SISWA
// ================================================================
function populateSiswaDropdowns() {
  const ids = ['adminPilihSiswa', 'instrukturPilihSiswa', 'muridPilihDiri'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = el.value;
    el.innerHTML = `<option value="">-- Pilih Murid --</option>` +
      siswaCacheList.map(s => `<option value="${s.id}" ${s.id===val?'selected':''}>${escHtml(s.nama)}</option>`).join('');
  });
}

// ================================================================
//  DAFTAR SISWA BARU
// ================================================================
window.daftarSiswa = async function() {
  const nama = document.getElementById('dNama').value.trim();
  const hp = document.getElementById('dHP').value.trim();
  const alamat = document.getElementById('dAlamat').value.trim();
  const tglLahir = document.getElementById('dTglLahir').value;
  const paket = document.getElementById('dPaket').value;
  const biaya = Number(document.getElementById('dBiaya').value) || 0;
  const dp = Number(document.getElementById('dDP').value) || 0;
  const tglDaftar = document.getElementById('dTglDaftar').value;
  const catatan = document.getElementById('dCatatan').value.trim();
  const msgEl = document.getElementById('daftarMsg');

  if (!nama || !hp || !paket || !biaya) {
    showMsg(msgEl, 'error', '❌ Nama, No HP, Paket, dan Biaya wajib diisi!');
    return;
  }

  try {
    await addDoc(collection(db, 'siswa'), {
      nama, hp, alamat, tglLahir, paket,
      biaya, terbayar: dp,
      tglDaftar: tglDaftar || new Date().toISOString().split('T')[0],
      catatan,
      absen: []
    });
    showMsg(msgEl, 'success', `✅ Siswa "${nama}" berhasil didaftarkan!`);
    resetFormDaftar();
    showToast(`✅ ${nama} berhasil didaftarkan!`);
    // Kembali ke portal admin
    setTimeout(() => showMainTab('admin','adminHome'), 1200);
  } catch (e) {
    showMsg(msgEl, 'error', `❌ Gagal menyimpan: ${e.message}`);
  }
};

window.resetFormDaftar = function() {
  ['dNama','dHP','dAlamat','dBiaya','dDP','dCatatan'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('dPaket').value = '';
  document.getElementById('dTglLahir').value = '';
  document.getElementById('dTglDaftar').value = new Date().toISOString().split('T')[0];
  document.getElementById('daftarMsg').classList.add('hidden');
};

// ================================================================
//  BAYAR
// ================================================================
window.openModalBayar = function(id) {
  const s = siswaCacheList.find(x => x.id === id);
  if (!s) return;
  currentBayarId = id;
  const sisa = Math.max(0, Number(s.biaya) - Number(s.terbayar));
  document.getElementById('modalBayarNama').textContent = `Siswa: ${s.nama} | Sisa: ${formatRp(sisa)}`;
  document.getElementById('modalBayarJumlah').value = '';
  document.getElementById('modalBayarCatatan').value = '';
  openModal('modalBayar');
};

window.simpanBayar = async function() {
  const jumlah = Number(document.getElementById('modalBayarJumlah').value) || 0;
  if (!jumlah || jumlah <= 0) { showToast('❌ Jumlah bayar tidak valid!', 'error'); return; }
  const s = siswaCacheList.find(x => x.id === currentBayarId);
  if (!s) return;
  const newTerbayar = Number(s.terbayar || 0) + jumlah;
  try {
    await updateDoc(doc(db, 'siswa', currentBayarId), { terbayar: newTerbayar });
    showToast(`✅ Pembayaran ${formatRp(jumlah)} berhasil dicatat!`);
    closeModal('modalBayar');
  } catch (e) {
    showToast(`❌ Gagal: ${e.message}`, 'error');
  }
};

// ================================================================
//  HAPUS SISWA
// ================================================================
window.hapusSiswa = async function(id, nama) {
  if (!confirm(`Yakin hapus data "${nama}"? Tindakan ini tidak bisa dibatalkan.`)) return;
  try {
    await deleteDoc(doc(db, 'siswa', id));
    showToast(`🗑️ Data "${nama}" berhasil dihapus.`);
  } catch (e) {
    showToast(`❌ Gagal: ${e.message}`, 'error');
  }
};

// ================================================================
//  ABSEN & PENILAIAN
// ================================================================
window.loadAbsenSiswa = function(role, id) {
  currentAbsenRole = role;
  const panelId = role === 'admin' ? 'adminAbsenPanel' : 'instrukturAbsenPanel';
  const panel = document.getElementById(panelId);

  if (!id) {
    panel.innerHTML = `<p class="empty-state">Belum ada data murid terdaftar yang dipilih.</p>`;
    return;
  }

  const s = siswaCacheList.find(x => x.id === id);
  if (!s) { panel.innerHTML = `<p class="empty-state">Data tidak ditemukan.</p>`; return; }

  const absenList = s.absen || [];
  currentAbsenSiswaId = id;

  panel.innerHTML = `
    <div class="absen-container">
      <div class="absen-header">
        <h3><i class="fas fa-user"></i> ${escHtml(s.nama)} — ${escHtml(s.paket || '-')}</h3>
        <button class="btn-sm yellow" onclick="openModalAbsen('${id}')">
          <i class="fas fa-plus"></i> Tambah Absen
        </button>
      </div>
      <div>
        ${absenList.length === 0
          ? `<p style="text-align:center;color:#9ca3af;padding:24px">Belum ada catatan absensi.</p>`
          : `<table class="data-table">
              <thead><tr>
                <th>TGL</th><th>PERTEMUAN</th><th>KEHADIRAN</th><th>NILAI</th><th>CATATAN</th><th>AKSI</th>
              </tr></thead>
              <tbody>
                ${absenList.map((a, i) => `
                  <tr>
                    <td>${formatTgl(a.tgl)}</td>
                    <td style="text-align:center">${a.pertemuan || '-'}</td>
                    <td><span class="badge ${getHadirBadge(a.hadir)}">${escHtml(a.hadir)}</span></td>
                    <td style="text-align:center;font-weight:700">${a.nilai ?? '-'}</td>
                    <td>${escHtml(a.catatan || '-')}</td>
                    <td>
                      <button class="btn-sm red" onclick="hapusAbsen('${id}', ${i})">
                        <i class="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>`}
      </div>
    </div>`;
};

window.openModalAbsen = function(id) {
  currentAbsenSiswaId = id;
  const s = siswaCacheList.find(x => x.id === id);
  if (s) document.getElementById('modalAbsenNama').textContent = `Siswa: ${s.nama}`;
  document.getElementById('modalAbsenTgl').value = new Date().toISOString().split('T')[0];
  const nextPertemuan = (s?.absen?.length || 0) + 1;
  document.getElementById('modalAbsenPertemuan').value = nextPertemuan;
  document.getElementById('modalAbsenNilai').value = '';
  document.getElementById('modalAbsenCatatan').value = '';
  openModal('modalAbsen');
};

window.simpanAbsen = async function() {
  const tgl = document.getElementById('modalAbsenTgl').value;
  const pertemuan = Number(document.getElementById('modalAbsenPertemuan').value);
  const hadir = document.getElementById('modalAbsenHadir').value;
  const nilai = Number(document.getElementById('modalAbsenNilai').value);
  const catatan = document.getElementById('modalAbsenCatatan').value.trim();

  const s = siswaCacheList.find(x => x.id === currentAbsenSiswaId);
  if (!s) return;

  const newAbsen = [...(s.absen || []), { tgl, pertemuan, hadir, nilai, catatan }];
  try {
    await updateDoc(doc(db, 'siswa', currentAbsenSiswaId), { absen: newAbsen });
    showToast('✅ Absensi berhasil disimpan!');
    closeModal('modalAbsen');
    loadAbsenSiswa(currentAbsenRole || 'admin', currentAbsenSiswaId);
  } catch (e) {
    showToast(`❌ Gagal: ${e.message}`, 'error');
  }
};

window.hapusAbsen = async function(siswaId, index) {
  if (!confirm('Hapus catatan absen ini?')) return;
  const s = siswaCacheList.find(x => x.id === siswaId);
  if (!s) return;
  const newAbsen = (s.absen || []).filter((_, i) => i !== index);
  try {
    await updateDoc(doc(db, 'siswa', siswaId), { absen: newAbsen });
    showToast('🗑️ Catatan absen dihapus.');
    loadAbsenSiswa(currentAbsenRole || 'admin', siswaId);
  } catch (e) {
    showToast(`❌ Gagal: ${e.message}`, 'error');
  }
};

// ================================================================
//  PROFIL MURID
// ================================================================
window.loadProfilMurid = function(id) {
  const panel = document.getElementById('muridProfilPanel');
  if (!id) { panel.innerHTML = `<p class="empty-state">Silakan pilih nama Anda di atas.</p>`; return; }
  const s = siswaCacheList.find(x => x.id === id);
  if (!s) return;
  const sisa = Math.max(0, Number(s.biaya || 0) - Number(s.terbayar || 0));

  panel.innerHTML = `
    <div class="profil-card">
      <div class="profil-header">
        <h3>${escHtml(s.nama)}</h3>
        <p>${escHtml(s.paket || 'Paket belum ditentukan')}</p>
      </div>
      <div class="profil-body">
        <div class="profil-row"><span>No. HP</span><span>${escHtml(s.hp || '-')}</span></div>
        <div class="profil-row"><span>Alamat</span><span>${escHtml(s.alamat || '-')}</span></div>
        <div class="profil-row"><span>Tanggal Daftar</span><span>${formatTgl(s.tglDaftar)}</span></div>
        <div class="profil-row"><span>Biaya Kursus</span><span>${formatRp(s.biaya)}</span></div>
        <div class="profil-row"><span>Sudah Dibayar</span><span style="color:#166534;font-weight:800">${formatRp(s.terbayar)}</span></div>
        <div class="profil-row"><span>Sisa Tagihan</span><span style="color:${sisa>0?'#991b1b':'#166534'};font-weight:800">${formatRp(sisa)}</span></div>
        <div class="profil-row"><span>Total Pertemuan</span><span>${(s.absen||[]).length} kali</span></div>
        ${s.catatan ? `<div class="profil-row"><span>Catatan</span><span>${escHtml(s.catatan)}</span></div>` : ''}
      </div>
    </div>`;
};

window.lihatProfilAdmin = function(id) {
  showMainTab('admin','adminHome');
  setTimeout(() => {
    showSubTab('adminHome', 'biodata');
  }, 100);
};

// ================================================================
//  NAVIGASI
// ================================================================
window.setRole = function(role) {
  currentRole = role;
  ['admin','instruktur','murid'].forEach(r => {
    document.getElementById(r+'Tabs').classList.add('hidden');
    document.getElementById('btn'+capitalize(r)).classList.remove('active');
  });
  document.getElementById(role+'Tabs').classList.remove('hidden');
  document.getElementById('btn'+capitalize(role)).classList.add('active');

  // Show first section of role
  const firstMap = { admin: 'adminHome', instruktur: 'instrukturAbsen', murid: 'muridProfil' };
  showAllContentHidden();
  document.getElementById(firstMap[role]).classList.remove('hidden');

  // Activate first tab
  document.querySelectorAll('#'+role+'Tabs .tab-btn').forEach((b,i) => {
    b.classList.toggle('active', i === 0);
  });
};

window.showMainTab = function(role, sectionId) {
  showAllContentHidden();
  document.getElementById(sectionId).classList.remove('hidden');
  document.querySelectorAll('#'+role+'Tabs .tab-btn').forEach(b => b.classList.remove('active'));
  event && event.target && event.target.classList.add('active');
};

window.showSubTab = function(parentId, subKey) {
  const parent = document.getElementById(parentId);
  parent.querySelectorAll('.sub-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(parentId+'_'+subKey).classList.remove('hidden');
  parent.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
  event && event.target && event.target.classList.add('active');
};

function showAllContentHidden() {
  document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
}

// ================================================================
//  FILTER TABLE
// ================================================================
window.filterTable = function(type, val) {
  const lower = val.toLowerCase();
  const filtered = siswaCacheList.filter(s =>
    s.nama?.toLowerCase().includes(lower) ||
    s.hp?.toLowerCase().includes(lower) ||
    s.paket?.toLowerCase().includes(lower)
  );
  if (type === 'keuangan') renderKeuanganTable(filtered);
  if (type === 'biodata') renderBiodataTable(filtered);
};

// ================================================================
//  CETAK PDF
// ================================================================
window.cetakPDF = function(section) {
  showToast('🖨️ Membuka dialog cetak...');
  setTimeout(() => window.print(), 500);
};

// ================================================================
//  MODAL HELPERS
// ================================================================
window.openModal = function(id) { document.getElementById(id).classList.remove('hidden'); };
window.closeModal = function(id) { document.getElementById(id).classList.add('hidden'); };

// ================================================================
//  TOAST
// ================================================================
let toastTimer;
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type === 'error' ? ' toast-error' : '');
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

// ================================================================
//  HELPERS
// ================================================================
function formatRp(n) {
  return 'Rp ' + Number(n||0).toLocaleString('id-ID');
}

function formatTgl(str) {
  if (!str) return '-';
  try {
    return new Date(str).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  } catch { return str; }
}

function formatBulan(d) {
  return d.toLocaleDateString('id-ID', { month:'long', year:'numeric' });
}

function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function showMsg(el, type, msg) {
  el.textContent = msg;
  el.className = `form-msg ${type}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function getHadirBadge(hadir) {
  return { Hadir:'badge-lunas', Izin:'badge-cicil', Sakit:'badge-cicil', Alpha:'badge-tunggak' }[hadir] || 'badge-cicil';
}

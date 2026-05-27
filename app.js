// app.js v2 - Dirgantara Jaya - Full System with Login
import {
  db, collection, addDoc, getDocs, doc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy, where, setDoc, getDoc
} from './firebase-config.js';
import { PAKET_LIST, getKurikulum, getMateriForPertemuan } from './kurikulum.js';

// ================================================================
//  STATE
// ================================================================
let currentUser = null; // { role, id, nama, username }
let siswaCacheList = [];
let instrukturCacheList = [];
let currentBayarId = null;
let currentNilaiData = null;

// ================================================================
//  INIT
// ================================================================
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('dTglDaftar') && (document.getElementById('dTglDaftar').value = today());
  // Cek session
  const saved = sessionStorage.getItem('djUser');
  if (saved) {
    currentUser = JSON.parse(saved);
    enterApp();
  }
});

function today() { return new Date().toISOString().split('T')[0]; }
function todayLabel() {
  return new Date().toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
}

// ================================================================
//  LOGIN
// ================================================================
let selectedLoginRole = 'siswa';

window.selectLoginRole = function(role) {
  selectedLoginRole = role;
  ['siswa','instruktur','admin'].forEach(r => {
    document.getElementById('lr'+capitalize(r)).classList.toggle('active', r===role);
  });
  const uLabel = document.getElementById('loginUserLabel');
  const pLabel = document.getElementById('loginPassLabel');
  if (role === 'siswa') {
    uLabel.textContent = 'No. HP Terdaftar';
    pLabel.textContent = 'Password (Tanggal Lahir: ddmmyyyy)';
    document.getElementById('loginUsername').placeholder = '08xxxxxxxxxx';
    document.getElementById('loginPassword').placeholder = 'contoh: 15081995';
  } else {
    uLabel.textContent = 'Username';
    pLabel.textContent = 'Password';
    document.getElementById('loginUsername').placeholder = 'Username';
    document.getElementById('loginPassword').placeholder = 'Password';
  }
};

window.togglePass = function() {
  const inp = document.getElementById('loginPassword');
  const eye = document.getElementById('passEye');
  if (inp.type === 'password') { inp.type = 'text'; eye.className = 'fas fa-eye-slash'; }
  else { inp.type = 'password'; eye.className = 'fas fa-eye'; }
};

window.doLogin = async function() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');

  if (!username || !password) {
    errEl.textContent = 'Username dan password wajib diisi!';
    errEl.classList.remove('hidden'); return;
  }

  // Admin hardcoded
  if (selectedLoginRole === 'admin') {
    if (username === 'admin' && password === 'admin123') {
      currentUser = { role:'admin', id:'admin', nama:'Administrator', username:'admin' };
      sessionStorage.setItem('djUser', JSON.stringify(currentUser));
      enterApp(); return;
    }
    errEl.textContent = 'Username atau password admin salah!';
    errEl.classList.remove('hidden'); return;
  }

  // Instruktur dari Firestore
  if (selectedLoginRole === 'instruktur') {
    try {
      const snap = await getDocs(query(collection(db,'instruktur'), where('username','==',username)));
      if (snap.empty) { errEl.textContent='Akun instruktur tidak ditemukan!'; errEl.classList.remove('hidden'); return; }
      const data = snap.docs[0].data();
      if (data.password !== password) { errEl.textContent='Password salah!'; errEl.classList.remove('hidden'); return; }
      currentUser = { role:'instruktur', id:snap.docs[0].id, nama:data.nama, username };
      sessionStorage.setItem('djUser', JSON.stringify(currentUser));
      enterApp(); return;
    } catch(e) { errEl.textContent='Error: '+e.message; errEl.classList.remove('hidden'); return; }
  }

  // Siswa dari Firestore
  if (selectedLoginRole === 'siswa') {
    try {
      const snap = await getDocs(query(collection(db,'siswa'), where('hp','==',username)));
      if (snap.empty) { errEl.textContent='No HP tidak terdaftar!'; errEl.classList.remove('hidden'); return; }
      const data = snap.docs[0].data();
      // Password = tgl lahir format ddmmyyyy
      const tglLahir = data.tglLahir ? data.tglLahir.split('-').reverse().join('') : '';
      if (password !== tglLahir) { errEl.textContent='Password salah! Gunakan tanggal lahir (ddmmyyyy)'; errEl.classList.remove('hidden'); return; }
      currentUser = { role:'siswa', id:snap.docs[0].id, nama:data.nama, username };
      sessionStorage.setItem('djUser', JSON.stringify(currentUser));
      enterApp(); return;
    } catch(e) { errEl.textContent='Error: '+e.message; errEl.classList.remove('hidden'); return; }
  }
};

// Enter on password field
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('pageLogin').classList.contains('hidden')) doLogin();
});

// ================================================================
//  ENTER APP
// ================================================================
function enterApp() {
  document.getElementById('pageLogin').classList.add('hidden');
  document.getElementById('pageApp').classList.remove('hidden');

  // Top bar
  const roleLabel = { admin:'Administrator', instruktur:'Instruktur', siswa:'Siswa' }[currentUser.role];
  document.getElementById('topBarRole').textContent = roleLabel;
  document.getElementById('topBarName').textContent = currentUser.nama;

  buildTabs();
  listenSiswa();
  if (currentUser.role === 'admin') listenInstruktur();
  if (currentUser.role === 'instruktur') loadInstrukturHariIni();
  if (currentUser.role === 'siswa') loadSiswaDashboard();
}

window.doLogout = function() {
  sessionStorage.removeItem('djUser');
  currentUser = null;
  location.reload();
};

// ================================================================
//  BUILD TABS
// ================================================================
function buildTabs() {
  const tabs = document.getElementById('mainTabs');
  tabs.innerHTML = '';
  if (currentUser.role === 'admin') {
    tabs.innerHTML = `
      <button class="tab-btn active" onclick="switchTab('adminHome',this)"><i class="fas fa-chart-bar"></i> Portal Admin</button>
      <button class="tab-btn" onclick="switchTab('adminDaftar',this)"><i class="fas fa-user-plus"></i> Daftarkan Siswa</button>`;
    showSection('adminHome');
  } else if (currentUser.role === 'instruktur') {
    tabs.innerHTML = `<button class="tab-btn active" onclick="switchTab('instrukturAbsen',this)"><i class="fas fa-check-square"></i> Absen & Nilai</button>`;
    showSection('instrukturAbsen');
    document.getElementById('instrukturTanggal').textContent = todayLabel();
  } else if (currentUser.role === 'siswa') {
    tabs.innerHTML = `<button class="tab-btn active" onclick="switchTab('siswaDashboard',this)"><i class="fas fa-graduation-cap"></i> Dashboard Saya</button>`;
    showSection('siswaDashboard');
  }
}

// ================================================================
//  FIRESTORE LISTENERS
// ================================================================
function listenSiswa() {
  onSnapshot(query(collection(db,'siswa'), orderBy('tglDaftar','desc')), snap => {
    siswaCacheList = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if (currentUser?.role === 'admin') {
      renderKeuanganTable(siswaCacheList);
      renderBiodataTable(siswaCacheList);
      renderLedger(siswaCacheList);
      renderReminder(siswaCacheList);
      renderStats(siswaCacheList);
      populateDropdowns();
    }
    if (currentUser?.role === 'instruktur') {
      populateDropdowns();
    }
    if (currentUser?.role === 'siswa') {
      const me = siswaCacheList.find(s => s.id === currentUser.id);
      if (me) renderSiswaProgress(me);
    }
  });
}

function listenInstruktur() {
  onSnapshot(collection(db,'instruktur'), snap => {
    instrukturCacheList = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderInstrukturTable(instrukturCacheList);
  });
}

// ================================================================
//  ADMIN: STATS
// ================================================================
function renderStats(list) {
  let kas = 0, tung = 0;
  list.forEach(s => {
    kas += Number(s.terbayar||0);
    tung += Math.max(0, Number(s.biaya||0) - Number(s.terbayar||0));
  });
  document.getElementById('statTotalMurid').textContent = list.length;
  document.getElementById('statKasMasuk').textContent = formatRp(kas);
  document.getElementById('statTunggakan').textContent = formatRp(tung);
}

// ================================================================
//  ADMIN: TABEL KEUANGAN
// ================================================================
function renderKeuanganTable(list) {
  const tbody = document.getElementById('tbodyKeuangan');
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Belum ada siswa terdaftar.</td></tr>`; return; }
  tbody.innerHTML = list.map(s => {
    const sisa = Math.max(0, Number(s.biaya||0) - Number(s.terbayar||0));
    const st = sisa===0?'lunas': Number(s.terbayar)>0?'cicil':'tunggak';
    const bc = {lunas:'badge-lunas',cicil:'badge-cicil',tunggak:'badge-tunggak'}[st];
    const bl = {lunas:'LUNAS',cicil:'CICILAN',tunggak:'TUNGGAKAN'}[st];
    const prog = s.absen?.length||0;
    const total = PAKET_LIST[s.paketKey]?.pertemuan || 10;
    return `<tr>
      <td><strong>${esc(s.nama)}</strong><div style="font-size:11px;color:#9ca3af">${esc(s.hp||'')}</div></td>
      <td style="font-size:12px">${esc(s.paketLabel||s.paket||'-')}</td>
      <td>${formatRp(s.biaya)}</td>
      <td style="color:#166534;font-weight:700">${formatRp(s.terbayar)}</td>
      <td style="color:${sisa>0?'#991b1b':'#166534'};font-weight:700">${formatRp(sisa)}</td>
      <td><span class="badge ${bc}">${bl}</span></td>
      <td style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn-sm yellow" onclick="openModalBayar('${s.id}')"><i class="fas fa-plus"></i> Bayar</button>
        <button class="btn-sm red" onclick="hapusSiswa('${s.id}','${esc(s.nama)}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
}

// ================================================================
//  ADMIN: TABEL BIODATA
// ================================================================
function renderBiodataTable(list) {
  const tbody = document.getElementById('tbodyBiodata');
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Belum ada siswa.</td></tr>`; return; }
  tbody.innerHTML = list.map(s => {
    const prog = s.absen?.length||0;
    const total = PAKET_LIST[s.paketKey]?.pertemuan || 10;
    const pct = Math.round((prog/total)*100);
    return `<tr>
      <td><strong>${esc(s.nama)}</strong></td>
      <td>${esc(s.hp||'-')}</td>
      <td>${formatTgl(s.tglLahir)}</td>
      <td style="font-size:12px">${esc(s.paketLabel||'-')}</td>
      <td>${formatTgl(s.tglDaftar)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;background:#e5e7eb;border-radius:10px;height:6px;min-width:60px">
            <div style="background:#2d6a4f;width:${pct}%;height:100%;border-radius:10px"></div>
          </div>
          <span style="font-size:11px;font-weight:700;color:#1a3d2b">${prog}/${total}</span>
        </div>
      </td>
      <td><button class="btn-sm green" onclick="lihatDetailSiswa('${s.id}')"><i class="fas fa-eye"></i> Detail</button></td>
    </tr>`;
  }).join('');
}

// ================================================================
//  ADMIN: LEDGER
// ================================================================
function renderLedger(list) {
  const el = document.getElementById('ledgerContent');
  if (!list.length) { el.innerHTML = `<p class="empty-state">Belum ada data.</p>`; return; }
  const groups = {};
  list.forEach(s => {
    const tgl = s.tglDaftar || new Date().toISOString().split('T')[0];
    const key = tgl.substring(0,7);
    if (!groups[key]) groups[key] = { label: formatBulan(new Date(tgl+'-01')), items:[], total:0 };
    groups[key].items.push(s);
    groups[key].total += Number(s.terbayar||0);
  });
  el.innerHTML = Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).map(([,g]) => `
    <div style="background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow-sm);margin-bottom:14px;overflow:hidden">
      <div style="background:var(--green-dark);padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="color:white;font-weight:700">${g.label}</span>
        <span style="color:var(--yellow);font-weight:700">${formatRp(g.total)}</span>
      </div>
      ${g.items.map(s=>`
        <div style="padding:10px 16px;border-bottom:1px solid var(--gray-100);display:flex;justify-content:space-between;align-items:center">
          <div><strong>${esc(s.nama)}</strong><div style="font-size:11px;color:#9ca3af">${esc(s.paketLabel||'-')}</div></div>
          <div style="text-align:right">
            <div style="font-weight:700;color:#166534">${formatRp(s.terbayar)}</div>
            <div style="font-size:11px;color:#9ca3af">dari ${formatRp(s.biaya)}</div>
          </div>
        </div>`).join('')}
    </div>`).join('');
}

// ================================================================
//  ADMIN: REMINDER TUNGGAKAN
// ================================================================
function renderReminder(list) {
  const el = document.getElementById('reminderContent');
  const tunggak = list.filter(s => Math.max(0, Number(s.biaya||0)-Number(s.terbayar||0)) > 0);
  if (!tunggak.length) { el.innerHTML = `<div class="empty-state" style="color:#166534"><i class="fas fa-check-circle" style="font-size:32px;margin-bottom:8px;display:block"></i>Semua siswa sudah lunas!</div>`; return; }
  el.innerHTML = `
    <div style="margin-bottom:12px;padding:10px 14px;background:var(--red-light);border-radius:var(--radius-sm);font-size:13px;color:var(--red);font-weight:600">
      <i class="fas fa-exclamation-triangle"></i> ${tunggak.length} siswa memiliki tunggakan pembayaran
    </div>` +
    tunggak.map(s => {
      const sisa = Math.max(0, Number(s.biaya||0)-Number(s.terbayar||0));
      const wa = `https://wa.me/${(s.hp||'').replace(/^0/,'62')}?text=${encodeURIComponent(`Halo ${s.nama}, kami mengingatkan tunggakan kursus mengemudi Dirgantara Jaya sebesar ${formatRp(sisa)}. Mohon segera dilunasi. Terima kasih.`)}`;
      return `<div class="reminder-card">
        <div class="reminder-info">
          <strong>${esc(s.nama)}</strong>
          <span>${esc(s.hp||'-')} | ${esc(s.paketLabel||'-')}</span>
          <span style="font-size:11px;color:#9ca3af">Daftar: ${formatTgl(s.tglDaftar)}</span>
        </div>
        <div style="text-align:right">
          <div class="reminder-amount">${formatRp(sisa)}</div>
          <div style="font-size:11px;color:#9ca3af;margin-bottom:6px">Sudah bayar: ${formatRp(s.terbayar)}</div>
          <a href="${wa}" target="_blank" class="btn-sm green" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px">
            <i class="fab fa-whatsapp"></i> WA Reminder
          </a>
        </div>
      </div>`;
    }).join('');
}

// ================================================================
//  ADMIN: INSTRUKTUR MANAGEMENT
// ================================================================
function renderInstrukturTable(list) {
  const tbody = document.getElementById('tbodyInstruktur');
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Belum ada instruktur.</td></tr>`; return; }
  tbody.innerHTML = list.map(i => `<tr>
    <td><strong>${esc(i.nama)}</strong></td>
    <td>${esc(i.username)}</td>
    <td><span class="badge badge-lunas">Aktif</span></td>
    <td><button class="btn-sm red" onclick="hapusInstruktur('${i.id}','${esc(i.nama)}')"><i class="fas fa-trash"></i></button></td>
  </tr>`).join('');
}

window.tambahInstruktur = async function() {
  const nama = document.getElementById('iNama').value.trim();
  const username = document.getElementById('iUsername').value.trim();
  const password = document.getElementById('iPassword').value.trim();
  const msg = document.getElementById('instrukturMsg');
  if (!nama||!username||!password) { showMsg(msg,'error','Semua field wajib diisi!'); return; }
  try {
    await addDoc(collection(db,'instruktur'), { nama, username, password });
    showMsg(msg,'success',`✅ Instruktur "${nama}" berhasil ditambahkan!`);
    document.getElementById('iNama').value=''; document.getElementById('iUsername').value=''; document.getElementById('iPassword').value='';
    showToast(`✅ Instruktur ${nama} ditambahkan!`);
  } catch(e) { showMsg(msg,'error','Gagal: '+e.message); }
};

window.hapusInstruktur = async function(id, nama) {
  if (!confirm(`Hapus instruktur "${nama}"?`)) return;
  await deleteDoc(doc(db,'instruktur',id));
  showToast(`🗑️ Instruktur ${nama} dihapus.`);
};

// ================================================================
//  ADMIN: DAFTAR SISWA BARU
// ================================================================
window.updatePaketOptions = function() {
  const transmisi = document.getElementById('dTransmisi').value;
  const paketSel = document.getElementById('dPaket');
  paketSel.innerHTML = `<option value="">-- Pilih Paket --</option>`;
  if (!transmisi) return;

  const groups = {
    'Reguler': ['7x','8x','9x','10x'],
    'Khusus': ['Trampil','Melancarkan','Rental']
  };
  Object.entries(groups).forEach(([grp, keys]) => {
    const og = document.createElement('optgroup');
    og.label = `--- ${grp} ---`;
    keys.forEach(k => {
      const key = `${transmisi}-${k}`;
      if (PAKET_LIST[key]) {
        const o = document.createElement('option');
        o.value = key;
        o.textContent = `${PAKET_LIST[key].label} — ${formatRp(PAKET_LIST[key].harga)}`;
        og.appendChild(o);
      }
    });
    paketSel.appendChild(og);
  });
  updateHargaOtomatis();
};

window.updateHargaOtomatis = function() {
  const key = document.getElementById('dPaket').value;
  const biayaEl = document.getElementById('dBiaya');
  if (key && PAKET_LIST[key]) {
    biayaEl.value = PAKET_LIST[key].harga;
    updateDaftarPreview();
  } else {
    biayaEl.value = '';
  }
};

function updateDaftarPreview() {
  const nama = document.getElementById('dNama').value.trim();
  const hp = document.getElementById('dHP').value.trim();
  const tglLahir = document.getElementById('dTglLahir').value;
  const key = document.getElementById('dPaket').value;
  const dp = Number(document.getElementById('dDP').value)||0;
  const preview = document.getElementById('daftarPreview');
  const content = document.getElementById('daftarPreviewContent');
  if (!nama||!hp||!key) { preview.classList.add('hidden'); return; }
  const paket = PAKET_LIST[key];
  const pass = tglLahir ? tglLahir.split('-').reverse().join('') : '(belum diisi)';
  content.innerHTML = `
    <div class="preview-row"><span>Nama</span><span>${esc(nama)}</span></div>
    <div class="preview-row"><span>No HP (username)</span><span>${esc(hp)}</span></div>
    <div class="preview-row"><span>Paket</span><span>${paket.label}</span></div>
    <div class="preview-row"><span>Total Biaya</span><span>${formatRp(paket.harga)}</span></div>
    <div class="preview-row"><span>DP</span><span>${formatRp(dp)}</span></div>
    <div class="preview-row"><span>Sisa</span><span>${formatRp(paket.harga-dp)}</span></div>
    <div class="preview-row"><span>Total Pertemuan</span><span>${paket.pertemuan}x (${paket.jamPerSesi} jam/sesi)</span></div>
  `;
  preview.classList.remove('hidden');
}

// Live preview
['dNama','dHP','dTglLahir','dDP'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', updateDaftarPreview);
});

window.daftarSiswa = async function() {
  const nama = document.getElementById('dNama').value.trim();
  const hp = document.getElementById('dHP').value.trim();
  const tglLahir = document.getElementById('dTglLahir').value;
  const alamat = document.getElementById('dAlamat').value.trim();
  const paketKey = document.getElementById('dPaket').value;
  const biaya = Number(document.getElementById('dBiaya').value)||0;
  const dp = Number(document.getElementById('dDP').value)||0;
  const tglDaftar = document.getElementById('dTglDaftar').value || today();
  const catatan = document.getElementById('dCatatan').value.trim();
  const msg = document.getElementById('daftarMsg');

  if (!nama||!hp||!tglLahir||!paketKey) { showMsg(msg,'error','❌ Nama, No HP, Tanggal Lahir, dan Paket wajib diisi!'); return; }

  const paket = PAKET_LIST[paketKey];
  try {
    await addDoc(collection(db,'siswa'), {
      nama, hp, tglLahir, alamat, paketKey,
      paketLabel: paket.label,
      transmisi: paket.transmisi,
      totalPertemuan: paket.pertemuan,
      jamPerSesi: paket.jamPerSesi,
      biaya: paket.harga, terbayar: dp,
      tglDaftar, catatan, absen: []
    });
    showMsg(msg,'success',`✅ Siswa "${nama}" berhasil didaftarkan! Login: ${hp} / ${tglLahir.split('-').reverse().join('')}`);
    resetFormDaftar();
    showToast(`✅ ${nama} berhasil didaftarkan!`);
  } catch(e) { showMsg(msg,'error','❌ Gagal: '+e.message); }
};

window.resetFormDaftar = function() {
  ['dNama','dHP','dAlamat','dDP','dCatatan'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('dTglLahir').value='';
  document.getElementById('dTransmisi').value='';
  document.getElementById('dPaket').innerHTML='<option value="">-- Pilih transmisi dulu --</option>';
  document.getElementById('dBiaya').value='';
  document.getElementById('dTglDaftar').value=today();
  document.getElementById('daftarPreview').classList.add('hidden');
};

// ================================================================
//  ADMIN: BAYAR
// ================================================================
window.openModalBayar = function(id) {
  const s = siswaCacheList.find(x=>x.id===id);
  if (!s) return;
  currentBayarId = id;
  const sisa = Math.max(0, Number(s.biaya)-Number(s.terbayar));
  document.getElementById('modalBayarInfo').textContent = `${s.nama} — Sisa: ${formatRp(sisa)}`;
  document.getElementById('modalBayarJumlah').value='';
  document.getElementById('modalBayarKet').value='';
  openModal('modalBayar');
};

window.simpanBayar = async function() {
  const jumlah = Number(document.getElementById('modalBayarJumlah').value)||0;
  if (jumlah<=0) { showToast('❌ Jumlah tidak valid!','error'); return; }
  const s = siswaCacheList.find(x=>x.id===currentBayarId);
  if (!s) return;
  await updateDoc(doc(db,'siswa',currentBayarId), { terbayar: Number(s.terbayar||0)+jumlah });
  showToast(`✅ Bayar ${formatRp(jumlah)} berhasil!`);
  closeModal('modalBayar');
};

window.hapusSiswa = async function(id, nama) {
  if (!confirm(`Hapus data "${nama}"?`)) return;
  await deleteDoc(doc(db,'siswa',id));
  showToast(`🗑️ "${nama}" dihapus.`);
};

window.lihatDetailSiswa = function(id) {
  const s = siswaCacheList.find(x=>x.id===id);
  if (!s) return;
  alert(`Detail: ${s.nama}\nHP: ${s.hp}\nPaket: ${s.paketLabel}\nProgress: ${s.absen?.length||0}/${s.totalPertemuan||10} pertemuan`);
};

// ================================================================
//  INSTRUKTUR: HARI INI
// ================================================================
function loadInstrukturHariIni() {
  const panel = document.getElementById('instrukturHariIniPanel');
  const todayStr = today();
  listenSiswa();
  // Re-render setiap kali data berubah sudah ditangani di listenSiswa
  // Tapi kita perlu trigger render instruktur juga
  onSnapshot(query(collection(db,'siswa'), orderBy('tglDaftar','desc')), snap => {
    siswaCacheList = snap.docs.map(d => ({id:d.id,...d.data()}));
    populateDropdowns();
    renderInstrukturHariIni();
  });
}

function renderInstrukturHariIni() {
  const panel = document.getElementById('instrukturHariIniPanel');
  const todayStr = today();
  const sudahAbsen = siswaCacheList.filter(s => {
    return (s.absen||[]).some(a => a.tgl === todayStr && a.status === 'hadir_siswa');
  });
  if (!sudahAbsen.length) {
    panel.innerHTML = `<div class="empty-state"><i class="fas fa-clock" style="font-size:28px;margin-bottom:8px;display:block;color:#9ca3af"></i>Belum ada siswa yang absen hari ini.<br><small>Siswa perlu klik tombol "Absen Hadir" dari portal mereka terlebih dahulu.</small></div>`;
    return;
  }
  panel.innerHTML = sudahAbsen.map(s => {
    const absenHariIni = (s.absen||[]).find(a => a.tgl===todayStr && a.status==='hadir_siswa');
    const nomorPertemuan = absenHariIni?.pertemuan || (s.absen?.length||0);
    const sudahDinilai = absenHariIni?.nilai !== undefined && absenHariIni?.nilai !== null;
    return `<div class="siswa-absen-card">
      <div class="siswa-absen-info">
        <strong>${esc(s.nama)}</strong>
        <span>${esc(s.paketLabel||'-')} | Pertemuan ke-${nomorPertemuan}</span>
        <span style="font-size:11px;color:#9ca3af">${esc(s.hp||'-')}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${sudahDinilai
          ? `<span class="badge badge-lunas"><i class="fas fa-check"></i> Sudah dinilai: ${absenHariIni.nilai}</span>`
          : `<button class="btn-sm blue" onclick="openModalNilai('${s.id}','${nomorPertemuan}')"><i class="fas fa-star"></i> Beri Nilai</button>`}
      </div>
    </div>`;
  }).join('');
}

window.loadRiwayatSiswa = function(id) {
  const panel = document.getElementById('instrukturRiwayatPanel');
  if (!id) { panel.innerHTML=`<p class="empty-state">Pilih siswa.</p>`; return; }
  const s = siswaCacheList.find(x=>x.id===id);
  if (!s) return;
  const absen = s.absen||[];
  if (!absen.length) { panel.innerHTML=`<p class="empty-state">Belum ada catatan absensi.</p>`; return; }
  panel.innerHTML = `<div class="table-container">
    <table class="data-table">
      <thead><tr><th>TGL</th><th>PERTEMUAN</th><th>MATERI</th><th>STATUS</th><th>NILAI</th><th>CATATAN</th></tr></thead>
      <tbody>
        ${absen.map((a,i) => {
          const materi = getMateriForPertemuan(s.transmisi||'Manual', a.pertemuan||i+1, s.totalPertemuan||10);
          return `<tr>
            <td>${formatTgl(a.tgl)}</td>
            <td style="text-align:center;font-weight:700">${a.pertemuan||i+1}</td>
            <td style="font-size:12px">${esc(materi?.judul||'-')}</td>
            <td><span class="badge ${a.status==='hadir_siswa'?'badge-hadir':'badge-alpha'}">${a.status==='hadir_siswa'?'Hadir':'Pending'}</span></td>
            <td style="text-align:center;font-weight:700">${a.nilai??'-'}</td>
            <td style="font-size:12px">${esc(a.catatanInstruktur||'-')}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
};

// ================================================================
//  INSTRUKTUR: NILAI
// ================================================================
window.openModalNilai = function(siswaId, nomorPertemuan) {
  const s = siswaCacheList.find(x=>x.id===siswaId);
  if (!s) return;
  const materi = getMateriForPertemuan(s.transmisi||'Manual', Number(nomorPertemuan), s.totalPertemuan||10);
  currentNilaiData = { siswaId, nomorPertemuan: Number(nomorPertemuan) };
  document.getElementById('modalNilaiInfo').textContent = `${s.nama} — Pertemuan ke-${nomorPertemuan}: ${materi?.judul||''}`;
  document.getElementById('modalNilaiAngka').value='';
  document.getElementById('modalNilaiCatatan').value='';
  openModal('modalNilai');
};

window.simpanNilai = async function() {
  const nilai = Number(document.getElementById('modalNilaiAngka').value);
  const catatan = document.getElementById('modalNilaiCatatan').value.trim();
  if (!nilai && nilai!==0) { showToast('❌ Masukkan nilai!','error'); return; }
  const { siswaId, nomorPertemuan } = currentNilaiData;
  const s = siswaCacheList.find(x=>x.id===siswaId);
  if (!s) return;
  const todayStr = today();
  const newAbsen = (s.absen||[]).map(a => {
    if (a.tgl===todayStr && a.pertemuan===nomorPertemuan) {
      return { ...a, nilai, catatanInstruktur: catatan };
    }
    return a;
  });
  await updateDoc(doc(db,'siswa',siswaId), { absen: newAbsen });
  showToast(`✅ Nilai ${nilai} berhasil disimpan!`);
  closeModal('modalNilai');
  renderInstrukturHariIni();
};

// ================================================================
//  SISWA: DASHBOARD
// ================================================================
function loadSiswaDashboard() {
  onSnapshot(doc(db,'siswa',currentUser.id), snap => {
    if (!snap.exists()) { showToast('Data tidak ditemukan','error'); return; }
    const s = { id:snap.id, ...snap.data() };
    renderSiswaProgress(s);
    renderSiswaAbsen(s);
    renderSiswaProfil(s);
  });
}

function renderSiswaProgress(s) {
  const panel = document.getElementById('siswaProgressPanel');
  const absen = s.absen||[];
  const total = s.totalPertemuan||10;
  const selesai = absen.filter(a=>a.nilai!==undefined&&a.nilai!==null).length;
  const pct = Math.round((selesai/total)*100);
  const kurikulum = getKurikulum(s.transmisi||'Manual');

  panel.innerHTML = `
    <div style="background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow-sm);overflow:hidden;margin-bottom:16px">
      <div class="progress-header">
        <h2>${esc(s.nama)}</h2>
        <p>${esc(s.paketLabel||'-')} | ${esc(s.transmisi||'')} | ${total} Pertemuan</p>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
        <p class="progress-pct">${selesai} dari ${total} pertemuan selesai (${pct}%)</p>
      </div>
      <div class="pertemuan-grid">
        ${Array.from({length:total}, (_,i) => {
          const no = i+1;
          const materi = getMateriForPertemuan(s.transmisi||'Manual', no, total);
          const absenItem = absen.find(a=>a.pertemuan===no);
          const sudahAbsen = !!absenItem;
          const sudahNilai = absenItem?.nilai !== undefined && absenItem?.nilai !== null;
          const cls = sudahNilai ? 'selesai' : (sudahAbsen ? 'aktif' : 'belum');
          return `<div class="pertemuan-card ${cls}">
            <div class="pertemuan-num">Pertemuan ${no} ${sudahNilai?'✅':sudahAbsen?'🕐':'⏳'}</div>
            <div class="pertemuan-judul">${esc(materi?.judul||'-')}</div>
            <div class="pertemuan-materi">${esc(materi?.materi||'-')}</div>
            ${sudahNilai ? `<div class="pertemuan-nilai">
              <span class="nilai-badge">Nilai: ${absenItem.nilai}</span>
              ${absenItem.catatanInstruktur ? `<span class="nilai-catatan">${esc(absenItem.catatanInstruktur)}</span>` : ''}
            </div>` : ''}
            ${sudahAbsen && !sudahNilai ? `<div style="margin-top:6px;font-size:11px;color:#854d0e;font-weight:600"><i class="fas fa-hourglass-half"></i> Menunggu penilaian instruktur</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function renderSiswaAbsen(s) {
  const panel = document.getElementById('siswaAbsenPanel');
  const todayStr = today();
  const absen = s.absen||[];
  const total = s.totalPertemuan||10;
  const sudahAbsenHariIni = absen.some(a=>a.tgl===todayStr);
  const nomorPertemuan = absen.length + 1;

  if (nomorPertemuan > total) {
    panel.innerHTML = `<div class="empty-state" style="color:#166534"><i class="fas fa-graduation-cap" style="font-size:36px;margin-bottom:8px;display:block"></i><strong>Selamat! Kamu telah menyelesaikan semua pertemuan!</strong><p style="margin-top:8px;color:#9ca3af">Hubungi admin untuk sertifikat kelulusan.</p></div>`;
    return;
  }

  const materi = getMateriForPertemuan(s.transmisi||'Manual', nomorPertemuan, total);

  panel.innerHTML = `
    <div class="absen-hari-ini">
      <div class="absen-info">
        <h3><i class="fas fa-calendar-day"></i> ${todayLabel()}</h3>
        <p>Pertemuan ke-<strong>${nomorPertemuan}</strong> dari ${total}</p>
      </div>
      <div class="absen-materi-box">
        <h4><i class="fas fa-book-open"></i> Materi Hari Ini:</h4>
        <p><strong>${esc(materi?.judul||'-')}</strong></p>
        <p style="margin-top:6px">${esc(materi?.materi||'-')}</p>
        <p style="margin-top:6px;font-size:11px;color:#2d6a4f"><i class="fas fa-clock"></i> Durasi: ${s.jamPerSesi||1} jam</p>
      </div>
      <div class="absen-btn-wrap">
        ${sudahAbsenHariIni
          ? `<button class="btn-absen sudah" disabled><i class="fas fa-check-circle"></i> Sudah Absen Hari Ini — Menunggu Instruktur</button>`
          : `<button class="btn-absen" onclick="kirimAbsen('${s.id}',${nomorPertemuan})"><i class="fas fa-hand-paper"></i> Absen Hadir Sekarang</button>`}
      </div>
    </div>
    ${absen.length > 0 ? `
    <div style="margin-top:16px">
      <h3 style="font-size:14px;font-weight:700;color:var(--green-dark);margin-bottom:10px"><i class="fas fa-history"></i> Riwayat Absensi</h3>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>TGL</th><th>PERTEMUAN</th><th>MATERI</th><th>NILAI</th></tr></thead>
          <tbody>
            ${absen.slice().reverse().map(a => {
              const m = getMateriForPertemuan(s.transmisi||'Manual', a.pertemuan||1, total);
              return `<tr>
                <td>${formatTgl(a.tgl)}</td>
                <td style="text-align:center">${a.pertemuan||'-'}</td>
                <td style="font-size:12px">${esc(m?.judul||'-')}</td>
                <td style="text-align:center;font-weight:700">${a.nilai??'⏳'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}`;
}

window.kirimAbsen = async function(siswaId, nomorPertemuan) {
  const s = siswaCacheList.find(x=>x.id===siswaId) || { absen:[] };
  const todayStr = today();
  if ((s.absen||[]).some(a=>a.tgl===todayStr)) { showToast('Sudah absen hari ini!','error'); return; }
  const newAbsen = [...(s.absen||[]), {
    tgl: todayStr, pertemuan: nomorPertemuan,
    status: 'hadir_siswa', nilai: null, catatanInstruktur: null
  }];
  await updateDoc(doc(db,'siswa',siswaId), { absen: newAbsen });
  showToast('✅ Absen berhasil! Instruktur akan segera memberi nilai.');
};

function renderSiswaProfil(s) {
  const panel = document.getElementById('siswaProfilPanel');
  const sisa = Math.max(0, Number(s.biaya||0)-Number(s.terbayar||0));
  const prog = s.absen?.length||0;
  panel.innerHTML = `
    <div class="profil-card">
      <div class="profil-card-header">
        <h3>${esc(s.nama)}</h3>
        <p>${esc(s.paketLabel||'-')}</p>
      </div>
      <div class="profil-body">
        <div class="profil-row"><span>No. HP</span><span>${esc(s.hp||'-')}</span></div>
        <div class="profil-row"><span>Alamat</span><span>${esc(s.alamat||'-')}</span></div>
        <div class="profil-row"><span>Tanggal Daftar</span><span>${formatTgl(s.tglDaftar)}</span></div>
        <div class="profil-row"><span>Transmisi</span><span>${esc(s.transmisi||'-')}</span></div>
        <div class="profil-row"><span>Total Pertemuan</span><span>${s.totalPertemuan||10}x</span></div>
        <div class="profil-row"><span>Progress</span><span style="color:var(--green-dark);font-weight:800">${prog}/${s.totalPertemuan||10} pertemuan</span></div>
        <div class="profil-row"><span>Biaya Kursus</span><span>${formatRp(s.biaya)}</span></div>
        <div class="profil-row"><span>Sudah Dibayar</span><span style="color:#166534;font-weight:800">${formatRp(s.terbayar)}</span></div>
        <div class="profil-row"><span>Sisa Tagihan</span><span style="color:${sisa>0?'#991b1b':'#166534'};font-weight:800">${formatRp(sisa)}</span></div>
        ${sisa>0?`<div style="margin-top:12px;padding:10px 14px;background:var(--red-light);border-radius:6px;font-size:12px;color:var(--red);font-weight:600"><i class="fas fa-info-circle"></i> Segera lunasi sisa pembayaran ke admin Dirgantara Jaya.</div>`:''}
      </div>
    </div>`;
}

// ================================================================
//  DROPDOWN
// ================================================================
function populateDropdowns() {
  const ids = ['instrukturPilihSiswa'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = el.value;
    el.innerHTML = `<option value="">-- Pilih Siswa --</option>` +
      siswaCacheList.map(s=>`<option value="${s.id}" ${s.id===val?'selected':''}>${esc(s.nama)} — ${esc(s.paketLabel||'-')}</option>`).join('');
  });
}

// ================================================================
//  FILTER
// ================================================================
window.filterTable = function(type, val) {
  const lower = val.toLowerCase();
  const filtered = siswaCacheList.filter(s =>
    s.nama?.toLowerCase().includes(lower) || s.hp?.toLowerCase().includes(lower)
  );
  if (type==='keuangan') renderKeuanganTable(filtered);
  if (type==='biodata') renderBiodataTable(filtered);
};

// ================================================================
//  NAVIGATION
// ================================================================
window.switchTab = function(sectionId, btn) {
  document.querySelectorAll('.content-section').forEach(s=>s.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(sectionId)?.classList.remove('hidden');
  btn?.classList.add('active');
};

window.showSubTab = function(parentId, subKey, btn) {
  const parent = document.getElementById(parentId);
  parent?.querySelectorAll('.sub-panel').forEach(p=>p.classList.add('hidden'));
  document.getElementById(`${parentId}_${subKey}`)?.classList.remove('hidden');
  parent?.querySelectorAll('.sub-tab').forEach(b=>b.classList.remove('active'));
  btn?.classList.add('active');
};

function showSection(id) {
  document.querySelectorAll('.content-section').forEach(s=>s.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
}

// ================================================================
//  MODAL
// ================================================================
window.openModal = id => document.getElementById(id).classList.remove('hidden');
window.closeModal = id => document.getElementById(id).classList.add('hidden');

// ================================================================
//  TOAST
// ================================================================
let toastTimer;
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast'+(type==='error'?' error':'');
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.add('hidden'), 3200);
}

// ================================================================
//  HELPERS
// ================================================================
function formatRp(n) { return 'Rp '+Number(n||0).toLocaleString('id-ID'); }
function formatTgl(str) {
  if (!str) return '-';
  try { return new Date(str).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }
  catch { return str; }
}
function formatBulan(d) { return d.toLocaleDateString('id-ID',{month:'long',year:'numeric'}); }
function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function capitalize(s) { return s.charAt(0).toUpperCase()+s.slice(1); }
function showMsg(el, type, msg) {
  el.textContent=msg; el.className=`form-msg ${type}`; el.classList.remove('hidden');
  setTimeout(()=>el.classList.add('hidden'),4500);
}

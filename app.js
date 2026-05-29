// app.js v3 - Dirgantara Jaya
import {
  db, collection, addDoc, getDocs, doc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy, where, setDoc, getDoc
} from './firebase-config.js';
import { PAKET_LIST, getKurikulum, getMateriForPertemuan } from './kurikulum.js';

// ================================================================
//  STATE
// ================================================================
let currentUser = null;
let siswaCacheList = [];
let instrukturCacheList = [];
let currentBayarId = null;
let currentNilaiData = null;
let laporanData = { periode:'bulanan', bulan: new Date().toISOString().substring(0,7) };

// ================================================================
//  INIT
// ================================================================
window.addEventListener('DOMContentLoaded', () => {
  const dTgl = document.getElementById('dTglDaftar');
  if (dTgl) dTgl.value = today();
  const lb = document.getElementById('laporanBulan');
  if (lb) lb.value = new Date().toISOString().substring(0,7);
  const lt = document.getElementById('laporanTgl');
  if (lt) lt.value = today();
  const saved = sessionStorage.getItem('djUser');
  if (saved) { currentUser = JSON.parse(saved); enterApp(); }
});

function today() { return new Date().toISOString().split('T')[0]; }
function nowTime() { return new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}); }
function todayLabel() {
  return new Date().toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
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
  if (role==='siswa') {
    uLabel.textContent='No. HP Terdaftar';
    pLabel.textContent='Password (Tanggal Lahir: ddmmyyyy)';
    document.getElementById('loginUsername').placeholder='08xxxxxxxxxx';
    document.getElementById('loginPassword').placeholder='contoh: 15081995';
  } else {
    uLabel.textContent='Username';
    pLabel.textContent='Password';
    document.getElementById('loginUsername').placeholder='Username';
    document.getElementById('loginPassword').placeholder='Password';
  }
};

window.togglePass = function() {
  const inp = document.getElementById('loginPassword');
  const eye = document.getElementById('passEye');
  inp.type = inp.type==='password' ? 'text' : 'password';
  eye.className = inp.type==='password' ? 'fas fa-eye' : 'fas fa-eye-slash';
};

window.doLogin = async function() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');
  if (!username||!password) { errEl.textContent='Username dan password wajib diisi!'; errEl.classList.remove('hidden'); return; }

  if (selectedLoginRole==='admin') {
    if (username==='admin' && password==='admin123') {
      currentUser = {role:'admin',id:'admin',nama:'Administrator',username:'admin'};
      sessionStorage.setItem('djUser', JSON.stringify(currentUser));
      enterApp(); return;
    }
    errEl.textContent='Username atau password admin salah!'; errEl.classList.remove('hidden'); return;
  }

  if (selectedLoginRole==='instruktur') {
    try {
      const snap = await getDocs(query(collection(db,'instruktur'),where('username','==',username)));
      if (snap.empty) { errEl.textContent='Akun instruktur tidak ditemukan!'; errEl.classList.remove('hidden'); return; }
      const data = snap.docs[0].data();
      if (data.password!==password) { errEl.textContent='Password salah!'; errEl.classList.remove('hidden'); return; }
      currentUser = {role:'instruktur',id:snap.docs[0].id,nama:data.nama,username};
      sessionStorage.setItem('djUser', JSON.stringify(currentUser));
      enterApp(); return;
    } catch(e) { errEl.textContent='Error: '+e.message; errEl.classList.remove('hidden'); return; }
  }

  if (selectedLoginRole==='siswa') {
    try {
      const snap = await getDocs(query(collection(db,'siswa'),where('hp','==',username)));
      if (snap.empty) { errEl.textContent='No HP tidak terdaftar!'; errEl.classList.remove('hidden'); return; }
      const data = snap.docs[0].data();
      const tglLahir = data.tglLahir ? data.tglLahir.split('-').reverse().join('') : '';
      if (password!==tglLahir) { errEl.textContent='Password salah! Gunakan tanggal lahir (ddmmyyyy)'; errEl.classList.remove('hidden'); return; }

      // Cek status akun
      if (data.statusAkun && data.statusAkun !== 'aktif') {
        const pesanStatus = data.statusAkun === 'menunggu_verifikasi'
          ? '⏳ Akun kamu sedang menunggu verifikasi bukti transfer oleh admin. Harap tunggu 1x24 jam.'
          : '🏪 Akun kamu belum aktif. Selesaikan pembayaran di kantor Dirgantara Jaya terlebih dahulu.';
        errEl.textContent = pesanStatus;
        errEl.classList.remove('hidden');
        return;
      }
      currentUser = {role:'siswa',id:snap.docs[0].id,nama:data.nama,username};
      sessionStorage.setItem('djUser', JSON.stringify(currentUser));
      enterApp(); return;
    } catch(e) { errEl.textContent='Error: '+e.message; errEl.classList.remove('hidden'); return; }
  }
};

document.addEventListener('keydown', e => {
  if (e.key==='Enter' && !document.getElementById('pageLogin').classList.contains('hidden')) doLogin();
});

// ================================================================
//  ENTER APP
// ================================================================
function enterApp() {
  document.getElementById('pageLogin').classList.add('hidden');
  document.getElementById('pageApp').classList.remove('hidden');
  const roleLabel = {admin:'Administrator',instruktur:'Instruktur',siswa:'Siswa'}[currentUser.role];
  document.getElementById('topBarRole').textContent = roleLabel;
  document.getElementById('topBarName').textContent = currentUser.nama;
  buildTabs();
  listenSiswa();
  if (currentUser.role==='admin') {
    listenInstruktur();
    listenPengeluaran();
    const fp = document.getElementById('filterPengeluaranBulan');
    if (fp) fp.value = new Date().toISOString().substring(0,7);
  }
  if (currentUser.role==='instruktur') setupInstruktur();
  if (currentUser.role==='siswa') loadSiswaDashboard();
}

window.doLogout = function() { sessionStorage.removeItem('djUser'); location.reload(); };

// ================================================================
//  TABS
// ================================================================
function buildTabs() {
  const tabs = document.getElementById('mainTabs');
  tabs.innerHTML = '';
  if (currentUser.role==='admin') {
    tabs.innerHTML = `
      <button class="tab-btn active" onclick="switchTab('adminHome',this)"><i class="fas fa-chart-bar"></i> Portal Admin</button>
      <button class="tab-btn" onclick="switchTab('adminDaftar',this)"><i class="fas fa-user-plus"></i> Daftarkan Siswa</button>`;
    showSection('adminHome');
    setTimeout(()=>{ renderLaporan(); },500);
  } else if (currentUser.role==='instruktur') {
    tabs.innerHTML = `<button class="tab-btn active" onclick="switchTab('instrukturAbsen',this)"><i class="fas fa-check-square"></i> Absen & Nilai</button>`;
    showSection('instrukturAbsen');
    document.getElementById('instrukturTanggal').textContent = todayLabel();
  } else if (currentUser.role==='siswa') {
    tabs.innerHTML = `<button class="tab-btn active" onclick="switchTab('siswaDashboard',this)"><i class="fas fa-graduation-cap"></i> Dashboard Saya</button>`;
    showSection('siswaDashboard');
  }
}

// ================================================================
//  FIRESTORE LISTENERS
// ================================================================
function listenSiswa() {
  onSnapshot(query(collection(db,'siswa'),orderBy('tglDaftar','desc')), snap => {
    siswaCacheList = snap.docs.map(d=>({id:d.id,...d.data()}));
    if (currentUser?.role==='admin') {
      renderKeuanganTable(siswaCacheList);
      renderBiodataTable(siswaCacheList);
      renderLedger(siswaCacheList);
      renderReminder(siswaCacheList);
      renderStats(siswaCacheList);
      renderLaporan();
      renderVerifikasi(siswaCacheList);
      populateDropdowns();
    }
    if (currentUser?.role==='instruktur') { populateDropdowns(); renderInstrukturHariIni(); }
    if (currentUser?.role==='siswa') {
      const me = siswaCacheList.find(s=>s.id===currentUser.id);
      if (me) { renderSiswaProgress(me); renderSiswaAbsen(me); renderSiswaProfil(me); renderSiswaRapor(me); renderSiswaSertifikat(me); }
    }
  });
}

function listenInstruktur() {
  onSnapshot(collection(db,'instruktur'), snap => {
    instrukturCacheList = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderInstrukturTable(instrukturCacheList);
  });
}

function setupInstruktur() {
  onSnapshot(query(collection(db,'siswa'),orderBy('tglDaftar','desc')), snap => {
    siswaCacheList = snap.docs.map(d=>({id:d.id,...d.data()}));
    populateDropdowns(); renderInstrukturHariIni();
  });
}

// ================================================================
//  ADMIN: STATS
// ================================================================
function renderStats(list) {
  let kas=0, tung=0;
  list.forEach(s=>{ kas+=Number(s.terbayar||0); tung+=Math.max(0,Number(s.biaya||0)-Number(s.terbayar||0)); });
  document.getElementById('statTotalMurid').textContent = list.length;
  document.getElementById('statKasMasuk').textContent = formatRp(kas);
  document.getElementById('statTunggakan').textContent = formatRp(tung);
}

// ================================================================
//  ADMIN: KEUANGAN
// ================================================================
function renderKeuanganTable(list) {
  const tbody = document.getElementById('tbodyKeuangan');
  if (!list.length) { tbody.innerHTML=`<tr><td colspan="7" class="empty-row">Belum ada siswa.</td></tr>`; return; }
  tbody.innerHTML = list.map(s=>{
    const sisa = Math.max(0,Number(s.biaya||0)-Number(s.terbayar||0));
    const st = sisa===0?'lunas':Number(s.terbayar)>0?'cicil':'tunggak';
    const bc = {lunas:'badge-lunas',cicil:'badge-cicil',tunggak:'badge-tunggak'}[st];
    const bl = {lunas:'LUNAS',cicil:'CICILAN',tunggak:'TUNGGAKAN'}[st];
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
//  ADMIN: BIODATA
// ================================================================
function renderBiodataTable(list) {
  const tbody = document.getElementById('tbodyBiodata');
  if (!list.length) { tbody.innerHTML=`<tr><td colspan="7" class="empty-row">Belum ada siswa.</td></tr>`; return; }
  tbody.innerHTML = list.map(s=>{
    const prog = s.absen?.length||0;
    const total = s.totalPertemuan||10;
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
      <td><button class="btn-sm green" onclick="lihatRaporAdmin('${s.id}')"><i class="fas fa-file-alt"></i> Rapor</button></td>
    </tr>`;
  }).join('');
}

window.lihatRaporAdmin = function(id) {
  const s = siswaCacheList.find(x=>x.id===id);
  if (!s) return;
  // Show rapor in a new tab or alert
  const w = window.open('','_blank');
  w.document.write(buildRaporHTML(s));
  w.document.close();
};

// ================================================================
//  ADMIN: LEDGER
// ================================================================
function renderLedger(list) {
  const el = document.getElementById('ledgerContent');
  if (!list.length) { el.innerHTML=`<p class="empty-state">Belum ada data.</p>`; return; }
  const groups = {};
  list.forEach(s=>{
    const tgl = s.tglDaftar||today();
    const key = tgl.substring(0,7);
    if (!groups[key]) groups[key]={label:formatBulan(new Date(tgl+'-01')),items:[],total:0};
    groups[key].items.push(s);
    groups[key].total += Number(s.terbayar||0);
  });
  el.innerHTML = Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).map(([,g])=>`
    <div style="background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow-sm);margin-bottom:14px;overflow:hidden">
      <div style="background:var(--green-dark);padding:12px 16px;display:flex;justify-content:space-between">
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
//  ADMIN: LAPORAN KEUANGAN
// ================================================================
window.renderLaporan = function() {
  const periode = document.getElementById('laporanPeriode')?.value || 'bulanan';
  const bulanEl = document.getElementById('laporanBulan');
  const tglEl = document.getElementById('laporanTgl');
  if (!bulanEl) return;

  // Show/hide input
  if (periode==='harian') { bulanEl.classList.add('hidden'); tglEl?.classList.remove('hidden'); }
  else { bulanEl.classList.remove('hidden'); tglEl?.classList.add('hidden'); }

  const bulanVal = bulanEl.value || new Date().toISOString().substring(0,7);
  const tglVal = tglEl?.value || today();
  laporanData = { periode, bulan: bulanVal, tgl: tglVal };
  const el = document.getElementById('laporanContent');
  if (!el) return;

  let filtered = [];
  let periodeLabel = '';

  if (periode==='bulanan') {
    filtered = siswaCacheList.filter(s => (s.tglDaftar||'').startsWith(bulanVal));
    periodeLabel = formatBulan(new Date(bulanVal+'-01'));
    // Juga ambil dari riwayat absen untuk menghitung jam
  } else if (periode==='mingguan') {
    const tgl = new Date(bulanVal+'-01');
    const [y,m] = bulanVal.split('-');
    // Group per minggu dalam bulan
    const allInMonth = siswaCacheList.filter(s => (s.tglDaftar||'').startsWith(bulanVal));
    filtered = allInMonth;
    periodeLabel = `Minggu-minggu di ${formatBulan(new Date(bulanVal+'-01'))}`;
  } else if (periode==='harian') {
    filtered = siswaCacheList.filter(s => s.tglDaftar === tglVal);
    // Juga ambil absen hari itu
    const allAbsenHariIni = siswaCacheList.filter(s =>
      (s.absen||[]).some(a => a.tgl === tglVal)
    );
    filtered = [...new Map([...filtered,...allAbsenHariIni].map(x=>[x.id,x])).values()];
    periodeLabel = new Date(tglVal).toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  }

  const totalMasuk = filtered.reduce((a,s)=>a+Number(s.terbayar||0),0);
  const totalTarget = filtered.reduce((a,s)=>a+Number(s.biaya||0),0);
  const totalSisa = Math.max(0, totalTarget - totalMasuk);
  const jumlahSiswa = filtered.length;

  // Pengeluaran periode ini
  let filteredKeluar = [];
  if (periode==='harian') {
    filteredKeluar = pengeluaranCacheList.filter(p=>p.tgl===tglVal);
  } else {
    filteredKeluar = pengeluaranCacheList.filter(p=>(p.tgl||'').startsWith(bulanVal));
  }
  const totalKeluar = filteredKeluar.reduce((a,p)=>a+Number(p.jumlah||0),0);
  const labaRugi = totalMasuk - totalKeluar;

  // Hitung total jam belajar dari absen
  let totalPertemuan = 0;
  filtered.forEach(s => { totalPertemuan += (s.absen||[]).length; });

  // Build bar chart data (per minggu jika bulanan)
  let chartHTML = '';
  if (periode==='bulanan') {
    const weeks = [0,0,0,0,0];
    siswaCacheList.forEach(s=>{
      (s.absen||[]).forEach(a=>{
        if (!a.tgl || !a.tgl.startsWith(bulanVal)) return;
        const d = new Date(a.tgl).getDate();
        const wk = Math.min(Math.floor((d-1)/7), 4);
        weeks[wk] += Number(s.jamPerSesi||1);
      });
    });
    // Pendapatan per minggu
    const incomeWeeks = [0,0,0,0,0];
    siswaCacheList.forEach(s=>{
      if ((s.tglDaftar||'').startsWith(bulanVal)) {
        const d = new Date(s.tglDaftar||today()).getDate();
        const wk = Math.min(Math.floor((d-1)/7),4);
        incomeWeeks[wk] += Number(s.terbayar||0);
      }
    });
    const maxIncome = Math.max(...incomeWeeks, 1);
    chartHTML = `
      <div class="chart-wrap">
        <h3><i class="fas fa-chart-bar"></i> Pendapatan per Minggu — ${periodeLabel}</h3>
        <div class="bar-chart">
          ${incomeWeeks.slice(0,4).map((v,i)=>`
            <div class="bar-col">
              <div class="bar-val">${v>0?formatRpShort(v):''}</div>
              <div class="bar-fill" style="height:${Math.round((v/maxIncome)*110)+4}px;background:${v>0?'#2d6a4f':'#e5e7eb'}"></div>
              <div class="bar-lbl">Mg ${i+1}</div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  el.innerHTML = `
    <div id="laporanPrintArea">
      <!-- PRINT HEADER -->
      <div class="laporan-print-header" style="display:none">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:10px">
          <img src="logo.png" style="width:64px;height:64px;border-radius:50%;object-fit:cover" onerror="this.style.display='none'"/>
          <div>
            <h2 style="font-size:18px;font-weight:800;color:#1a3d2b">KURSUS MENGEMUDI DIRGANTARA JAYA</h2>
            <p style="font-size:12px;color:#4b5563">Jl. Akses UI No.75 Tugu, Cimanggis, Depok | (021) 87752889 / 0812-8168-0117</p>
            <p style="font-size:11px;color:#9ca3af">Ijin DISNAKERSOS NO. 563/458/Laptenta/07 | NIB: 8120000722684</p>
          </div>
        </div>
        <div style="border-top:2px solid #1a3d2b;border-bottom:1px solid #e5e7eb;padding:8px 0;margin-bottom:14px">
          <h3 style="font-size:16px;font-weight:700;color:#1a3d2b">Laporan Keuangan ${periode==='harian'?'Harian':periode==='mingguan'?'Mingguan':'Bulanan'} — ${periodeLabel}</h3>
          <p style="font-size:11px;color:#9ca3af">Dicetak: ${new Date().toLocaleString('id-ID')}</p>
        </div>
      </div>

      <div style="background:var(--white);border-radius:var(--radius);padding:18px;margin-bottom:14px;box-shadow:var(--shadow-sm)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="font-size:16px;font-weight:700;color:var(--green-dark)">
              Laporan Keuangan ${periode==='harian'?'Harian':periode==='mingguan'?'Mingguan':'Bulanan'}
            </h3>
            <p style="font-size:13px;color:var(--gray-600)">${periodeLabel}</p>
          </div>
          <div style="font-size:11px;color:var(--gray-400)">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
        </div>
        <div class="laporan-summary">
          <div class="stat-card green"><div class="stat-icon"><i class="fas fa-users"></i></div><div class="stat-info"><span class="stat-label">Siswa</span><span class="stat-value">${jumlahSiswa}</span></div></div>
          <div class="stat-card yellow"><div class="stat-icon"><i class="fas fa-coins"></i></div><div class="stat-info"><span class="stat-label">Pemasukan</span><span class="stat-value" style="font-size:13px">${formatRp(totalMasuk)}</span></div></div>
          <div class="stat-card red"><div class="stat-icon"><i class="fas fa-arrow-down"></i></div><div class="stat-info"><span class="stat-label">Pengeluaran</span><span class="stat-value" style="font-size:13px">${formatRp(totalKeluar)}</span></div></div>
          <div class="stat-card ${labaRugi>=0?'green':'red'}"><div class="stat-icon"><i class="fas fa-chart-line"></i></div><div class="stat-info"><span class="stat-label">Laba / Rugi</span><span class="stat-value" style="font-size:13px;color:${labaRugi>=0?'#166534':'#991b1b'}">${labaRugi>=0?'+':''}${formatRp(labaRugi)}</span></div></div>
          <div class="stat-card blue"><div class="stat-icon"><i class="fas fa-clock"></i></div><div class="stat-info"><span class="stat-label">Total Pertemuan</span><span class="stat-value">${totalPertemuan}x</span></div></div>
          <div class="stat-card red"><div class="stat-icon"><i class="fas fa-file-invoice"></i></div><div class="stat-info"><span class="stat-label">Tunggakan</span><span class="stat-value" style="font-size:13px">${formatRp(totalSisa)}</span></div></div>
        </div>
      </div>
      ${chartHTML}

      <!-- TABEL PEMASUKAN -->
      <div style="margin-bottom:6px;font-size:13px;font-weight:700;color:var(--green-dark)"><i class="fas fa-arrow-up" style="color:#166534"></i> Pemasukan Siswa</div>
      <div class="table-container" style="margin-bottom:16px">
        <table class="data-table">
          <thead><tr><th>NAMA SISWA</th><th>PAKET</th><th>TGL DAFTAR</th><th>BIAYA</th><th>TERBAYAR</th><th>SISA</th><th>PERTEMUAN</th><th>STATUS</th></tr></thead>
          <tbody>
            ${filtered.length ? filtered.map(s=>{
              const sisa=Math.max(0,Number(s.biaya||0)-Number(s.terbayar||0));
              const st=sisa===0?'LUNAS':Number(s.terbayar)>0?'CICILAN':'TUNGGAKAN';
              const bc={LUNAS:'badge-lunas',CICILAN:'badge-cicil',TUNGGAKAN:'badge-tunggak'}[st];
              const prog=(s.absen||[]).length;
              return `<tr>
                <td><strong>${esc(s.nama)}</strong><div style="font-size:11px;color:#9ca3af">${esc(s.hp||'')}</div></td>
                <td style="font-size:12px">${esc(s.paketLabel||'-')}</td>
                <td>${formatTgl(s.tglDaftar)}</td>
                <td>${formatRp(s.biaya)}</td>
                <td style="color:#166534;font-weight:700">${formatRp(s.terbayar)}</td>
                <td style="color:${sisa>0?'#991b1b':'#166534'};font-weight:700">${formatRp(sisa)}</td>
                <td style="text-align:center">${prog}/${s.totalPertemuan||10}</td>
                <td><span class="badge ${bc}">${st}</span></td>
              </tr>`;
            }).join('') : `<tr><td colspan="8" class="empty-row">Tidak ada data pemasukan untuk periode ini.</td></tr>`}
          </tbody>
          ${filtered.length ? `<tfoot>
            <tr style="background:var(--green-dark);color:white;font-weight:700">
              <td colspan="4" style="padding:10px 13px">TOTAL PEMASUKAN</td>
              <td style="padding:10px 13px;color:#f5b800">${formatRp(totalMasuk)}</td>
              <td style="padding:10px 13px;color:#fca5a5">${formatRp(totalSisa)}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>` : ''}
        </table>
      </div>

      <!-- TABEL PENGELUARAN -->
      <div style="margin-bottom:6px;font-size:13px;font-weight:700;color:#991b1b"><i class="fas fa-arrow-down"></i> Pengeluaran Operasional</div>
      <div class="table-container" style="margin-bottom:16px">
        <table class="data-table">
          <thead><tr><th>TGL</th><th>KATEGORI</th><th>KETERANGAN</th><th>JUMLAH</th><th>BUKTI</th></tr></thead>
          <tbody>
            ${filteredKeluar.length ? filteredKeluar.map(p=>`<tr>
              <td>${formatTgl(p.tgl)}</td>
              <td><span class="badge badge-cicil" style="font-size:11px">${esc(p.kategori)}</span></td>
              <td>${esc(p.keterangan)}</td>
              <td style="font-weight:700;color:#991b1b">${formatRp(p.jumlah)}</td>
              <td><a href="${esc(p.fotoBukti)}" target="_blank" style="color:#1976d2;font-size:12px">Lihat Bukti</a></td>
            </tr>`).join('') : `<tr><td colspan="5" class="empty-row">Tidak ada pengeluaran periode ini.</td></tr>`}
          </tbody>
          ${filteredKeluar.length ? `<tfoot>
            <tr style="background:var(--red-light)">
              <td colspan="3" style="padding:10px 13px;font-weight:700;color:#991b1b">TOTAL PENGELUARAN</td>
              <td style="padding:10px 13px;font-weight:800;color:#991b1b">${formatRp(totalKeluar)}</td>
              <td></td>
            </tr>
          </tfoot>` : ''}
        </table>
      </div>

      <!-- REKAP LABA RUGI -->
      <div style="background:var(--green-dark);border-radius:var(--radius);padding:16px 20px;color:white">
        <h3 style="font-size:14px;font-weight:700;margin-bottom:12px"><i class="fas fa-balance-scale"></i> Rekap Laba / Rugi — ${periodeLabel}</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center">
          <div style="background:rgba(255,255,255,.1);border-radius:8px;padding:12px">
            <div style="font-size:10px;opacity:.7;text-transform:uppercase;font-weight:600">Total Pemasukan</div>
            <div style="font-size:16px;font-weight:800;color:#f5b800;margin-top:4px">${formatRp(totalMasuk)}</div>
          </div>
          <div style="background:rgba(255,255,255,.1);border-radius:8px;padding:12px">
            <div style="font-size:10px;opacity:.7;text-transform:uppercase;font-weight:600">Total Pengeluaran</div>
            <div style="font-size:16px;font-weight:800;color:#fca5a5;margin-top:4px">${formatRp(totalKeluar)}</div>
          </div>
          <div style="background:${labaRugi>=0?'rgba(74,222,128,.2)':'rgba(239,68,68,.2)'};border-radius:8px;padding:12px;border:1.5px solid ${labaRugi>=0?'rgba(74,222,128,.5)':'rgba(239,68,68,.5)'}">
            <div style="font-size:10px;opacity:.7;text-transform:uppercase;font-weight:600">${labaRugi>=0?'LABA BERSIH':'RUGI'}</div>
            <div style="font-size:18px;font-weight:800;color:${labaRugi>=0?'#4ade80':'#fca5a5'};margin-top:4px">${labaRugi>=0?'+':''}${formatRp(labaRugi)}</div>
          </div>
        </div>
        <p style="font-size:11px;opacity:.5;margin-top:12px;text-align:right">Gelar Dirgantara S.IIP M.Kom — Direktur / Pimpinan</p>
      </div>
    </div>`;
};

window.cetakLaporan = function() {
  window.print();
};

// ================================================================
//  ADMIN: VERIFIKASI PENDAFTAR BARU
// ================================================================
function renderVerifikasi(list) {
  const menunggu = list.filter(s =>
    s.statusAkun === 'menunggu_verifikasi' || s.statusAkun === 'menunggu_pembayaran'
  );

  // Update badge
  const badge = document.getElementById('badgeVerifikasi');
  if (badge) {
    if (menunggu.length > 0) {
      badge.textContent = menunggu.length;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  const el = document.getElementById('verifikasiContent');
  if (!el) return;

  if (!menunggu.length) {
    el.innerHTML = `<div class="empty-state" style="color:#166534">
      <i class="fas fa-check-circle" style="font-size:32px;margin-bottom:8px;display:block"></i>
      <strong>Tidak ada pendaftar yang menunggu verifikasi</strong>
      <p style="margin-top:6px;font-size:12px;color:#9ca3af">Semua akun sudah aktif atau belum ada pendaftar baru.</p>
    </div>`;
    return;
  }

  el.innerHTML = menunggu.map(s => {
    const isTransfer = s.statusAkun === 'menunggu_verifikasi';
    const statusLabel = isTransfer ? '⏳ Menunggu Verifikasi Transfer' : '🏪 Menunggu Pembayaran di Kantor';
    const statusColor = isTransfer ? '#854d0e' : '#1976d2';
    const statusBg = isTransfer ? '#fef9c3' : '#e3f2fd';

    return `<div class="verif-card ${s.statusAkun}">
      <div class="verif-card-header">
        <div>
          <strong style="font-size:15px">${esc(s.nama)}</strong>
          <div style="font-size:12px;color:#9ca3af;margin-top:2px">${esc(s.hp)} | Daftar: ${formatTgl(s.tglDaftar)}</div>
        </div>
        <span style="background:${statusBg};color:${statusColor};font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px">${statusLabel}</span>
      </div>
      <div class="verif-card-body">
        <div class="verif-info-grid">
          <div class="verif-info-item"><span>Paket</span><strong>${esc(s.paketLabel||'-')}</strong></div>
          <div class="verif-info-item"><span>Transmisi</span><strong>${esc(s.transmisi||'-')}</strong></div>
          <div class="verif-info-item"><span>Total Biaya</span><strong style="color:#1a3d2b">${formatRp(s.biaya)}</strong></div>
          <div class="verif-info-item"><span>Metode Bayar</span><strong>${esc(s.metodeBayar||'-')}</strong></div>
          ${s.nominalTransfer ? `<div class="verif-info-item"><span>Nominal Transfer</span><strong style="color:#166534">${formatRp(s.nominalTransfer)}</strong></div>` : ''}
          <div class="verif-info-item"><span>Pengalaman</span><strong>${esc(s.pengalaman||'-')}</strong></div>
        </div>

        ${s.buktiTransfer ? `
          <p style="font-size:12px;font-weight:600;color:#4b5563;margin-bottom:6px"><i class="fas fa-image"></i> Bukti Transfer:</p>
          <img src="${s.buktiTransfer}" class="bukti-img" alt="Bukti Transfer" onclick="zoomImg(this)"/>
        ` : `
          <div style="background:#f3f4f6;border-radius:6px;padding:10px 12px;margin-bottom:10px;font-size:12px;color:#9ca3af">
            <i class="fas fa-store"></i> Pembayaran ${s.metodeBayar==='cash'?'cash':'EDC'} langsung di kantor — tidak ada bukti digital.
          </div>
        `}

        <div class="verif-actions">
          <button class="btn-primary" onclick="aktifkanAkun('${s.id}','${esc(s.nama)}',${s.nominalTransfer||s.biaya||0})">
            <i class="fas fa-check-circle"></i> Aktifkan Akun
          </button>
          <button class="btn-secondary" onclick="tolakPendaftar('${s.id}','${esc(s.nama)}')">
            <i class="fas fa-times-circle"></i> Tolak / Hapus
          </button>
          <a href="https://wa.me/${(s.hp||'').replace(/^0/,'62')}?text=${encodeURIComponent(`Halo ${s.nama}! Terima kasih sudah mendaftar kursus mengemudi Dirgantara Jaya. Pendaftaran kamu sedang kami proses. Untuk informasi lebih lanjut hubungi kami di 0812-8168-0117 🙏`)}"
            target="_blank" class="btn-sm green" style="text-decoration:none;padding:9px 14px">
            <i class="fab fa-whatsapp"></i> Hubungi WA
          </a>
        </div>
      </div>
    </div>`;
  }).join('');
}

window.aktifkanAkun = async function(id, nama, nominal) {
  if (!confirm(`Aktifkan akun "${nama}"?\nNominal diterima: ${formatRp(nominal)}`)) return;
  try {
    await updateDoc(doc(db,'siswa',id), {
      statusAkun: 'aktif',
      terbayar: nominal,
      tglAktif: today()
    });
    showToast(`✅ Akun "${nama}" berhasil diaktifkan!`);

    // Kirim notif WA ke siswa
    const s = siswaCacheList.find(x=>x.id===id);
    if (s) {
      const waUrl = `https://wa.me/${(s.hp||'').replace(/^0/,'62')}?text=${encodeURIComponent(`Halo ${s.nama}! 🎉 Pendaftaran kursus mengemudi Dirgantara Jaya kamu TELAH DIAKTIFKAN!\n\n📱 Login di: remarkable-marigold-ccebb8.netlify.app\n👤 Username: ${s.hp}\n🔑 Password: ${(s.tglLahir||'').split('-').reverse().join('')}\n\nSelamat belajar! 🚗\n\nInfo: 0851-5678-1329`)}`;
      if (confirm('Kirim notifikasi WhatsApp ke siswa?')) window.open(waUrl,'_blank');
    }
  } catch(e) { showToast('Gagal: '+e.message,'error'); }
};

window.tolakPendaftar = async function(id, nama) {
  if (!confirm(`Tolak dan hapus pendaftaran "${nama}"?\nData akan dihapus permanen.`)) return;
  await deleteDoc(doc(db,'siswa',id));
  showToast(`🗑️ Pendaftaran "${nama}" ditolak dan dihapus.`);
};

window.zoomImg = function(img) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px';
  overlay.innerHTML = `<img src="${img.src}" style="max-width:100%;max-height:90vh;border-radius:8px;object-fit:contain"/>`;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
};

// ================================================================
// ================================================================
let pengeluaranCacheList = [];

function listenPengeluaran() {
  const bulan = document.getElementById('filterPengeluaranBulan')?.value || new Date().toISOString().substring(0,7);
  onSnapshot(query(collection(db,'pengeluaran'), orderBy('tgl','desc')), snap => {
    pengeluaranCacheList = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderPengeluaran(pengeluaranCacheList);
  });
}

window.loadPengeluaran = function() {
  const bulan = document.getElementById('filterPengeluaranBulan')?.value || new Date().toISOString().substring(0,7);
  const filtered = pengeluaranCacheList.filter(p=>(p.tgl||'').startsWith(bulan));
  renderPengeluaran(filtered);
};

function renderPengeluaran(list) {
  const bulan = document.getElementById('filterPengeluaranBulan')?.value || new Date().toISOString().substring(0,7);
  const filtered = list.filter(p=>(p.tgl||'').startsWith(bulan));

  const totalKeluar = filtered.reduce((a,p)=>a+Number(p.jumlah||0),0);
  const statsEl = document.getElementById('pengeluaranStats');
  if (statsEl) {
    const totalMasuk = siswaCacheList.filter(s=>(s.tglDaftar||'').startsWith(bulan)).reduce((a,s)=>a+Number(s.terbayar||0),0);
    const labaRugi = totalMasuk - totalKeluar;
    statsEl.innerHTML = `<div class="stats-row" style="margin-bottom:0">
      <div class="stat-card red"><div class="stat-icon"><i class="fas fa-arrow-down"></i></div><div class="stat-info"><span class="stat-label">Total Pengeluaran</span><span class="stat-value" style="font-size:15px">${formatRp(totalKeluar)}</span></div></div>
      <div class="stat-card yellow"><div class="stat-icon"><i class="fas fa-arrow-up"></i></div><div class="stat-info"><span class="stat-label">Total Pemasukan</span><span class="stat-value" style="font-size:15px">${formatRp(totalMasuk)}</span></div></div>
      <div class="stat-card ${labaRugi>=0?'green':'red'}"><div class="stat-icon"><i class="fas fa-${labaRugi>=0?'chart-line':'exclamation-triangle'}"></i></div><div class="stat-info"><span class="stat-label">Laba / Rugi</span><span class="stat-value" style="font-size:15px;color:${labaRugi>=0?'#166534':'#991b1b'}">${labaRugi>=0?'+':''}${formatRp(labaRugi)}</span></div></div>
    </div>`;
  }

  const listEl = document.getElementById('pengeluaranList');
  if (!listEl) return;
  if (!filtered.length) { listEl.innerHTML=`<p class="empty-state">Belum ada pengeluaran di bulan ini.</p>`; return; }

  // Group by kategori
  const byKat = {};
  filtered.forEach(p=>{
    if (!byKat[p.kategori]) byKat[p.kategori]={items:[],total:0};
    byKat[p.kategori].items.push(p);
    byKat[p.kategori].total+=Number(p.jumlah||0);
  });

  listEl.innerHTML = `<div class="table-container">
    <table class="data-table">
      <thead><tr><th>TGL</th><th>KATEGORI</th><th>KETERANGAN</th><th>JUMLAH</th><th>BUKTI</th><th>AKSI</th></tr></thead>
      <tbody>
        ${filtered.map(p=>`<tr>
          <td>${formatTgl(p.tgl)}</td>
          <td><span class="badge badge-cicil" style="font-size:11px">${esc(p.kategori)}</span></td>
          <td>${esc(p.keterangan)}</td>
          <td style="font-weight:700;color:#991b1b">${formatRp(p.jumlah)}</td>
          <td><a href="${esc(p.fotoBukti)}" target="_blank" class="btn-sm blue" style="text-decoration:none"><i class="fas fa-image"></i> Lihat</a></td>
          <td><button class="btn-sm red" onclick="hapusPengeluaran('${p.id}')"><i class="fas fa-trash"></i></button></td>
        </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr style="background:var(--red-light)">
          <td colspan="3" style="padding:10px 13px;font-weight:700;color:#991b1b">TOTAL PENGELUARAN</td>
          <td style="padding:10px 13px;font-weight:800;color:#991b1b">${formatRp(totalKeluar)}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>
  </div>`;
}

// ── UPLOAD BUKTI PENGELUARAN ──
let pengeluaranBuktiBase64 = null;

window.previewPengeluaranBukti = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5*1024*1024) { showToast('❌ File terlalu besar! Maks 5MB','error'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    // Kompres gambar sebelum simpan
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX) { h = Math.round(h*MAX/w); w = MAX; }
      if (h > MAX) { w = Math.round(w*MAX/h); h = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      pengeluaranBuktiBase64 = canvas.toDataURL('image/jpeg', 0.7);
      document.getElementById('pBuktiImg').src = pengeluaranBuktiBase64;
      document.getElementById('pBuktiPreview').style.display = 'block';
      document.getElementById('pUploadArea').style.display = 'none';
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
};

window.removePengeluaranBukti = function() {
  pengeluaranBuktiBase64 = null;
  document.getElementById('pBuktiPreview').style.display = 'none';
  document.getElementById('pUploadArea').style.display = 'block';
  document.getElementById('pFileBukti').value = '';
};

window.simpanPengeluaran = async function() {
  const tgl = document.getElementById('pTgl').value;
  const kategori = document.getElementById('pKategori').value;
  const keterangan = document.getElementById('pKet').value.trim();
  const jumlah = Number(document.getElementById('pJumlah').value)||0;
  const msg = document.getElementById('pengeluaranMsg');

  if (!tgl||!kategori||!keterangan||!jumlah) { showMsg(msg,'error','❌ Semua field wajib diisi!'); return; }
  if (!pengeluaranBuktiBase64) { showMsg(msg,'error','❌ Foto bukti pembayaran wajib diupload!'); return; }

  try {
    await addDoc(collection(db,'pengeluaran'),{
      tgl, kategori, keterangan, jumlah,
      fotoBukti: pengeluaranBuktiBase64,
      createdAt: new Date().toISOString()
    });
    showMsg(msg,'success','✅ Pengeluaran berhasil disimpan!');
    document.getElementById('pTgl').value='';
    document.getElementById('pKategori').value='';
    document.getElementById('pKet').value='';
    document.getElementById('pJumlah').value='';
    removePengeluaranBukti();
    showToast('✅ Pengeluaran tersimpan!');
  } catch(e) { showMsg(msg,'error','Gagal: '+e.message); }
};

window.hapusPengeluaran = async function(id) {
  if (!confirm('Hapus data pengeluaran ini?')) return;
  await deleteDoc(doc(db,'pengeluaran',id));
  showToast('🗑️ Pengeluaran dihapus.');
};

// ================================================================
// ================================================================
function renderReminder(list) {
  const el = document.getElementById('reminderContent');
  const tunggak = list.filter(s=>Math.max(0,Number(s.biaya||0)-Number(s.terbayar||0))>0);
  if (!tunggak.length) { el.innerHTML=`<div class="empty-state" style="color:#166534"><i class="fas fa-check-circle" style="font-size:32px;margin-bottom:8px;display:block"></i>Semua siswa sudah lunas!</div>`; return; }
  el.innerHTML = `<div style="margin-bottom:12px;padding:10px 14px;background:var(--red-light);border-radius:var(--radius-sm);font-size:13px;color:var(--red);font-weight:600">
    <i class="fas fa-exclamation-triangle"></i> ${tunggak.length} siswa memiliki tunggakan pembayaran</div>` +
    tunggak.map(s=>{
      const sisa=Math.max(0,Number(s.biaya||0)-Number(s.terbayar||0));
      const wa=`https://wa.me/${(s.hp||'').replace(/^0/,'62')}?text=${encodeURIComponent(`Halo ${s.nama}, kami mengingatkan tunggakan kursus mengemudi Dirgantara Jaya sebesar ${formatRp(sisa)}. Mohon segera dilunasi. Terima kasih 🙏`)}`;
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
//  ADMIN: INSTRUKTUR
// ================================================================
function renderInstrukturTable(list) {
  const tbody = document.getElementById('tbodyInstruktur');
  if (!list.length) { tbody.innerHTML=`<tr><td colspan="4" class="empty-row">Belum ada instruktur.</td></tr>`; return; }
  tbody.innerHTML = list.map(i=>`<tr>
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
    await addDoc(collection(db,'instruktur'),{nama,username,password});
    showMsg(msg,'success',`✅ Instruktur "${nama}" berhasil ditambahkan!`);
    document.getElementById('iNama').value='';
    document.getElementById('iUsername').value='';
    document.getElementById('iPassword').value='';
    showToast(`✅ Instruktur ${nama} ditambahkan!`);
  } catch(e) { showMsg(msg,'error','Gagal: '+e.message); }
};

window.hapusInstruktur = async function(id,nama) {
  if (!confirm(`Hapus instruktur "${nama}"?`)) return;
  await deleteDoc(doc(db,'instruktur',id));
  showToast(`🗑️ Instruktur ${nama} dihapus.`);
};

// ================================================================
//  ADMIN: DAFTAR SISWA
// ================================================================
window.updatePaketOptions = function() {
  const transmisi = document.getElementById('dTransmisi').value;
  const paketSel = document.getElementById('dPaket');
  paketSel.innerHTML = `<option value="">-- Pilih Paket --</option>`;
  if (!transmisi) return;
  const groups = {'Reguler':['7x','8x','9x','10x'],'Khusus':['Trampil','Melancarkan','Rental']};
  Object.entries(groups).forEach(([grp,keys])=>{
    const og = document.createElement('optgroup');
    og.label = `--- ${grp} ---`;
    keys.forEach(k=>{
      const key=`${transmisi}-${k}`;
      if (PAKET_LIST[key]) {
        const o=document.createElement('option');
        o.value=key; o.textContent=`${PAKET_LIST[key].label} — ${formatRp(PAKET_LIST[key].harga)}`;
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
  if (key&&PAKET_LIST[key]) { biayaEl.value=PAKET_LIST[key].harga; updateDaftarPreview(); }
  else biayaEl.value='';
};

function updateDaftarPreview() {
  const nama=document.getElementById('dNama').value.trim();
  const hp=document.getElementById('dHP').value.trim();
  const tglLahir=document.getElementById('dTglLahir').value;
  const key=document.getElementById('dPaket').value;
  const dp=Number(document.getElementById('dDP').value)||0;
  const preview=document.getElementById('daftarPreview');
  const content=document.getElementById('daftarPreviewContent');
  if (!nama||!hp||!key) { preview.classList.add('hidden'); return; }
  const paket=PAKET_LIST[key];
  const pass=tglLahir?tglLahir.split('-').reverse().join(''):'(belum diisi)';
  content.innerHTML=`
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

['dNama','dHP','dTglLahir','dDP'].forEach(id=>{
  document.getElementById(id)?.addEventListener('input', updateDaftarPreview);
});

window.daftarSiswa = async function() {
  const nama=document.getElementById('dNama').value.trim();
  const hp=document.getElementById('dHP').value.trim();
  const tglLahir=document.getElementById('dTglLahir').value;
  const alamat=document.getElementById('dAlamat').value.trim();
  const paketKey=document.getElementById('dPaket').value;
  const dp=Number(document.getElementById('dDP').value)||0;
  const tglDaftar=document.getElementById('dTglDaftar').value||today();
  const catatan=document.getElementById('dCatatan').value.trim();
  const msg=document.getElementById('daftarMsg');
  if (!nama||!hp||!tglLahir||!paketKey) { showMsg(msg,'error','❌ Nama, No HP, Tanggal Lahir, dan Paket wajib diisi!'); return; }
  const paket=PAKET_LIST[paketKey];
  try {
    await addDoc(collection(db,'siswa'),{
      nama, hp, tglLahir, alamat, paketKey,
      paketLabel:paket.label, transmisi:paket.transmisi,
      totalPertemuan:paket.pertemuan, jamPerSesi:paket.jamPerSesi,
      biaya:paket.harga, terbayar:dp,
      tglDaftar, catatan, absen:[]
    });
    showMsg(msg,'success',`✅ "${nama}" berhasil didaftarkan! Login: ${hp} / ${tglLahir.split('-').reverse().join('')}`);
    resetFormDaftar();
    showToast(`✅ ${nama} berhasil didaftarkan!`);
  } catch(e) { showMsg(msg,'error','❌ Gagal: '+e.message); }
};

window.resetFormDaftar = function() {
  ['dNama','dHP','dAlamat','dDP','dCatatan'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
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
  const s=siswaCacheList.find(x=>x.id===id);
  if (!s) return;
  currentBayarId=id;
  const sisa=Math.max(0,Number(s.biaya)-Number(s.terbayar));
  document.getElementById('modalBayarInfo').textContent=`${s.nama} — Sisa: ${formatRp(sisa)}`;
  document.getElementById('modalBayarJumlah').value='';
  document.getElementById('modalBayarKet').value='';
  openModal('modalBayar');
};

window.simpanBayar = async function() {
  const jumlah=Number(document.getElementById('modalBayarJumlah').value)||0;
  if (jumlah<=0) { showToast('❌ Jumlah tidak valid!','error'); return; }
  const s=siswaCacheList.find(x=>x.id===currentBayarId);
  if (!s) return;
  await updateDoc(doc(db,'siswa',currentBayarId),{terbayar:Number(s.terbayar||0)+jumlah});
  showToast(`✅ Bayar ${formatRp(jumlah)} berhasil!`);
  closeModal('modalBayar');
};

window.hapusSiswa = async function(id,nama) {
  if (!confirm(`Hapus data "${nama}"?`)) return;
  await deleteDoc(doc(db,'siswa',id));
  showToast(`🗑️ "${nama}" dihapus.`);
};

// ================================================================
//  INSTRUKTUR: HARI INI
// ================================================================
function renderInstrukturHariIni() {
  const panel=document.getElementById('instrukturHariIniPanel');
  if (!panel) return;
  const todayStr=today();
  const sudahAbsen=siswaCacheList.filter(s=>(s.absen||[]).some(a=>a.tgl===todayStr&&a.status==='hadir_siswa'));
  if (!sudahAbsen.length) {
    panel.innerHTML=`<div class="empty-state"><i class="fas fa-clock" style="font-size:28px;margin-bottom:8px;display:block;color:#9ca3af"></i>Belum ada siswa yang absen hari ini.<br><small>Siswa perlu klik "Absen Hadir" dari portal mereka terlebih dahulu.</small></div>`;
    return;
  }
  panel.innerHTML=sudahAbsen.map(s=>{
    const absenHariIni=(s.absen||[]).find(a=>a.tgl===todayStr&&a.status==='hadir_siswa');
    const nomorPertemuan=absenHariIni?.pertemuan||(s.absen?.length||0);
    const sudahDinilai=absenHariIni?.nilai!==undefined&&absenHariIni?.nilai!==null;
    return `<div class="siswa-absen-card">
      <div class="siswa-absen-info">
        <strong>${esc(s.nama)}</strong>
        <span>${esc(s.paketLabel||'-')} | Pertemuan ke-${nomorPertemuan}</span>
        <span style="font-size:11px;color:#9ca3af">${esc(s.hp||'-')} | Absen jam ${absenHariIni?.jam||'-'}</span>
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
  const panel=document.getElementById('instrukturRiwayatPanel');
  if (!id) { panel.innerHTML=`<p class="empty-state">Pilih siswa.</p>`; return; }
  const s=siswaCacheList.find(x=>x.id===id);
  if (!s) return;
  const absen=s.absen||[];
  if (!absen.length) { panel.innerHTML=`<p class="empty-state">Belum ada catatan absensi.</p>`; return; }
  panel.innerHTML=`<div class="table-container">
    <table class="data-table">
      <thead><tr><th>TGL</th><th>JAM</th><th>PERTEMUAN</th><th>MATERI</th><th>STATUS</th><th>NILAI</th><th>INSTRUKTUR</th><th>CATATAN</th></tr></thead>
      <tbody>
        ${absen.map((a,i)=>{
          const materi=getMateriForPertemuan(s.transmisi||'Manual',a.pertemuan||i+1,s.totalPertemuan||10);
          return `<tr>
            <td>${formatTgl(a.tgl)}</td>
            <td>${a.jam||'-'}</td>
            <td style="text-align:center;font-weight:700">${a.pertemuan||i+1}</td>
            <td style="font-size:12px">${esc(materi?.judul||'-')}</td>
            <td><span class="badge ${a.status==='hadir_siswa'?'badge-hadir':'badge-alpha'}">${a.status==='hadir_siswa'?'Hadir':'Pending'}</span></td>
            <td style="text-align:center;font-weight:700">${a.nilai??'-'}</td>
            <td style="font-size:12px">${esc(a.namaInstruktur||'-')}</td>
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
window.openModalNilai = function(siswaId,nomorPertemuan) {
  const s=siswaCacheList.find(x=>x.id===siswaId);
  if (!s) return;
  const materi=getMateriForPertemuan(s.transmisi||'Manual',Number(nomorPertemuan),s.totalPertemuan||10);
  currentNilaiData={siswaId,nomorPertemuan:Number(nomorPertemuan)};
  document.getElementById('modalNilaiInfo').textContent=`${s.nama} — Pertemuan ke-${nomorPertemuan}: ${materi?.judul||''}`;
  document.getElementById('modalNilaiAngka').value='';
  document.getElementById('modalNilaiCatatan').value='';
  openModal('modalNilai');
};

window.simpanNilai = async function() {
  const nilai=Number(document.getElementById('modalNilaiAngka').value);
  const catatan=document.getElementById('modalNilaiCatatan').value.trim();
  if (!nilai&&nilai!==0) { showToast('❌ Masukkan nilai!','error'); return; }
  const {siswaId,nomorPertemuan}=currentNilaiData;
  const s=siswaCacheList.find(x=>x.id===siswaId);
  if (!s) return;
  const todayStr=today();
  const newAbsen=(s.absen||[]).map(a=>{
    if (a.tgl===todayStr&&a.pertemuan===nomorPertemuan) {
      return {...a, nilai, catatanInstruktur:catatan, namaInstruktur:currentUser.nama};
    }
    return a;
  });
  await updateDoc(doc(db,'siswa',siswaId),{absen:newAbsen});
  showToast(`✅ Nilai ${nilai} berhasil disimpan!`);
  closeModal('modalNilai');
  renderInstrukturHariIni();
};

// ================================================================
//  SISWA: DASHBOARD LOAD
// ================================================================
function loadSiswaDashboard() {
  onSnapshot(doc(db,'siswa',currentUser.id), snap=>{
    if (!snap.exists()) { showToast('Data tidak ditemukan','error'); return; }
    const s={id:snap.id,...snap.data()};
    renderSiswaProgress(s);
    renderSiswaAbsen(s);
    renderSiswaProfil(s);
    renderSiswaRapor(s);
    renderSiswaSertifikat(s);
  });
}

// ================================================================
//  SISWA: PROGRESS
// ================================================================
function renderSiswaProgress(s) {
  const panel=document.getElementById('siswaProgressPanel');
  if (!panel) return;
  const absen=s.absen||[];
  const total=s.totalPertemuan||10;
  const selesai=absen.filter(a=>a.nilai!==undefined&&a.nilai!==null).length;
  const pct=Math.round((selesai/total)*100);

  panel.innerHTML=`
    <div style="background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow-sm);overflow:hidden;margin-bottom:16px">
      <div class="progress-header">
        <h2>${esc(s.nama)}</h2>
        <p>${esc(s.paketLabel||'-')} | ${esc(s.transmisi||'')} | ${total} Pertemuan</p>
        <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <p class="progress-pct">${selesai} dari ${total} pertemuan selesai (${pct}%)</p>
      </div>
      <div class="pertemuan-grid">
        ${Array.from({length:total},(_,i)=>{
          const no=i+1;
          const materi=getMateriForPertemuan(s.transmisi||'Manual',no,total);
          const absenItem=absen.find(a=>a.pertemuan===no);
          const sudahNilai=absenItem?.nilai!==undefined&&absenItem?.nilai!==null;
          const sudahAbsen=!!absenItem;
          const cls=sudahNilai?'selesai':sudahAbsen?'aktif':'belum';
          return `<div class="pertemuan-card ${cls}">
            <div class="pertemuan-num">Pertemuan ${no} ${sudahNilai?'✅':sudahAbsen?'🕐':'⏳'}</div>
            <div class="pertemuan-judul">${esc(materi?.judul||'-')}</div>
            <div class="pertemuan-materi">${esc(materi?.materi||'-')}</div>
            ${absenItem ? `<div style="font-size:11px;color:#9ca3af;margin-top:6px"><i class="fas fa-clock"></i> ${formatTgl(absenItem.tgl)} pukul ${absenItem.jam||'-'}</div>` : ''}
            ${sudahNilai ? `<div class="pertemuan-nilai">
              <span class="nilai-badge">Nilai: ${absenItem.nilai}</span>
              ${absenItem.namaInstruktur ? `<span class="nilai-catatan"><i class="fas fa-user-tie"></i> ${esc(absenItem.namaInstruktur)}</span>` : ''}
            </div>` : ''}
            ${absenItem?.catatanInstruktur ? `<div style="margin-top:5px;font-size:11px;font-style:italic;color:#4b5563">"${esc(absenItem.catatanInstruktur)}"</div>` : ''}
            ${sudahAbsen&&!sudahNilai ? `<div style="margin-top:6px;font-size:11px;color:#854d0e;font-weight:600"><i class="fas fa-hourglass-half"></i> Menunggu penilaian instruktur</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ================================================================
//  SISWA: ABSEN
// ================================================================
function renderSiswaAbsen(s) {
  const panel=document.getElementById('siswaAbsenPanel');
  if (!panel) return;
  const todayStr=today();
  const absen=s.absen||[];
  const total=s.totalPertemuan||10;
  const sudahAbsenHariIni=absen.some(a=>a.tgl===todayStr);
  const nomorPertemuan=absen.length+1;

  if (nomorPertemuan>total) {
    panel.innerHTML=`<div class="empty-state" style="color:#166534"><i class="fas fa-graduation-cap" style="font-size:36px;margin-bottom:8px;display:block"></i><strong>Selamat! Kamu telah menyelesaikan semua pertemuan!</strong><p style="margin-top:8px">Lihat Rapor & Sertifikat di tab di atas 🎓</p></div>`;
    return;
  }

  const materi=getMateriForPertemuan(s.transmisi||'Manual',nomorPertemuan,total);
  const jam=s.jamPerSesi||1;

  panel.innerHTML=`
    <div class="absen-hari-ini">
      <div class="absen-info">
        <h3><i class="fas fa-calendar-day"></i> ${todayLabel()}</h3>
        <p>Pertemuan ke-<strong>${nomorPertemuan}</strong> dari ${total} | Durasi: <strong>${jam} jam</strong></p>
      </div>
      <div class="absen-materi-box">
        <h4><i class="fas fa-book-open"></i> Materi Hari Ini:</h4>
        <p><strong>${esc(materi?.judul||'-')}</strong></p>
        <p style="margin-top:6px">${esc(materi?.materi||'-')}</p>
        <p style="margin-top:6px;font-size:11px;color:#2d6a4f"><i class="fas fa-clock"></i> Durasi: ${jam} jam / sesi</p>
      </div>
      <div class="absen-btn-wrap">
        ${sudahAbsenHariIni
          ? `<button class="btn-absen sudah" disabled><i class="fas fa-check-circle"></i> Sudah Absen Hari Ini — Menunggu Instruktur</button>`
          : `<button class="btn-absen" onclick="kirimAbsen('${s.id}',${nomorPertemuan})"><i class="fas fa-hand-paper"></i> Absen Hadir Sekarang</button>`}
      </div>
    </div>
    ${absen.length>0 ? `
    <div style="margin-top:16px">
      <h3 style="font-size:14px;font-weight:700;color:var(--green-dark);margin-bottom:10px"><i class="fas fa-history"></i> Riwayat Absensi</h3>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>TGL</th><th>JAM</th><th>PERTEMUAN</th><th>MATERI</th><th>NILAI</th><th>INSTRUKTUR</th></tr></thead>
          <tbody>
            ${absen.slice().reverse().map(a=>{
              const m=getMateriForPertemuan(s.transmisi||'Manual',a.pertemuan||1,total);
              return `<tr>
                <td>${formatTgl(a.tgl)}</td>
                <td>${a.jam||'-'}</td>
                <td style="text-align:center">${a.pertemuan||'-'}</td>
                <td style="font-size:12px">${esc(m?.judul||'-')}</td>
                <td style="text-align:center;font-weight:700">${a.nilai??'⏳'}</td>
                <td style="font-size:12px">${esc(a.namaInstruktur||'-')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}`;
}

window.kirimAbsen = async function(siswaId, nomorPertemuan) {
  const s=siswaCacheList.find(x=>x.id===siswaId)||{absen:[]};
  const todayStr=today();
  const jamSekarang=nowTime();
  if ((s.absen||[]).some(a=>a.tgl===todayStr)) { showToast('Sudah absen hari ini!','error'); return; }
  const newAbsen=[...(s.absen||[]),{
    tgl:todayStr, jam:jamSekarang,
    pertemuan:nomorPertemuan, status:'hadir_siswa',
    nilai:null, catatanInstruktur:null, namaInstruktur:null
  }];
  await updateDoc(doc(db,'siswa',siswaId),{absen:newAbsen});
  showToast(`✅ Absen jam ${jamSekarang} berhasil! Instruktur akan segera memberi nilai.`);
};

// ================================================================
//  SISWA: RAPOR AKHIR
// ================================================================
function renderSiswaRapor(s) {
  const panel=document.getElementById('siswaRaporPanel');
  if (!panel) return;
  const absen=s.absen||[];
  const total=s.totalPertemuan||10;
  const selesai=absen.filter(a=>a.nilai!==null&&a.nilai!==undefined);

  if (selesai.length===0) {
    panel.innerHTML=`<p class="empty-state">Rapor tersedia setelah minimal 1 pertemuan selesai dinilai instruktur.</p>`;
    return;
  }

  const nilaiAll=selesai.map(a=>Number(a.nilai));
  const rataRata=Math.round(nilaiAll.reduce((a,b)=>a+b,0)/nilaiAll.length);
  const nilaiTertinggi=Math.max(...nilaiAll);
  const nilaiTerendah=Math.min(...nilaiAll);
  const totalJam=absen.reduce((a,_)=>a+(s.jamPerSesi||1),0);
  const pct=Math.round((selesai.length/total)*100);
  const predikat=rataRata>=90?'Sangat Baik':rataRata>=80?'Baik':rataRata>=70?'Cukup':rataRata>=60?'Kurang':'Perlu Bimbingan';
  const warnaPred=rataRata>=80?'#166534':rataRata>=60?'#854d0e':'#991b1b';

  panel.innerHTML=buildRaporHTML(s)+`
    <div class="form-actions" style="margin-top:12px">
      <button class="btn-primary" onclick="window.print()"><i class="fas fa-print"></i> Cetak Rapor</button>
    </div>`;
}

function buildRaporHTML(s) {
  const absen=s.absen||[];
  const total=s.totalPertemuan||10;
  const selesai=absen.filter(a=>a.nilai!==null&&a.nilai!==undefined);
  const nilaiAll=selesai.map(a=>Number(a.nilai));
  const rataRata=nilaiAll.length?Math.round(nilaiAll.reduce((a,b)=>a+b,0)/nilaiAll.length):0;
  const nilaiTertinggi=nilaiAll.length?Math.max(...nilaiAll):0;
  const nilaiTerendah=nilaiAll.length?Math.min(...nilaiAll):0;
  const totalJam=absen.length*(s.jamPerSesi||1);
  const predikat=rataRata>=90?'Sangat Baik':rataRata>=80?'Baik':rataRata>=70?'Cukup':rataRata>=60?'Kurang':'Perlu Bimbingan';

  return `<div class="rapor-wrap">
    <div class="rapor-header">
      <p style="font-size:11px;letter-spacing:2px;opacity:.7;margin-bottom:4px">RAPOR PERKEMBANGAN BELAJAR</p>
      <h2>KURSUS MENGEMUDI DIRGANTARA JAYA</h2>
      <p>Jl. Akses UI No.75 Tugu, Cimanggis, Depok | (021) 87752889</p>
    </div>
    <div style="padding:18px;background:var(--white)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;font-size:13px">
        <div><span style="color:var(--gray-600)">Nama Siswa:</span> <strong>${esc(s.nama)}</strong></div>
        <div><span style="color:var(--gray-600)">No HP:</span> <strong>${esc(s.hp||'-')}</strong></div>
        <div><span style="color:var(--gray-600)">Paket:</span> <strong>${esc(s.paketLabel||'-')}</strong></div>
        <div><span style="color:var(--gray-600)">Transmisi:</span> <strong>${esc(s.transmisi||'-')}</strong></div>
        <div><span style="color:var(--gray-600)">Tgl Daftar:</span> <strong>${formatTgl(s.tglDaftar)}</strong></div>
        <div><span style="color:var(--gray-600)">Total Jam Belajar:</span> <strong>${totalJam} jam</strong></div>
      </div>
    </div>
    <div class="rapor-stats">
      <div class="rapor-stat"><div class="rapor-stat-val">${rataRata}</div><div class="rapor-stat-lbl">Rata-rata Nilai</div></div>
      <div class="rapor-stat"><div class="rapor-stat-val" style="color:#166534">${nilaiTertinggi||'-'}</div><div class="rapor-stat-lbl">Nilai Tertinggi</div></div>
      <div class="rapor-stat"><div class="rapor-stat-val" style="color:#991b1b">${nilaiTerendah||'-'}</div><div class="rapor-stat-lbl">Nilai Terendah</div></div>
      <div class="rapor-stat"><div class="rapor-stat-val">${selesai.length}/${total}</div><div class="rapor-stat-lbl">Pertemuan Selesai</div></div>
      <div class="rapor-stat"><div class="rapor-stat-val">${totalJam}</div><div class="rapor-stat-lbl">Total Jam</div></div>
      <div class="rapor-stat"><div class="rapor-stat-val" style="color:#1a3d2b;font-size:14px">${predikat}</div><div class="rapor-stat-lbl">Predikat</div></div>
    </div>
    <div class="table-container" style="border-radius:0">
      <table class="data-table">
        <thead><tr><th>NO</th><th>TGL</th><th>JAM</th><th>MATERI</th><th>NILAI</th><th>INSTRUKTUR</th><th>CATATAN</th></tr></thead>
        <tbody>
          ${absen.map((a,i)=>{
            const materi=getMateriForPertemuan(s.transmisi||'Manual',a.pertemuan||i+1,total);
            return `<tr>
              <td style="text-align:center">${a.pertemuan||i+1}</td>
              <td>${formatTgl(a.tgl)}</td>
              <td>${a.jam||'-'}</td>
              <td style="font-size:12px">${esc(materi?.judul||'-')}</td>
              <td style="text-align:center;font-weight:700">${a.nilai??'-'}</td>
              <td style="font-size:12px">${esc(a.namaInstruktur||'-')}</td>
              <td style="font-size:11px;font-style:italic">${esc(a.catatanInstruktur||'-')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="padding:16px 18px;text-align:right;border-top:1px solid var(--gray-100)">
      <p style="font-size:12px;color:var(--gray-600)">Depok, ${new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}</p>
      <p style="font-size:12px;color:var(--gray-600);margin-top:4px">Direktur / Pimpinan</p>
      <div style="margin:24px 0 4px;width:120px;margin-left:auto;border-bottom:1.5px solid var(--gray-800)"></div>
      <p style="font-size:12px;font-weight:700">Gelar Dirgantara S.IIP M.Kom</p>
    </div>
  </div>`;
}

// ================================================================
//  SISWA: SERTIFIKAT
// ================================================================
function renderSiswaSertifikat(s) {
  const panel=document.getElementById('siswaSertifikatPanel');
  if (!panel) return;
  const absen=s.absen||[];
  const total=s.totalPertemuan||10;
  const selesai=absen.filter(a=>a.nilai!==null&&a.nilai!==undefined);
  const nilaiAll=selesai.map(a=>Number(a.nilai));
  const rataRata=nilaiAll.length?Math.round(nilaiAll.reduce((a,b)=>a+b,0)/nilaiAll.length):0;
  const lulus=selesai.length===total&&rataRata>=60;

  if (!lulus) {
    const sisa=total-selesai.length;
    panel.innerHTML=`<div class="empty-state">
      <i class="fas fa-certificate" style="font-size:36px;margin-bottom:8px;display:block;color:#9ca3af"></i>
      <strong>Sertifikat belum tersedia</strong>
      <p style="margin-top:8px;font-size:13px">Selesaikan semua ${total} pertemuan dan dapatkan nilai ≥60 di semua pertemuan.</p>
      <p style="margin-top:4px;font-size:12px;color:#9ca3af">Sisa: ${sisa} pertemuan lagi</p>
    </div>`;
    return;
  }

  panel.innerHTML=`
    <div style="background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow-sm);padding:18px;margin-bottom:14px">
      <p style="font-size:13px;color:var(--gray-600);margin-bottom:14px"><i class="fas fa-info-circle"></i> Sertifikat sudah bisa diunduh! Klik tombol di bawah untuk download PNG.</p>
      <div id="sertifikatPreview" style="border:2px solid var(--green-dark);border-radius:8px;overflow:hidden;margin-bottom:14px"></div>
      <canvas id="sertifikatCanvas" style="display:none"></canvas>
      <button class="btn-primary" onclick="downloadSertifikat('${s.id}')">
        <i class="fas fa-download"></i> Download Sertifikat PNG
      </button>
    </div>`;

  setTimeout(()=>generateSertifikat(s, rataRata), 200);
}

window.generateSertifikat = function(s, rataRata) {
  const canvas=document.getElementById('sertifikatCanvas');
  if (!canvas) return;
  const W=1200, H=850;
  canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d');

  // Background gradient
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#f5f9f5');
  bg.addColorStop(1,'#e8f5ee');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  // Border outer
  ctx.strokeStyle='#1a3d2b'; ctx.lineWidth=12;
  ctx.strokeRect(20,20,W-40,H-40);
  // Border inner
  ctx.strokeStyle='#f5b800'; ctx.lineWidth=4;
  ctx.strokeRect(34,34,W-68,H-68);

  // Header bg
  ctx.fillStyle='#1a3d2b';
  ctx.fillRect(20,20,W-40,130);

  // Title
  ctx.fillStyle='#f5b800';
  ctx.font='bold 28px serif';
  ctx.textAlign='center';
  ctx.fillText('KURSUS MENGEMUDI DIRGANTARA JAYA',W/2,75);

  ctx.fillStyle='rgba(255,255,255,0.8)';
  ctx.font='14px sans-serif';
  ctx.fillText('Jl. Akses UI No.75 Tugu, Cimanggis, Depok  |  (021) 87752889',W/2,105);
  ctx.fillText('Ijin DISNAKERSOS NO. 563/458/Laptenta/07',W/2,128);

  // SERTIFIKAT text
  ctx.fillStyle='#1a3d2b';
  ctx.font='bold 48px serif';
  ctx.letterSpacing='8px';
  ctx.fillText('SERTIFIKAT KELULUSAN',W/2,230);

  // Decorative line
  ctx.strokeStyle='#f5b800'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(200,250); ctx.lineTo(W-200,250); ctx.stroke();

  // Subtitle
  ctx.fillStyle='#4b5563';
  ctx.font='16px sans-serif';
  ctx.fillText('Diberikan kepada:',W/2,295);

  // Nama
  ctx.fillStyle='#1a3d2b';
  ctx.font='bold 52px serif';
  ctx.fillText(s.nama,W/2,370);

  // Underline nama
  ctx.strokeStyle='#1a3d2b'; ctx.lineWidth=2;
  const namaW=ctx.measureText(s.nama).width;
  ctx.beginPath(); ctx.moveTo(W/2-namaW/2,382); ctx.lineTo(W/2+namaW/2,382); ctx.stroke();

  // Body text
  ctx.fillStyle='#374151';
  ctx.font='17px sans-serif';
  const absen=s.absen||[];
  const totalJam=absen.length*(s.jamPerSesi||1);
  ctx.fillText(`Telah berhasil menyelesaikan program kursus mengemudi`,W/2,430);
  ctx.fillText(`${s.paketLabel||''}  |  Transmisi: ${s.transmisi||''}`,W/2,462);
  ctx.fillText(`${s.totalPertemuan} Pertemuan  |  Total ${totalJam} Jam Belajar`,W/2,494);

  // Nilai box
  ctx.fillStyle='#1a3d2b';
  ctx.roundRect(W/2-80,518,160,64,10);
  ctx.fill();
  ctx.fillStyle='#f5b800';
  ctx.font='bold 32px sans-serif';
  ctx.fillText(`${rataRata}`,W/2,554);
  ctx.font='12px sans-serif';
  ctx.fillStyle='rgba(255,255,255,0.8)';
  ctx.fillText('NILAI AKHIR',W/2,572);

  // Tanggal
  ctx.fillStyle='#4b5563';
  ctx.font='15px sans-serif';
  const tglLulus=new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
  ctx.fillText(`Depok, ${tglLulus}`,W/2,640);

  // Stempel bulat
  const cx=W/2, cy=710, r=65;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.strokeStyle='#1a3d2b'; ctx.lineWidth=4; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx,cy,r-8,0,Math.PI*2);
  ctx.strokeStyle='#f5b800'; ctx.lineWidth=2; ctx.stroke();

  ctx.save();
  ctx.translate(cx,cy);
  ctx.fillStyle='#1a3d2b';
  ctx.font='bold 11px sans-serif';
  ctx.textAlign='center';
  ctx.fillText('DIRGANTARA',0,-14);
  ctx.fillText('JAYA',0,2);
  ctx.font='9px sans-serif';
  ctx.fillStyle='#2d6a4f';
  ctx.fillText('KURSUS MENGEMUDI',0,16);
  ctx.restore();

  // TTD
  ctx.fillStyle='#374151';
  ctx.font='13px sans-serif';
  ctx.fillText('Direktur / Pimpinan',W/2,795);
  ctx.font='bold 15px sans-serif';
  ctx.fillStyle='#1a3d2b';
  ctx.fillText('Gelar Dirgantara S.IIP M.Kom',W/2,818);

  // Line TTD
  ctx.strokeStyle='#1a3d2b'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(W/2-110,786); ctx.lineTo(W/2+110,786); ctx.stroke();

  // Preview
  const preview=document.getElementById('sertifikatPreview');
  if (preview) {
    const img=document.createElement('img');
    img.src=canvas.toDataURL('image/png');
    img.style.width='100%';
    preview.innerHTML='';
    preview.appendChild(img);
  }
};

window.downloadSertifikat = function(id) {
  const s=siswaCacheList.find(x=>x.id===id)||{id,nama:'Siswa'};
  const canvas=document.getElementById('sertifikatCanvas');
  if (!canvas) return;
  const link=document.createElement('a');
  link.download=`Sertifikat_${s.nama.replace(/\s+/g,'_')}_DirgantaraJaya.png`;
  link.href=canvas.toDataURL('image/png');
  link.click();
  showToast('✅ Sertifikat berhasil didownload!');
};

// ================================================================
//  SISWA: PROFIL
// ================================================================
function renderSiswaProfil(s) {
  const panel=document.getElementById('siswaProfilPanel');
  if (!panel) return;
  const sisa=Math.max(0,Number(s.biaya||0)-Number(s.terbayar||0));
  const prog=s.absen?.length||0;
  const totalJam=prog*(s.jamPerSesi||1);
  panel.innerHTML=`
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
        <div class="profil-row"><span>Total Jam Belajar</span><span style="color:var(--green-dark);font-weight:800">${totalJam} jam</span></div>
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
  ['instrukturPilihSiswa'].forEach(id=>{
    const el=document.getElementById(id);
    if (!el) return;
    const val=el.value;
    el.innerHTML=`<option value="">-- Pilih Siswa --</option>`+
      siswaCacheList.map(s=>`<option value="${s.id}" ${s.id===val?'selected':''}>${esc(s.nama)} — ${esc(s.paketLabel||'-')}</option>`).join('');
  });
}

// ================================================================
//  FILTER
// ================================================================
window.filterTable = function(type,val) {
  const lower=val.toLowerCase();
  const filtered=siswaCacheList.filter(s=>s.nama?.toLowerCase().includes(lower)||s.hp?.toLowerCase().includes(lower));
  if (type==='keuangan') renderKeuanganTable(filtered);
  if (type==='biodata') renderBiodataTable(filtered);
};

// ================================================================
//  NAVIGATION
// ================================================================
window.switchTab = function(sectionId,btn) {
  document.querySelectorAll('.content-section').forEach(s=>s.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(sectionId)?.classList.remove('hidden');
  btn?.classList.add('active');
};

window.showSubTab = function(parentId,subKey,btn) {
  const parent=document.getElementById(parentId);
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
window.openModal = id=>document.getElementById(id).classList.remove('hidden');
window.closeModal = id=>document.getElementById(id).classList.add('hidden');

// ================================================================
//  TOAST
// ================================================================
let toastTimer;
function showToast(msg,type='success') {
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast'+(type==='error'?' error':'');
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.add('hidden'),3500);
}

// ================================================================
//  HELPERS
// ================================================================
function formatRp(n) { return 'Rp '+Number(n||0).toLocaleString('id-ID'); }
function formatRpShort(n) {
  if (n>=1000000) return 'Rp '+(n/1000000).toFixed(1)+'jt';
  if (n>=1000) return 'Rp '+(n/1000).toFixed(0)+'rb';
  return 'Rp '+n;
}
function formatTgl(str) {
  if (!str) return '-';
  try { return new Date(str).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }
  catch { return str; }
}
function formatBulan(d) { return d.toLocaleDateString('id-ID',{month:'long',year:'numeric'}); }
function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function capitalize(s) { return s.charAt(0).toUpperCase()+s.slice(1); }
function showMsg(el,type,msg) {
  el.textContent=msg; el.className=`form-msg ${type}`; el.classList.remove('hidden');
  setTimeout(()=>el.classList.add('hidden'),5000);
}

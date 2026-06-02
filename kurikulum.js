// kurikulum.js - Data kurikulum lengkap Dirgantara Jaya
// Harga update per Juni 2026 (brosur terbaru)

export const BIAYA_PENDAFTARAN = 30000; // Rp 30.000

export const PAKET_LIST = {
  // ── REGULER ──
  "Manual-7x":  { label:"7x Pertemuan - Manual (Sigra/Rocky)",  transmisi:"Manual", pertemuan:7,  harga:630000,  jamPerSesi:1, isRental:false },
  "Manual-8x":  { label:"8x Pertemuan - Manual (Sigra/Rocky)",  transmisi:"Manual", pertemuan:8,  harga:720000,  jamPerSesi:1, isRental:false },
  "Manual-9x":  { label:"9x Pertemuan - Manual (Sigra/Rocky)",  transmisi:"Manual", pertemuan:9,  harga:790000,  jamPerSesi:1, isRental:false },
  "Manual-10x": { label:"10x Pertemuan - Manual (Sigra/Rocky)", transmisi:"Manual", pertemuan:10, harga:850000,  jamPerSesi:1, isRental:false },
  "Matic-7x":   { label:"7x Pertemuan - Matic (Sigra AT)",       transmisi:"Matic",  pertemuan:7,  harga:730000,  jamPerSesi:1, isRental:false },
  "Matic-8x":   { label:"8x Pertemuan - Matic (Sigra AT)",       transmisi:"Matic",  pertemuan:8,  harga:800000,  jamPerSesi:1, isRental:false },
  "Matic-9x":   { label:"9x Pertemuan - Matic (Sigra AT)",       transmisi:"Matic",  pertemuan:9,  harga:880000,  jamPerSesi:1, isRental:false },
  "Matic-10x":  { label:"10x Pertemuan - Matic (Sigra AT)",      transmisi:"Matic",  pertemuan:10, harga:930000,  jamPerSesi:1, isRental:false },
  // ── KHUSUS ──
  "Manual-Trampil":    { label:"Trampil 1 (20x) - Manual",    transmisi:"Manual", pertemuan:20, harga:1640000, jamPerSesi:1, catatanKhusus:"Bisa ambil 2 pertemuan/hari", isRental:false },
  "Matic-Trampil":     { label:"Trampil 1 (20x) - Matic",     transmisi:"Matic",  pertemuan:20, harga:1790000, jamPerSesi:1, catatanKhusus:"Bisa ambil 2 pertemuan/hari", isRental:false },
  "Manual-Melancarkan":{ label:"Melancarkan (4x) - Manual",   transmisi:"Manual", pertemuan:4,  harga:410000,  jamPerSesi:1, isRental:false },
  "Matic-Melancarkan": { label:"Melancarkan (4x) - Matic",    transmisi:"Matic",  pertemuan:4,  harga:530000,  jamPerSesi:1, isRental:false },
  "Manual-Rental":     { label:"Rental (1x) - Manual",        transmisi:"Manual", pertemuan:1,  harga:130000,  jamPerSesi:1, isRental:true  },
  "Matic-Rental":      { label:"Rental (1x) - Matic",         transmisi:"Matic",  pertemuan:1,  harga:145000,  jamPerSesi:1, isRental:true  },
};

/**
 * Hitung biaya pendaftaran berdasarkan aturan:
 * - Rental → selalu Rp 30.000
 * - Cicilan (dp < harga) → Rp 30.000
 * - Lunas (dp >= harga) → GRATIS (Rp 0)
 */
export function hitungBiayaDaftar(paketKey, dp) {
  const paket = PAKET_LIST[paketKey];
  if (!paket) return 0;
  if (paket.isRental) return BIAYA_PENDAFTARAN;       // Rental selalu kena
  if (dp >= paket.harga) return 0;                    // Lunas → gratis
  return BIAYA_PENDAFTARAN;                            // Cicilan → kena
}

// ── KURIKULUM MANUAL ──
export const KURIKULUM_MANUAL = [
  { no:1,  judul:"Pengenalan Instrumen Kendaraan Manual",   durasi:"1 jam", materi:"Nama & fungsi dashboard, speedometer, RPM, indikator suhu & BBM. Fungsi pedal gas, rem, kopling. Posisi tuas persneling, spion, lampu, wiper, hazard, klakson." },
  { no:2,  judul:"Posisi Duduk & Teknik Dasar Kopling",     durasi:"1 jam", materi:"Posisi duduk ideal, jarak ke pedal, pegangan setir 9-3. Teknik mengangkat kopling perlahan (titik gigit). Latihan jalan lurus tanpa mesin mati di area latihan." },
  { no:3,  judul:"Transmisi Manual & Perpindahan Gigi",     durasi:"1 jam", materi:"Pola gigi 1-2-3-4-5-R. Kapan naik/turun gigi berdasarkan kecepatan & RPM. Teknik double clutch. Latihan perpindahan gigi berulang hingga natural." },
  { no:4,  judul:"Akselerasi, Pengereman & Berhenti",       durasi:"1 jam", materi:"Akselerasi halus dari gigi 1, teknik pengereman bertahap, berhenti sempurna tanpa mesin mati. Berhenti di lampu merah dengan kopling." },
  { no:5,  judul:"Teknik Berbelok & Manuver Tikungan",      durasi:"1 jam", materi:"Belok kiri & kanan di persimpangan. Memperkirakan radius belok, kecepatan menikung, teknik counter-steering. Latihan pertigaan & perempatan." },
  { no:6,  judul:"Jalan Sempit & Manuver Terbatas",         durasi:"1 jam", materi:"Melewati jalan sempit 2 arah, teknik berpapasan, menggunakan spion aktif. Latihan lorong sempit dengan cone/marka." },
  { no:7,  judul:"Teknik Menanjak & Turunan",               durasi:"1 jam", materi:"Berhenti & jalan di tanjakan (rem tangan + kopling). Anti mundur di tanjakan. Engine brake di turunan panjang. Latihan di tanjakan nyata." },
  { no:8,  judul:"Teknik Menyalip Kendaraan",               durasi:"1 jam", materi:"Membaca situasi & jarak aman. Memberi tanda dengan sein & klakson. Akselerasi saat menyalip, kembali ke jalur. Etika & hukum menyalip." },
  { no:9,  judul:"Parkir Paralel — Sesi 1",                 durasi:"1 jam", materi:"Teori estimasi jarak & sudut masuk. Teknik mundur masuk slot paralel step-by-step. Latihan berulang dengan panduan cone." },
  { no:10, judul:"Parkir Paralel & Seri — Sesi 2",          durasi:"1 jam", materi:"Lanjutan parkir paralel hingga mandiri. Pengenalan parkir seri (maju & mundur di slot tegak lurus). Parkir di ruang sempit." },
  { no:11, judul:"Etika Berkendara & Keselamatan Jalan",    durasi:"1 jam", materi:"Prioritas di persimpangan, memberi jalan pejalan kaki, etika di lampu merah, aturan jalur, berkendara malam/hujan/kabut." },
  { no:12, judul:"Berkendara di Lalu Lintas Nyata",         durasi:"1 jam", materi:"Praktik di jalan umum dengan instruktur: persimpangan ramai, jalan arteri, U-turn, putar balik, menghadapi angkutan umum & motor." },
  { no:13, judul:"Teknik Darurat & Defensive Driving",      durasi:"1 jam", materi:"Rem mendadak (ABS & non-ABS), menghindari objek tiba-tiba, aquaplaning, ban bocor saat jalan. Posisi kendaraan saat mogok di jalan." },
  { no:14, judul:"Pemahaman Rambu & Marka Jalan",           durasi:"1 jam", materi:"Review lengkap rambu perintah, larangan, peringatan, petunjuk. Marka jalan: garis putus, penuh, zebra cross, kotak kuning." },
  { no:15, judul:"Review Materi & Persiapan Ujian",         durasi:"1 jam", materi:"Simulasi berkendara mandiri: instruktur hanya mengamati. Identifikasi kelemahan & koreksi terakhir sebelum ujian." },
  { no:16, judul:"Ujian Akhir & Sertifikasi",               durasi:"1 jam", materi:"Ujian praktik menyeluruh: instrumen, tanjakan, parkir, lalu lintas, etika. Penilaian komprehensif. Sertifikat kelulusan Dirgantara Jaya." },
];

export const KURIKULUM_MATIC = [
  { no:1,  judul:"Pengenalan Instrumen Kendaraan Matic",    durasi:"1 jam", materi:"Semua instrumen dashboard. Perbedaan matic vs manual. Fungsi tuas D/N/R/P/L/S. Tidak ada pedal kopling — fokus gas & rem. Posisi duduk ideal." },
  { no:2,  judul:"Posisi Duduk & Jalan Pertama",            durasi:"1 jam", materi:"Posisi ideal, teknik gas & rem halus, jalan lurus di area latihan. Latihan berhenti tepat di garis. Menghindari rem mendadak." },
  { no:3,  judul:"Kontrol Kecepatan & Akselerasi Matic",    durasi:"1 jam", materi:"Akselerasi bertahap tanpa gigi manual. Teknik pengereman mulus. Berhenti sempurna. Memahami efek creep mode saat jalan pelan." },
  { no:4,  judul:"Manuver Tuas D/N/R & Perpindahan Mode",  durasi:"1 jam", materi:"Kapan pakai D, N, R, P. Mode L/S untuk engine brake. Teknik pindah tuas dengan aman. Latihan maju-mundur berulang." },
  { no:5,  judul:"Teknik Berbelok & Manuver Tikungan",      durasi:"1 jam", materi:"Belok kiri & kanan di persimpangan. Memperkirakan radius belok, kecepatan menikung. Latihan di pertigaan & perempatan." },
  { no:6,  judul:"Jalan Sempit & Manuver Terbatas",         durasi:"1 jam", materi:"Melewati jalan sempit 2 arah, teknik berpapasan, menggunakan spion aktif. Latihan lorong sempit." },
  { no:7,  judul:"Teknik Menanjak & Turunan",               durasi:"1 jam", materi:"Teknik rem tangan di tanjakan matic. Creep mode untuk naik tanjakan perlahan. Mode L/S untuk engine brake di turunan panjang." },
  { no:8,  judul:"Teknik Menyalip Kendaraan",               durasi:"1 jam", materi:"Membaca situasi & jarak aman. Memberi tanda, akselerasi kick-down matic, kembali ke jalur. Etika menyalip." },
  { no:9,  judul:"Parkir Paralel — Sesi 1",                 durasi:"1 jam", materi:"Teori estimasi jarak & sudut masuk. Teknik mundur masuk slot paralel dengan panduan spion. Latihan berulang dengan cone." },
  { no:10, judul:"Parkir Paralel & Seri — Sesi 2",          durasi:"1 jam", materi:"Lanjutan parkir paralel hingga mandiri. Parkir seri maju & mundur. Parkir di basement/ruang sempit." },
  { no:11, judul:"Etika Berkendara & Keselamatan Jalan",    durasi:"1 jam", materi:"Prioritas persimpangan, memberi jalan pejalan kaki, etika lampu merah, aturan jalur, berkendara malam/hujan." },
  { no:12, judul:"Berkendara di Lalu Lintas Nyata",         durasi:"1 jam", materi:"Praktik di jalan umum: persimpangan ramai, jalan arteri, U-turn, menghadapi angkutan umum & motor." },
  { no:13, judul:"Teknik Darurat & Defensive Driving",      durasi:"1 jam", materi:"Rem mendadak, menghindari objek tiba-tiba, aquaplaning, ban bocor. Posisi kendaraan saat mogok di jalan." },
  { no:14, judul:"Pemahaman Rambu & Marka Jalan",           durasi:"1 jam", materi:"Review rambu perintah/larangan/peringatan/petunjuk. Marka jalan: garis putus, penuh, zebra cross." },
  { no:15, judul:"Review Materi & Persiapan Ujian",         durasi:"1 jam", materi:"Simulasi berkendara mandiri, instruktur hanya mengamati. Identifikasi kelemahan & koreksi terakhir." },
  { no:16, judul:"Ujian Akhir & Sertifikasi",               durasi:"1 jam", materi:"Ujian praktik menyeluruh. Penilaian komprehensif. Sertifikat kelulusan Dirgantara Jaya." },
];

export function getKurikulum(transmisi) {
  return transmisi === 'Manual' ? KURIKULUM_MANUAL : KURIKULUM_MATIC;
}

export function getMateriForPertemuan(transmisi, nomorPertemuan, totalPertemuan) {
  const all = getKurikulum(transmisi);
  if (totalPertemuan >= 16) return all[nomorPertemuan - 1] || all[all.length-1];
  const prioritas = totalPertemuan <= 1
    ? [0]
    : totalPertemuan <= 4
    ? [0,1,4,6]
    : totalPertemuan <= 7
    ? [0,1,2,3,4,6,7]
    : totalPertemuan <= 8
    ? [0,1,2,3,4,6,7,8]
    : totalPertemuan <= 9
    ? [0,1,2,3,4,6,7,8,9]
    : [0,1,2,3,4,5,6,7,8,9];
  const idx = prioritas[nomorPertemuan-1] ?? (nomorPertemuan-1);
  return all[idx] || all[all.length-1];
}

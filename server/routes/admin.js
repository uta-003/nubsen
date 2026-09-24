import { Router } from 'express'
import { getJadwalGlobal, setSetting, getPerusahaan, MODE_JADWAL, SHIFT_DEFAULT } from '../db.js'
import {
  ringkasanAdmin,
  trenKehadiran,
  listKaryawan, buatKaryawan, ubahKaryawan, hapusKaryawan,
  listSemuaAbsensi, ubahAbsensi, hapusAbsensi, fotoAbsensi,
  listSemuaIzin, setStatusIzin, hapusIzin, lampiranIzin,
  listSemuaLembur, setStatusLembur, hapusLembur,
  listSemuaPiket, setStatusPiket, hapusPiket, biayaPiket, setBiayaPiket,
  listSemuaPeringatan, buatPeringatan, hapusPeringatan, listRiwayatPeringatan,
  laporanKehadiran, laporanGaji,
  listHariLibur, tambahHariLibur, hapusHariLibur,
  listPeriodeGaji, tetapkanPeriodeGaji, aktifkanPeriodeGaji, hapusPeriodeGaji, rapikanPeriodeGaji,
  STATUS_KARYAWAN, statusKaryawanSah,
  notifToClient, kirimNotifikasi, listSemuaNotifikasi, hapusNotifikasi,
  kirimPengumuman, ubahPengumuman, hapusPengumuman,
} from '../models.js'
import { periksaKonsistensi, rapikanKonsistensi, MODE_RAPIKAN } from '../konsistensi.js'
import { wrap } from '../utils/wrap.js'
import { sinkronkanRiwayatPeringatan, lengkapiNomorSuratLama } from '../models.js'

// 'pengumuman' | 'penting' | 'info' | 'jadwal' = kategori PENGUMUMAN (kabar
// perusahaan, tampil di menu 📢 Pengumuman). Sisanya = NOTIFIKASI personal
// (alert transaksional, tampil di menu 🔔 Notifikasi).
const JENIS_VALID = ['pengumuman', 'penting', 'info', 'jadwal', 'lembur', 'piket', 'izin', 'absensi', 'gaji']

// Status kepegawaian dikirim admin pada form Karyawan: hanya dua nilai yang sah.
// Nilai kosong dianggap tidak diubah; nilai asing ditolak 400 agar tidak senyap.
function validasiStatusKaryawan(nilai) {
  if (nilai === undefined || nilai === null || String(nilai).trim() === '') return { ok: true }
  const teks = String(nilai).trim()
  if (STATUS_KARYAWAN.some((s) => s.toLowerCase() === teks.toLowerCase())) return { ok: true, nilai: statusKaryawanSah(teks) }
  return { ok: false, pesan: `Status karyawan harus salah satu dari: ${STATUS_KARYAWAN.join(', ')}.` }
}

// Untuk menyebut hari kerja dalam pesan notifikasi perubahan jadwal.
const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

const router = Router()

// GET /api/admin/overview — ringkasan angka untuk dasbor admin
router.get('/overview', wrap(async (_req, res) => {
  res.json({ data: await ringkasanAdmin() })
}))

// ---------- Identitas perusahaan (KOP surat peringatan/pemecatan) ----------
router.get('/perusahaan', wrap(async (_req, res) => {
  res.json({ data: await getPerusahaan() })
}))

router.put('/perusahaan', wrap(async (req, res) => {
  const nama = String(req.body?.nama || '').trim()
  const alamat = String(req.body?.alamat || '').trim()
  if (nama.length < 2 || nama.length > 80) {
    return res.status(400).json({ error: 'Nama perusahaan wajib 2–80 karakter.' })
  }
  if (alamat.length > 140) {
    return res.status(400).json({ error: 'Alamat perusahaan maksimal 140 karakter.' })
  }
  await setSetting('perusahaanNama', nama)
  if (alamat) await setSetting('perusahaanAlamat', alamat)
  res.json({ data: await getPerusahaan() })
}))

// ---------- Tren kehadiran 7 hari terakhir (grafik Ringkasan) ----------
router.get('/tren', wrap(async (_req, res) => {
  res.json({ data: await trenKehadiran(7) })
}))

// ---------- Jadwal kerja (DUA MODE: biasa & shift 2 giliran) ----------
router.get('/jadwal', wrap(async (_req, res) => {
  res.json({ data: await getJadwalGlobal() })
}))

// Pola jam HH:MM dipakai bersama semua validasi jadwal.
const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/

// Validasi konfigurasi satu shift kiriman admin. Field yang dikosongkan memakai
// bawaan SHIFT_DEFAULT; format jam wajib HH:MM (ditolak 400 bila salah).
function validasiShift(nomor, data) {
  const def = SHIFT_DEFAULT[nomor]
  const src = data && typeof data === 'object' ? data : {}
  const ambil = (v, d) => (v == null || String(v).trim() === '' ? d : String(v).trim())
  const masuk = ambil(src.masuk, def.masuk)
  const batas = ambil(src.batas, def.batas)
  const pulang = ambil(src.pulang, def.pulang)
  for (const [label, nilai] of [['jam masuk', masuk], ['batas terlambat', batas], ['jam pulang', pulang]]) {
    if (!POLA_JAM.test(nilai)) {
      return { ok: false, pesan: `Shift ${nomor}: ${label} harus format HH:MM (contoh 07:00).` }
    }
  }
  return { ok: true, nilai: { nama: ambil(src.nama, def.nama), masuk, batas, pulang } }
}

// PUT /api/admin/jadwal — simpan pengaturan jadwal kerja.
//   mode    : 'biasa' (satu jadwal) | 'shift' (dua giliran, shift per karyawan)
//   biasa   : jamMasukBatas, jamPulang, hariKerja
//   shift   : shift1 & shift2 → { nama, masuk, batas, pulang }
// Bila ada yang benar-benar berubah, SEMUA karyawan menerima notifikasi broadcast
// (employee_id NULL, jenis 'jadwal') agar tidak kaget oleh perubahan jam kerja.
router.put('/jadwal', wrap(async (req, res) => {
  const { mode, jamMasukBatas, jamPulang, hariKerja, shift1, shift2 } = req.body || {}
  const lama = await getJadwalGlobal()
  let modeBaru = null
  if (mode !== undefined && mode !== null && String(mode).trim() !== '') {
    modeBaru = String(mode).trim().toLowerCase()
    if (!MODE_JADWAL.includes(modeBaru)) {
      return res.status(400).json({ error: "Mode jadwal harus 'biasa' atau 'shift'." })
    }
  }
  const modeAkhir = modeBaru ?? lama.mode
  // Jam kantor (mode biasa) BOLEH kosong saat mode shift — admin tidak
  // mengisinya; nilai lama dipertahankan. Namun bila diisi, format wajib sah.
  const isiMasuk = String(jamMasukBatas ?? '').trim()
  const isiPulang = String(jamPulang ?? '').trim()
  if (modeAkhir === 'biasa' && (!POLA_JAM.test(isiMasuk) || !POLA_JAM.test(isiPulang))) {
    return res.status(400).json({ error: 'Format jam harus HH:MM (contoh 08:15).' })
  }
  if (isiMasuk && !POLA_JAM.test(isiMasuk)) return res.status(400).json({ error: 'Format jam harus HH:MM (contoh 08:15).' })
  if (isiPulang && !POLA_JAM.test(isiPulang)) return res.status(400).json({ error: 'Format jam harus HH:MM (contoh 08:15).' })
  // `hariKerja` opsional: array angka 0 (Minggu) … 6 (Sabtu), minimal satu hari.
  let hariBaru = null
  if (hariKerja !== undefined) {
    if (!Array.isArray(hariKerja) || hariKerja.length === 0) {
      return res.status(400).json({ error: 'Hari kerja harus berisi minimal satu hari.' })
    }
    hariBaru = [...new Set(hariKerja.map(Number))].sort((a, b) => a - b)
    if (hariBaru.some((n) => !Number.isInteger(n) || n < 0 || n > 6)) {
      return res.status(400).json({ error: 'Hari kerja harus angka 0 (Minggu) sampai 6 (Sabtu).' })
    }
    await setSetting('hariKerja', hariBaru.join(','))
  }
  // Konfigurasi kedua shift (hanya bila dikirim admin).
  let shiftBaru = null
  if (shift1 !== undefined || shift2 !== undefined) {
    const s1 = validasiShift(1, shift1 ?? lama.shift1)
    if (!s1.ok) return res.status(400).json({ error: s1.pesan })
    const s2 = validasiShift(2, shift2 ?? lama.shift2)
    if (!s2.ok) return res.status(400).json({ error: s2.pesan })
    shiftBaru = { 1: s1.nilai, 2: s2.nilai }
    await setSetting('shift1', JSON.stringify(s1.nilai))
    await setSetting('shift2', JSON.stringify(s2.nilai))
  }
  if (modeBaru !== null) await setSetting('jadwalMode', modeBaru)
  // Kosong = tidak diubah (dipakai saat mode shift tanpa jam kantor).
  if (isiMasuk) await setSetting('jamMasukBatas', isiMasuk)
  if (isiPulang) await setSetting('jamPulang', isiPulang)

  // Notifikasi hanya bila ada yang berubah (hemat kotak masuk dari klik tanpa edit).
  const shifts = shiftBaru || { 1: lama.shift1, 2: lama.shift2 }
  const intiShift = (s) => ({ nama: s.nama, masuk: s.masuk, batas: s.batas, pulang: s.pulang })
  const berubah = Boolean(
    (modeBaru !== null && modeBaru !== lama.mode) ||
    (isiMasuk && lama.jamMasukBatas !== isiMasuk) ||
    (isiPulang && lama.jamPulang !== isiPulang) ||
    (hariBaru && hariBaru.join(',') !== (lama.hariKerja || []).join(',')) ||
    (shiftBaru && (
      JSON.stringify(shiftBaru[1]) !== JSON.stringify(intiShift(lama.shift1)) ||
      JSON.stringify(shiftBaru[2]) !== JSON.stringify(intiShift(lama.shift2))
    )),
  )
  if (berubah) {
    const hariStr = hariBaru ? `, hari kerja ${hariBaru.map((n) => NAMA_HARI[n]).join(', ')}` : ''
    await kirimNotifikasi({
      employeeId: null,
      judul: modeAkhir === 'shift' ? '🔄 Jadwal shift diperbarui' : '📅 Jadwal kerja diperbarui',
      pesan: modeAkhir === 'shift'
        ? `Jadwal SHIFT berlaku — ${shifts[1].nama}: batas ${shifts[1].batas}, pulang ${shifts[1].pulang}; ${shifts[2].nama}: batas ${shifts[2].batas}, pulang ${shifts[2].pulang}${hariStr}. Cek shift-mu di Beranda.`
        : `Jadwal baru — batas masuk ${isiMasuk || lama.jamMasukBatas}, jam pulang ${isiPulang || lama.jamPulang}${hariStr}. Sesuaikan absensimu ya.`,
      jenis: 'jadwal',
    })
  }
  // `notifikasiDikirim` ditaruh DI DALAM data karena klien (src/api.js) hanya
  // meneruskan `json.data` — dipakai panel admin untuk memberi tahu bahwa
  // broadcast sudah terkirim (atau tidak ada perubahan sehingga tidak ada notif).
  res.json({ data: { ...(await getJadwalGlobal()), notifikasiDikirim: berubah } })
}))

// ---------- Hari libur (nasional/cuti bersama + khusus dari admin) ----------
// Hari terdaftar tidak dihitung hari kerja (laporan & gaji), tidak Alpha otomatis,
// dan absensi di hari itu masuk kategori "Hadir Libur". Perubahan menyebar ke
// seluruh karyawan lewat notifikasi broadcast (baris employee_id NULL).
router.get('/libur', wrap(async (req, res) => {
  res.json({ data: await listHariLibur({ tahun: req.query.tahun }) })
}))

router.post('/libur', wrap(async (req, res) => {
  const { tanggal, nama } = req.body || {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tanggal || ''))) {
    return res.status(400).json({ error: 'Tanggal harus format YYYY-MM-DD.' })
  }
  const teks = String(nama || '').trim()
  if (teks.length < 3 || teks.length > 80) {
    return res.status(400).json({ error: 'Nama libur wajib 3–80 karakter.' })
  }
  const data = await tambahHariLibur(tanggal, teks)
  await kirimNotifikasi({
    employeeId: null,
    judul: '🌴 Hari libur ditetapkan',
    pesan: `${tanggal} ditetapkan libur — ${teks}. Tidak perlu absen masuk & pulang di hari itu.`,
    jenis: 'jadwal',
  })
  res.status(201).json({ data })
}))

router.delete('/libur/:tanggal', wrap(async (req, res) => {
  const hilang = await hapusHariLibur(req.params.tanggal)
  if (!hilang) return res.status(404).json({ error: 'Tanggal libur tidak ditemukan.' })
  await kirimNotifikasi({
    employeeId: null,
    judul: '📅 Hari libur dibatalkan',
    pesan: `${req.params.tanggal} tidak lagi ditetapkan sebagai hari libur — absensi berjalan normal.`,
    jenis: 'jadwal',
  })
  res.json({ data: { ok: true } })
}))

// ---------- Surat peringatan (SP1–SP3) & pemecatan ----------
// GET /api/admin/peringatan?employeeId=3 — daftar surat (nama ikut).
router.get('/peringatan', wrap(async (req, res) => {
  // Pastikan surat lama tanpa nomor ikut terisi sebelum daftar dikirim
  // (dipakai kartu "Surat Peringatan & Pemecatan" di aplikasi karyawan).
  await lengkapiNomorSuratLama()
  res.json({ data: await listSemuaPeringatan({ employeeId: req.query.employeeId }) })
}))

// GET /api/admin/peringatan/riwayat — RIWAYAT (jejak audit) penerbitan & pencabutan
// surat, TERMASUK surat yang sudah dicabut/dihapus atau karyawan yang sudah dihapus.
// Sinkron dulu warnings → warning_log supaya surat yang terbit saat server
// masih memakai kode lama pasti ikut muncul di sini.
// Filter opsional: employeeId, jenis, aksi, dari, sampai (tanggal surat).
router.get('/peringatan/riwayat', wrap(async (req, res) => {
  await sinkronkanRiwayatPeringatan()
  await lengkapiNomorSuratLama()
  res.json({
    data: await listRiwayatPeringatan({
      employeeId: req.query.employeeId,
      jenis: req.query.jenis,
      aksi: req.query.aksi,
      dari: req.query.dari,
      sampai: req.query.sampai,
    }),
  })
}))

// POST /api/admin/peringatan { employeeId, jenis: SP1|SP2|SP3|Pemecatan, tanggal, alasan }
// Validasi & notifikasi ke karyawan ditangani di model; riwayat mencatat admin pelaku.
router.post('/peringatan', wrap(async (req, res) => {
  const hasil = await buatPeringatan({
    employeeId: req.body?.employeeId,
    jenis: req.body?.jenis,
    tanggal: req.body?.tanggal,
    alasan: req.body?.alasan,
    olehId: req.employeeId,
  })
  if (hasil.error) return res.status(400).json({ error: hasil.error })
  res.status(201).json({ data: hasil.data })
}))

// DELETE /api/admin/peringatan/:id — cabut/hapus surat (karyawan dinotifikasi).
router.delete('/peringatan/:id', wrap(async (req, res) => {
  const data = await hapusPeringatan(Number(req.params.id), req.employeeId)
  if (!data) return res.status(404).json({ error: 'Surat tidak ditemukan.' })
  res.json({ data })
}))

// ---------- Penghitung gaji (rekap gaji + uang makan + lembur) ----------
// GET /api/admin/gaji?dari=YYYY-MM-DD&sampai=YYYY-MM-DD&departemen=Teknologi
router.get('/gaji', wrap(async (req, res) => {
  res.json({ data: await laporanGaji({
    dari: req.query.dari,
    sampai: req.query.sampai,
    departemen: req.query.departemen,
  }) })
}))

// ---------- Periode penggajian (dipakai slip gaji di aplikasi karyawan) ----------
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

// Nama periode otomatis bila admin tidak mengetik: "Gaji September 2026".
function namaPeriodeGaji(dari, sampai) {
  const d = new Date(`${dari}T00:00:00Z`)
  const teks = `${NAMA_BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  return String(dari).slice(0, 7) === String(sampai).slice(0, 7)
    ? `Gaji ${teks}`
    : `Gaji ${teks} (${dari} s.d. ${sampai})`
}

// GET /api/admin/gaji/periode — daftar periode penggajian (yang aktif ditandai)
router.get('/gaji/periode', wrap(async (_req, res) => {
  res.json({ data: await listPeriodeGaji() })
}))

// POST /api/admin/gaji/periode { nama, dari, sampai } — tetapkan periode (langsung
// AKTIF) dan beri tahu SEMUA karyawan bahwa slip gajinya sudah bisa dilihat.
router.post('/gaji/periode', wrap(async (req, res) => {
  const { nama, dari, sampai } = req.body || {}
  const pola = /^\d{4}-\d{2}-\d{2}$/
  if (!pola.test(String(dari || '')) || !pola.test(String(sampai || ''))) {
    return res.status(400).json({ error: 'Tanggal periode harus format YYYY-MM-DD.' })
  }
  if (dari > sampai) return res.status(400).json({ error: 'Tanggal "dari" melebihi "sampai".' })
  const periode = await tetapkanPeriodeGaji({
    nama: String(nama || '').trim() || namaPeriodeGaji(dari, sampai),
    dari, sampai,
  })
  // Rentang bertumpuk dengan periode lain → ditolak (cegah slip ganda).
  if (periode?.error) return res.status(400).json({ error: periode.error, bentrok: periode.bentrok })
  await kirimNotifikasi({
    employeeId: null,
    judul: '🧾 Slip gaji sudah tersedia',
    pesan: `Periode penggajian "${periode.nama}" (${periode.dari} s.d. ${periode.sampai}) telah ditetapkan. Buka Profil → Slip Gaji untuk melihat rinciannya.`,
    jenis: 'gaji',
  })
  res.status(201).json({ data: periode })
}))

// POST /api/admin/gaji/periode/rapikan — potong periode yang bertumpuk sehingga
// satu tanggal hanya masuk SATU periode (milik periode terbaru). Idempoten.
router.post('/gaji/periode/rapikan', wrap(async (_req, res) => {
  const hasil = await rapikanPeriodeGaji()
  res.json({ data: hasil })
}))

// ---------- Pemeriksa konsistensi data → hitungan gaji ----------
// GET /api/admin/konsistensi — audit menyeluruh (hanya membaca).
router.get('/konsistensi', wrap(async (_req, res) => {
  res.json({ data: await periksaKonsistensi() })
}))

// POST /api/admin/konsistensi/rapikan { mode, kering } — perbaiki data lama agar
// sesuai aturan berlaku (jam tidak wajar, lembur tanpa absensi, izin menggantung).
router.post('/konsistensi/rapikan', wrap(async (req, res) => {
  const { mode = 'semua', kering = false } = req.body || {}
  if (mode !== 'semua' && !MODE_RAPIKAN.includes(mode)) {
    return res.status(400).json({ error: `Mode rapikan harus salah satu dari: semua, ${MODE_RAPIKAN.join(', ')}.` })
  }
  res.json({ data: await rapikanKonsistensi({ mode, kering: kering === true }) })
}))

// PUT /api/admin/gaji/periode/:id/aktif — pindah periode aktif (slip karyawan ikut)
router.put('/gaji/periode/:id/aktif', wrap(async (req, res) => {
  const periode = await aktifkanPeriodeGaji(Number(req.params.id))
  if (!periode) return res.status(404).json({ error: 'Periode penggajian tidak ditemukan.' })
  await kirimNotifikasi({
    employeeId: null,
    judul: '🧾 Slip gaji periode baru',
    pesan: `Slip gaji kini menampilkan periode "${periode.nama}" (${periode.dari} s.d. ${periode.sampai}).`,
    jenis: 'gaji',
  })
  res.json({ data: periode })
}))

router.delete('/gaji/periode/:id', wrap(async (req, res) => {
  const jumlah = await hapusPeriodeGaji(Number(req.params.id))
  if (!jumlah) return res.status(404).json({ error: 'Periode penggajian tidak ditemukan.' })
  res.json({ data: { ok: true } })
}))

// ---------- Laporan kehadiran (rekap per karyawan + export) ----------
// GET /api/admin/reports?dari=YYYY-MM-DD&sampai=YYYY-MM-DD&departemen=Teknologi Informasi
router.get('/reports', wrap(async (req, res) => {
  const { dari, sampai, departemen } = req.query
  const pola = /^\d{4}-\d{2}-\d{2}$/
  if (dari && !pola.test(dari)) return res.status(400).json({ error: 'Parameter "dari" harus format YYYY-MM-DD.' })
  if (sampai && !pola.test(sampai)) return res.status(400).json({ error: 'Parameter "sampai" harus format YYYY-MM-DD.' })
  if (dari && sampai && dari > sampai) return res.status(400).json({ error: 'Tanggal "dari" melebihi "sampai".' })
  res.json({ data: await laporanKehadiran({ dari, sampai, departemen: (departemen || '').trim() || null }) })
}))

// ---------- Kelola Karyawan ----------
router.get('/employees', wrap(async (_req, res) => {
  res.json({ data: await listKaryawan() })
}))

router.post('/employees', wrap(async (req, res) => {
  const d = req.body || {}
  if (!d.nama || !d.email) return res.status(400).json({ error: 'Nama dan email wajib diisi.' })
  const status = validasiStatusKaryawan(d.statusKaryawan)
  if (!status.ok) return res.status(400).json({ error: status.pesan })
  if (status.nilai) d.statusKaryawan = status.nilai
  try {
    res.status(201).json({ data: await buatKaryawan(d) })
  } catch {
    res.status(400).json({ error: 'Gagal menambah karyawan — email/NIP mungkin sudah dipakai.' })
  }
}))

router.put('/employees/:id', wrap(async (req, res) => {
  const d = req.body || {}
  const status = validasiStatusKaryawan(d.statusKaryawan)
  if (!status.ok) return res.status(400).json({ error: status.pesan })
  if (status.nilai) d.statusKaryawan = status.nilai
  const hasil = await ubahKaryawan(Number(req.params.id), d)
  if (!hasil) return res.status(404).json({ error: 'Karyawan tidak ditemukan.' })
  res.json({ data: hasil })
}))

router.delete('/employees/:id', wrap(async (req, res) => {
  if (Number(req.params.id) === req.employeeId) {
    return res.status(400).json({ error: 'Tidak bisa menghapus akun Anda sendiri.' })
  }
  await hapusKaryawan(Number(req.params.id))
  res.json({ data: { ok: true } })
}))

// ---------- Kelola Absensi ----------
router.get('/attendance', wrap(async (req, res) => {
  const { employeeId, dari, sampai } = req.query
  res.json({ data: await listSemuaAbsensi({ employeeId, dari, sampai }) })
}))

router.put('/attendance/:id', wrap(async (req, res) => {
  const hasil = await ubahAbsensi(Number(req.params.id), req.body || {})
  if (!hasil) return res.status(404).json({ error: 'Catatan absensi tidak ditemukan.' })
  // ubahAbsensi() sudah mengembalikan bentuk client (toClient) — jangan dipetakan dua kali.
  res.json({ data: hasil })
}))

router.delete('/attendance/:id', wrap(async (req, res) => {
  await hapusAbsensi(Number(req.params.id))
  res.json({ data: { ok: true } })
}))

// GET /api/admin/attendance/:id/foto?jenis=masuk|pulang — foto selfie untuk
// ditinjau admin (diambil saat dibuka; daftar absensi tetap ringan tanpa base64).
router.get('/attendance/:id/foto', wrap(async (req, res) => {
  const jenis = req.query.jenis === 'pulang' ? 'pulang' : 'masuk'
  const a = await fotoAbsensi(Number(req.params.id), jenis)
  if (!a) return res.status(404).json({ error: 'Catatan absensi tidak ditemukan.' })
  res.json({ data: a })
}))

// ---------- Kelola Izin/Cuti ----------
router.get('/leaves', wrap(async (_req, res) => {
  res.json({ data: await listSemuaIzin() })
}))

router.put('/leaves/:id', wrap(async (req, res) => {
  const status = req.body?.status
  if (!['Disetujui', 'Ditolak', 'Menunggu'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid.' })
  }
  // Alasan penolakan WAJIB saat menolak — dikirim ke notifikasi & riwayat
  // karyawan agar penolakan tidak "tanpa penjelasan".
  const alasan = String(req.body?.alasan || '').trim()
  if (status === 'Ditolak' && !alasan) {
    return res.status(400).json({ error: 'Alasan penolakan wajib diisi.' })
  }
  const hasil = await setStatusIzin(Number(req.params.id), status, alasan)
  if (!hasil) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' })
  res.json({ data: hasil })
}))

router.delete('/leaves/:id', wrap(async (req, res) => {
  await hapusIzin(Number(req.params.id))
  res.json({ data: { ok: true } })
}))

// GET /api/admin/leaves/:id/lampiran — ADMIN melihat lampiran (surat dokter, dsb.)
// pengajuan izin/cuti. Diambil saat tombol "Lihat lampiran" ditekan supaya daftar
// pengajuan tetap ringan (lampiran base64 tidak dikirim pada daftar).
router.get('/leaves/:id/lampiran', wrap(async (req, res) => {
  const l = await lampiranIzin(Number(req.params.id))
  if (!l) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' })
  if (!l.lampiran) return res.status(404).json({ error: 'Pengajuan ini tidak punya lampiran.' })
  res.json({ data: { id: l.id, jenis: l.jenis, lampiran: l.lampiran } })
}))

// ---------- Kelola Lembur ----------
router.get('/overtime', wrap(async (_req, res) => {
  res.json({ data: await listSemuaLembur() })
}))

router.put('/overtime/:id', wrap(async (req, res) => {
  const status = req.body?.status
  if (!['Disetujui', 'Ditolak', 'Menunggu'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid.' })
  }
  // Alasan penolakan WAJIB saat menolak — dikirim ke notifikasi & riwayat
  // karyawan agar penolakan tidak "tanpa penjelasan".
  const alasan = String(req.body?.alasan || '').trim()
  if (status === 'Ditolak' && !alasan) {
    return res.status(400).json({ error: 'Alasan penolakan wajib diisi.' })
  }
  const hasil = await setStatusLembur(Number(req.params.id), status, alasan)
  if (!hasil) return res.status(404).json({ error: 'Pengajuan lembur tidak ditemukan.' })
  res.json({ data: hasil })
}))

router.delete('/overtime/:id', wrap(async (req, res) => {
  await hapusLembur(Number(req.params.id))
  res.json({ data: { ok: true } })
}))

// ---------- Kelola Piket (tugas jaga tambahan, berbayar) ----------
// Biaya piket = pengaturan GLOBAL admin: setiap piket yang DISETUJUI pada sebuah
// periode penggajian dibayar sebesar nilai ini (dipakai penghitung gaji, slip
// gaji karyawan, dan export Excel).
router.get('/piket', wrap(async (_req, res) => {
  res.json({ data: { items: await listSemuaPiket(), biaya: await biayaPiket() } })
}))

// PENTING: rute '/piket/biaya' didaftarkan SEBELUM '/piket/:id' agar kata
// "biaya" tidak dibaca sebagai id pengajuan.
router.get('/piket/biaya', wrap(async (_req, res) => {
  res.json({ data: { biaya: await biayaPiket() } })
}))

// PUT /api/admin/piket/biaya — body { biaya } (rupiah per piket disetujui).
router.put('/piket/biaya', wrap(async (req, res) => {
  const biaya = await setBiayaPiket(req.body?.biaya)
  res.json({ data: { biaya, pesan: `Biaya piket kini Rp${biaya.toLocaleString('id-ID')} per piket disetujui.` } })
}))

router.put('/piket/:id', wrap(async (req, res) => {
  const status = req.body?.status
  if (!['Disetujui', 'Ditolak', 'Menunggu'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid.' })
  }
  // Alasan penolakan WAJIB saat menolak — dikirim ke notifikasi & riwayat
  // karyawan agar penolakan tidak "tanpa penjelasan".
  const alasan = String(req.body?.alasan || '').trim()
  if (status === 'Ditolak' && !alasan) {
    return res.status(400).json({ error: 'Alasan penolakan wajib diisi.' })
  }
  const hasil = await setStatusPiket(Number(req.params.id), status, alasan)
  if (!hasil) return res.status(404).json({ error: 'Pengajuan piket tidak ditemukan.' })
  res.json({ data: hasil })
}))

router.delete('/piket/:id', wrap(async (req, res) => {
  await hapusPiket(Number(req.params.id))
  res.json({ data: { ok: true } })
}))

// ---------- Kelola Notifikasi & Pengumuman ----------
// GET — daftar terkirim; pengumuman dikelompokkan + statistik sudah/belum dibaca
router.get('/notifications', wrap(async (_req, res) => {
  res.json({ data: await listSemuaNotifikasi() })
}))

// POST — TANPA employeeId = pemberitahuan ke SEMUA karyawan (satu baris per orang),
//        DENGAN employeeId = notifikasi personal ke satu karyawan.
router.post('/notifications', wrap(async (req, res) => {
  const { employeeId = null, judul, pesan = '', jenis = 'pengumuman' } = req.body || {}
  if (!String(judul || '').trim()) return res.status(400).json({ error: 'Judul notifikasi wajib diisi.' })
  if (!JENIS_VALID.includes(jenis)) return res.status(400).json({ error: 'Jenis notifikasi tidak dikenal.' })

  if (!employeeId) {
    const hasil = await kirimPengumuman({ judul: String(judul).trim(), pesan, jenis })
    if (!hasil.jumlah) return res.status(400).json({ error: 'Belum ada karyawan yang bisa dikirimi.' })
    return res.status(201).json({ data: { ...hasil, pengumuman: true } })
  }

  const row = await kirimNotifikasi({
    employeeId: Number(employeeId), judul: String(judul).trim(), pesan, jenis,
  })
  res.status(201).json({ data: notifToClient(row) })
}))

// PUT — ubah isi pengumuman untuk semua penerima (status baca direset)
router.put('/notifications/grup/:grupId', wrap(async (req, res) => {
  const { judul, pesan, jenis } = req.body || {}
  if (jenis !== undefined && !JENIS_VALID.includes(jenis)) {
    return res.status(400).json({ error: 'Jenis notifikasi tidak dikenal.' })
  }
  const hasil = await ubahPengumuman(req.params.grupId, { judul, pesan, jenis })
  if (!hasil) return res.status(404).json({ error: 'Pengumuman tidak ditemukan atau tidak ada perubahan.' })
  res.json({ data: hasil })
}))

// DELETE — hapus seluruh pengumuman (semua penerima)
router.delete('/notifications/grup/:grupId', wrap(async (req, res) => {
  const jumlah = await hapusPengumuman(req.params.grupId)
  if (!jumlah) return res.status(404).json({ error: 'Pengumuman tidak ditemukan.' })
  res.json({ data: { ok: true, dihapus: jumlah } })
}))

// DELETE — hapus satu notifikasi personal
router.delete('/notifications/:id', wrap(async (req, res) => {
  await hapusNotifikasi(Number(req.params.id))
  res.json({ data: { ok: true } })
}))

export default router
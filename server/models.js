import crypto from 'node:crypto'
import { db, KANTOR, hashPin, getJadwal, hariKerjaAktif, HARI_KERJA_DEFAULT, shiftSah, getSetting, setSetting } from './db.js'
import { toISODate, jamSekarang } from './utils/waktu.js'

// Jarak antar dua koordinat (meter) — formula Haversine.
function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const rad = (d) => (d * Math.PI) / 180
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// ---------- Mapper ke bentuk yang dipakai frontend ----------
export function toClient(row) {
  if (!row) return null
  return {
    id: row.id ?? null,
    tanggal: row.tanggal,
    checkIn: row.check_in || null,
    checkOut: row.check_out || null,
    status: row.status,
    keterangan: row.keterangan || '',
    // Data absen MASUK (lokasi + geofence saat check-in)
    lokasi: row.lat == null ? null : { lat: row.lat, lon: row.lon, alamat: row.alamat || null },
    selfie: row.selfie || null,
    diLuarArea: row.di_luar_area == null ? null : !!row.di_luar_area,
    jarak: row.jarak ?? null,
    // Data absen PULANG (lokasi + geofence saat check-out) — terpisah dari masuk
    lokasiPulang: row.lat_out == null ? null : { lat: row.lat_out, lon: row.lon_out, alamat: row.alamat_out || null },
    selfiePulang: row.selfie_out || null,
    diLuarAreaPulang: row.di_luar_area_out == null ? null : !!row.di_luar_area_out,
    jarakPulang: row.jarak_out ?? null,
    lampiran: row.lampiran || null,
    // true bila absensi jatuh di luar hari kerja (mis. Sabtu/Minggu).
    hariLibur: !!row.hari_libur,
  }
}

// Versi RINGKAS untuk DAFTAR/riwayat: foto selfie (base64, ratusan KB per baris)
// diganti penanda `adaSelfie`/`adaSelfiePulang`. Foto asli diambil terpisah saat
// detail dibuka (GET /api/attendance/:id/foto?jenis=masuk|pulang) sehingga daftar
// riwayat & dashboard tampil jauh lebih cepat, terutama di jaringan seluler.
export function toClientRingkas(row) {
  const r = toClient(row)
  if (!r) return null
  return {
    ...r,
    selfie: null,
    adaSelfie: !!row.selfie,
    selfiePulang: null,
    adaSelfiePulang: !!row.selfie_out,
  }
}

export function leaveToClient(row) {
  if (!row) return null
  return {
    id: row.id, jenis: row.jenis, mulai: row.mulai, selesai: row.selesai,
    keterangan: row.keterangan || '', status: row.status,
    // Waktu pengajuan dibuat — ditampilkan pada Riwayat Pengajuan Izin/Cuti.
    dibuat: row.created_at || null,
    // Alasan penolakan (bila status Ditolak) — tampil di riwayat & notifikasi.
    alasanTolak: row.alasan_tolak || '',
    // Lampiran TIDAK ikut pada daftar (base64 bisa ratusan KB–MB per baris dan
    // membuat daftar lambat). Hanya penandanya yang dikirim; isi lampiran diambil
    // saat admin/karyawan benar-benar menekan "Lihat lampiran".
    adaLampiran: !!row.lampiran,
    lampiran: null,
  }
}

// Status kepegawaian yang diakui sistem (dipilih admin pada form Karyawan).
export const STATUS_KARYAWAN = ['Karyawan Tetap', 'Karyawan Kontrak']

// ---------- Jenis pengajuan izin & perlakuan uang makan ----------
// Cukup SATU jenis izin datang: "IZIN DATANG TERLAMBAT". Datang terlambat maupun
// datang siang pada dasarnya sama (karyawan tetap masuk kerja) sehingga uang makan
// hari yang disetujui tetap diberikan — beda dari Terlambat tanpa izin.
export const IZIN_DATANG_TERLAMBAT = 'Izin Datang Terlambat'
// Nama LAMA ("Izin Datang Siang") tetap DIKENALI agar data lama tidak rusak, tetapi
// tidak lagi ditawarkan ke karyawan; dinormalkan otomatis ke jenis tunggal.
export const IZIN_DATANG_SIANG_LAMA = 'Izin Datang Siang'
// Daftar jenis RESMI yang boleh diajukan karyawan (dipakai validasi server & UI).
export const JENIS_IZIN = ['Izin', 'Sakit', 'Cuti Tahunan', 'Cuti Khusus', IZIN_DATANG_TERLAMBAT]
// Semua jenis izin datang yang dikenali (termasuk nama lama) — untuk membaca data lama.
export const JENIS_IZIN_DATANG = [IZIN_DATANG_TERLAMBAT, IZIN_DATANG_SIANG_LAMA]

// Status absensi hasil manfaat izin datang (gaji harian + uang makan dibayar).
export const STATUS_IZIN_TERLAMBAT = 'Izin Terlambat'
// Status LAMA — tetap dikenali sampai data lama dinormalkan.
export const STATUS_IZIN_SIANG_LAMA = 'Izin Datang Siang'
export const STATUS_IZIN_DATANG = [STATUS_IZIN_TERLAMBAT, STATUS_IZIN_SIANG_LAMA]
// Semua status absensi yang LAHIR dari pengajuan izin — dibersihkan/dipulihkan
// bila pengajuannya ditolak atau dihapus.
export const STATUS_IZIN_PENGAJUAN = ['Izin', ...STATUS_IZIN_DATANG]

// Jenis pengajuan → status absensi (null = jenis biasa). Jenis lama menghasilkan
// status yang SAMA karena kedua izin itu setara.
export function statusDariJenisIzin(jenis) {
  return JENIS_IZIN_DATANG.includes(jenis) ? STATUS_IZIN_TERLAMBAT : null
}

// Kebalikannya: status absensi izin datang → daftar jenis pengajuan yang sah
// (kosong untuk status 'Izin' biasa). Termasuk nama lama agar data lama tetap sah.
export function jenisWajibStatusIzin(status) {
  return STATUS_IZIN_DATANG.includes(status) ? [...JENIS_IZIN_DATANG] : []
}

// Satukan jenis/status izin datang yang lama ke yang tunggal (IDEMPOTEN). Dipanggil
// otomatis saat server menyala & tersedia sebagai mode rapikan data.
export async function satukanIzinDatang({ kering = false } = {}) {
  const leaves = await db.all('SELECT id, employee_id, mulai, selesai FROM leaves WHERE jenis = ?', [IZIN_DATANG_SIANG_LAMA])
  const absensi = await db.all('SELECT id, employee_id, tanggal, status FROM attendance WHERE status = ?', [STATUS_IZIN_SIANG_LAMA])
  if (!kering) {
    if (leaves.length) await db.run('UPDATE leaves SET jenis = ? WHERE jenis = ?', [IZIN_DATANG_TERLAMBAT, IZIN_DATANG_SIANG_LAMA])
    if (absensi.length) await db.run('UPDATE attendance SET status = ? WHERE status = ?', [STATUS_IZIN_TERLAMBAT, STATUS_IZIN_SIANG_LAMA])
  }
  return {
    jenisDiubah: leaves.length,
    statusDiubah: absensi.length,
    total: leaves.length + absensi.length,
    detail: [
      ...leaves.map((l) => ({ jenis: 'pengajuan', id: l.id, employeeId: l.employee_id, tanggal: l.mulai, baru: IZIN_DATANG_TERLAMBAT })),
      ...absensi.map((a) => ({ jenis: 'absensi', id: a.id, employeeId: a.employee_id, tanggal: a.tanggal, baru: STATUS_IZIN_TERLAMBAT })),
    ],
  }
}

// ---------- Karyawan ----------
async function employeeById(id) {
  const e = await db.get('SELECT * FROM employees WHERE id = ?', [id])
  if (!e) return null
  const cutiTahunan = e.cuti_tahunan ?? 12
  // Kuota cuti tahunan: pengajuan Cuti yang BELUM ditolak (Menunggu + Disetujui)
  // langsung memotong sisa cuti — angka di menu Profil karyawan selalu terkini,
  // bukan baru berkurang setelah halaman dimuat ulang.
  const cuti = await db.get(
    `SELECT
       COALESCE(SUM(julianday(selesai) - julianday(mulai) + 1), 0) AS total,
       COALESCE(SUM(CASE WHEN status = 'Disetujui' THEN julianday(selesai) - julianday(mulai) + 1 ELSE 0 END), 0) AS disetujui,
       COALESCE(SUM(CASE WHEN status = 'Menunggu' THEN julianday(selesai) - julianday(mulai) + 1 ELSE 0 END), 0) AS menunggu
     FROM leaves WHERE employee_id = ? AND jenis LIKE 'Cuti%' AND status <> 'Ditolak'`,
    [id],
  )
  const cutiTerpakai = Math.round(cuti?.total || 0)
  return {
    id: e.id, nama: e.nama, nip: e.nip, jabatan: e.jabatan, departemen: e.departemen,
    email: e.email, telepon: e.telepon, lokasiKerja: e.lokasi_kerja,
    statusKaryawan: e.status_karyawan || 'Karyawan Tetap',
    cutiTahunan, cutiTerpakai,
    cutiDisetujui: Math.round(cuti?.disetujui || 0),
    cutiMenunggu: Math.round(cuti?.menunggu || 0),
    sisaCuti: Math.max(0, cutiTahunan - cutiTerpakai),
    isAdmin: !!e.is_admin,
  }
}

export function getEmployee(id = 1) {
  return employeeById(id)
}

// ---------- Autentikasi (sesi token sederhana) ----------
export async function login(email, pin) {
  const e = await db.get('SELECT * FROM employees WHERE LOWER(email) = LOWER(?)', [String(email).trim()])
  if (!e || !e.pin_hash || e.pin_hash !== hashPin(pin)) return null
  const token = crypto.randomBytes(24).toString('hex')
  await db.run('INSERT INTO sessions (token, employee_id) VALUES (?, ?)', [token, e.id])
  return { token, karyawan: await employeeById(e.id) }
}

export async function logout(token) {
  await db.run('DELETE FROM sessions WHERE token = ?', [token])
}

// Ganti PIN oleh karyawan sendiri: verifikasi PIN lama → simpan hash PIN baru.
// Return { ok, alasan? } agar route bisa menerjemahkannya menjadi HTTP 400.
export async function ubahPin(employeeId, pinLama, pinBaru) {
  const e = await db.get('SELECT id, pin_hash FROM employees WHERE id = ?', [employeeId])
  if (!e || !e.pin_hash || e.pin_hash !== hashPin(String(pinLama))) return { ok: false, alasan: 'PIN lama salah.' }
  if (!/^\d{6}$/.test(String(pinBaru))) return { ok: false, alasan: 'PIN baru harus tepat 6 angka.' }
  if (String(pinBaru) === String(pinLama)) return { ok: false, alasan: 'PIN baru harus berbeda dari PIN lama.' }
  await db.run('UPDATE employees SET pin_hash = ? WHERE id = ?', [hashPin(String(pinBaru)), employeeId])
  return { ok: true }
}

export async function employeeByToken(token) {
  if (!token) return null
  const s = await db.get('SELECT * FROM sessions WHERE token = ?', [token])
  return s ? employeeById(s.employee_id) : null
}

// ---------- Lembur ----------
function lemburToClient(row) {
  if (!row) return null
  return {
    id: row.id, tanggal: row.tanggal, jamMulai: row.jam_mulai, jamSelesai: row.jam_selesai,
    keterangan: row.keterangan || '', status: row.status,
    // Waktu pengajuan dibuat — ditampilkan pada Riwayat Pengajuan Lembur
    // (sejajar dengan riwayat izin/cuti yang sudah menampilkannya).
    dibuat: row.created_at || null,
    // Alasan penolakan (bila status Ditolak) — tampil di riwayat & notifikasi.
    alasanTolak: row.alasan_tolak || '',
  }
}
export { lemburToClient }

// ATURAN: lembur hanya boleh diajukan pada hari yang SUDAH ada absen masuk.
// Tanpa absensi, pengajuan ditolak agar lembur selalu punya dasar kehadiran.
export async function buatLembur({ employeeId, tanggal, jamMulai, jamSelesai, keterangan = '' }) {
  const absenHariItu = await db.get(
    'SELECT status FROM attendance WHERE employee_id = ? AND tanggal = ?',
    [employeeId, tanggal],
  )
  if (!absenHariItu) {
    return {
      error: `Lembur hanya bisa diajukan pada hari yang sudah ada absen masuk. Belum ada absensi tanggal ${tanggal} — silakan check-in dulu pada hari tersebut.`,
    }
  }
  const info = await db.run(
    `INSERT INTO overtime (employee_id, tanggal, jam_mulai, jam_selesai, keterangan) VALUES (?, ?, ?, ?, ?)`,
    [employeeId, tanggal, jamMulai, jamSelesai, keterangan],
  )
  // Ambil id baris lembur SEBELUM mengirim notifikasi (id harus pasti).
  const id = info.lastInsertRowid
  await kirimNotifikasi({
    employeeId,
    judul: '⏰ Pengajuan lembur terkirim',
    pesan: `Lembur ${tanggal} pukul ${jamMulai}-${jamSelesai} sedang menunggu persetujuan admin.`,
    jenis: 'lembur',
  })
  return lemburToClient(await db.get('SELECT * FROM overtime WHERE id = ?', [id]))
}

export async function listLembur(employeeId) {
  const rows = await db.all('SELECT * FROM overtime WHERE employee_id = ? ORDER BY id DESC', [employeeId])
  return rows.map(lemburToClient)
}

// ---------- Piket (tugas jaga tambahan — berbayar sesuai biaya piket admin) ----------
// Biaya piket adalah pengaturan GLOBAL admin (settings 'biayaPiket'): setiap piket
// yang DISETUJUI pada sebuah periode penggajian dibayar sebesar biaya itu.
export async function biayaPiket() {
  return Math.max(0, Math.round(Number(await getSetting('biayaPiket', '0')) || 0))
}

export async function setBiayaPiket(nilai) {
  const angka = Math.max(0, Math.round(Number(nilai) || 0))
  await setSetting('biayaPiket', String(angka))
  return angka
}

function piketToClient(row) {
  if (!row) return null
  return {
    id: row.id,
    tanggal: row.tanggal,
    jamMulai: row.jam_mulai || '',
    jamSelesai: row.jam_selesai || '',
    keterangan: row.keterangan || '',
    status: row.status,
    dibuat: row.created_at || null,
    alasanTolak: row.alasan_tolak || '',
  }
}
export { piketToClient }

// Ajukan piket. Satu tanggal hanya boleh punya SATU pengajuan aktif (Menunggu/
// Disetujui) agar tidak dobel bayar; jam opsional, tapi bila diisi harus lengkap.
export async function buatPiket({ employeeId, tanggal, jamMulai = '', jamSelesai = '', keterangan = '' }) {
  const tgl = String(tanggal || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) {
    return { error: 'Tanggal piket wajib diisi (format YYYY-MM-DD).' }
  }
  const mulai = String(jamMulai || '').trim()
  const selesai = String(jamSelesai || '').trim()
  if ((mulai && !selesai) || (!mulai && selesai)) {
    return { error: 'Isi jam mulai dan jam selesai sekaligus, atau kosongkan keduanya.' }
  }
  if (mulai && !/^\d{2}:\d{2}$/.test(mulai)) return { error: 'Format jam mulai harus HH:MM.' }
  if (selesai && !/^\d{2}:\d{2}$/.test(selesai)) return { error: 'Format jam selesai harus HH:MM.' }
  if (mulai && selesai && selesai <= mulai) return { error: 'Jam selesai harus setelah jam mulai.' }

  const dobel = await db.get(
    `SELECT id, status FROM piket WHERE employee_id = ? AND tanggal = ? AND status IN ('Menunggu','Disetujui') LIMIT 1`,
    [employeeId, tgl],
  )
  if (dobel) {
    return { error: `Sudah ada pengajuan piket tanggal ${tgl} (status ${dobel.status}).` }
  }

  const info = await db.run(
    `INSERT INTO piket (employee_id, tanggal, jam_mulai, jam_selesai, keterangan) VALUES (?, ?, ?, ?, ?)`,
    [employeeId, tgl, mulai || null, selesai || null, keterangan],
  )
  const id = info.lastInsertRowid
  const jam = mulai && selesai ? ` pukul ${mulai}-${selesai}` : ''
  await kirimNotifikasi({
    employeeId,
    judul: '🧹 Pengajuan piket terkirim',
    pesan: `Piket ${tgl}${jam} sedang menunggu persetujuan admin.`,
    jenis: 'piket',
  })
  return piketToClient(await db.get('SELECT * FROM piket WHERE id = ?', [id]))
}

export async function listPiket(employeeId) {
  const rows = await db.all('SELECT * FROM piket WHERE employee_id = ? ORDER BY tanggal DESC, id DESC LIMIT 200', [employeeId])
  return rows.map(piketToClient)
}

// Daftar piket SELURUH karyawan untuk panel admin — plus penanda berapa piket
// yang sudah disetujui (dipakai untuk menghitung biaya piket di slip).
export async function listSemuaPiket() {
  const rows = await db.all(
    `SELECT p.*, e.nama AS nama_karyawan FROM piket p JOIN employees e ON e.id = p.employee_id
     ORDER BY p.tanggal DESC, p.id DESC LIMIT 400`,
  )
  return rows.map((r) => ({ ...piketToClient(r), nama: r.nama_karyawan }))
}

export async function setStatusPiket(id, status, alasan = '') {
  const p = await db.get(
    'SELECT p.*, e.nama AS nama_karyawan FROM piket p LEFT JOIN employees e ON e.id = p.employee_id WHERE p.id = ?',
    [id],
  )
  if (!p) return null
  const teksAlasan = status === 'Ditolak' ? String(alasan || '').trim() : ''
  await db.run('UPDATE piket SET status = ?, alasan_tolak = ? WHERE id = ?', [status, teksAlasan, id])
  await kirimNotifikasi({
    employeeId: p.employee_id,
    judul: status === 'Disetujui' ? '✅ Piket disetujui' : status === 'Ditolak' ? '❌ Piket ditolak' : '🕒 Piket menunggu persetujuan',
    pesan:
      `Pengajuan piket ${p.tanggal} telah ${String(status).toLowerCase()} oleh admin.` +
      (status === 'Disetujui' ? ` Biaya piket dibayarkan pada slip periode penggajian terkait.` : '') +
      (status === 'Ditolak' && teksAlasan ? ` Alasan: ${teksAlasan}` : ''),
    jenis: 'piket',
  })
  return { ...piketToClient(await db.get('SELECT * FROM piket WHERE id = ?', [id])), nama: p.nama_karyawan }
}

export async function hapusPiket(id) {
  const info = await db.run('DELETE FROM piket WHERE id = ?', [id])
  return info.changes
}

// Jumlah piket DISETUJUI (per karyawan / semua karyawan) dalam satu rentang.
export async function hitungPiket(dari, sampai, employeeId = null) {
  const params = [dari, sampai]
  let sql = `SELECT employee_id, COUNT(*) AS n FROM piket
             WHERE status = 'Disetujui' AND tanggal >= ? AND tanggal <= ?`
  if (employeeId) { sql += ' AND employee_id = ?'; params.push(Number(employeeId)) }
  sql += ' GROUP BY employee_id'
  const rows = await db.all(sql, params)
  return new Map(rows.map((r) => [r.employee_id, Number(r.n || 0)]))
}

// ---------- Notifikasi ----------
export function notifToClient(row) {
  return {
    id: row.id, employeeId: row.employee_id, judul: row.judul, pesan: row.pesan || '',
    jenis: row.jenis || 'info', grupId: row.grup_id || null,
    dibaca: !!row.dibaca, dibuat: row.created_at,
  }
}

export async function kirimNotifikasi({ employeeId = null, judul, pesan = '', jenis = 'info' }) {
  const info = await db.run(
    'INSERT INTO notifications (employee_id, judul, pesan, jenis) VALUES (?, ?, ?, ?)',
    [employeeId, judul, pesan, jenis],
  )
  return db.get('SELECT * FROM notifications WHERE id = ?', [info.lastInsertRowid])
}

// Pengumuman/pemberitahuan dari admin → satu baris PER karyawan (fan-out) supaya
// setiap orang punya status "dibaca" sendiri, dan admin bisa memantau siapa yang
// belum membaca.
export const JENIS_PENGUMUMAN = ['pengumuman', 'penting', 'info', 'jadwal']

export async function kirimPengumuman({ judul, pesan = '', jenis = 'pengumuman', employeeIds = null }) {
  const target = Array.isArray(employeeIds) && employeeIds.length
    ? employeeIds.map(Number)
    : (await db.all('SELECT id FROM employees ORDER BY id')).map((e) => e.id)
  const grupId = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  for (const id of target) {
    await db.run(
      'INSERT INTO notifications (employee_id, judul, pesan, jenis, grup_id) VALUES (?, ?, ?, ?, ?)',
      [id, judul, pesan, jenis, grupId],
    )
  }
  return { grupId, jumlah: target.length }
}

// Kategori NOTIFIKASI (alert transaksional personal: hasil persetujuan,
// absensi, gaji, peringatan) — sisanya (lihat JENIS_PENGUMUMAN di atas)
// masuk kategori pengumuman. Taxonomi ini dipakai frontend untuk memilah
// dua halaman yang berbeda: megafon = pengumuman, lonceng = notifikasi.

export async function listNotifikasi(employeeId) {
  const items = (
    await db.all(
      'SELECT * FROM notifications WHERE employee_id = ? OR employee_id IS NULL ORDER BY id DESC LIMIT 50',
      [employeeId],
    )
  ).map(notifToClient)
  const pengumuman = items.filter((n) => JENIS_PENGUMUMAN.includes(n.jenis))
  const notifikasi = items.filter((n) => !JENIS_PENGUMUMAN.includes(n.jenis))
  return {
    items, // lengkap (kompatibilitas)
    pengumuman,
    notifikasi,
    belumDibaca: notifikasi.filter((n) => !n.dibaca).length,
    belumDibacaPengumuman: pengumuman.filter((n) => !n.dibaca).length,
  }
}

// Tandai SATU notifikasi/pengumuman sudah dibaca — milik sendiri atau siaran.
export async function tandaiSatuDibaca(id, employeeId) {
  await db.run(
    'UPDATE notifications SET dibaca = 1 WHERE id = ? AND dibaca = 0 AND (employee_id = ? OR employee_id IS NULL)',
    [Number(id) || 0, employeeId],
  )
}

// hanya: 'semua' (default) | 'pengumuman' (kabar perusahaan) | 'notifikasi' (alert personal).
// Dipisah supaya menandai habis di satu halaman TIDAK ikut mematikan badge halaman lain.
export async function tandaiSemuaDibaca(employeeId, hanya = 'semua') {
  const daftar = JENIS_PENGUMUMAN.map(() => '?').join(',')
  const saring = hanya === 'pengumuman'
    ? `jenis IN (${daftar})`
    : hanya === 'notifikasi'
      ? `jenis NOT IN (${daftar})`
      : null
  if (!saring) {
    await db.run(
      'UPDATE notifications SET dibaca = 1 WHERE dibaca = 0 AND (employee_id = ? OR employee_id IS NULL)',
      [employeeId],
    )
    return
  }
  await db.run(
    `UPDATE notifications SET dibaca = 1 WHERE dibaca = 0 AND ${saring} AND (employee_id = ? OR employee_id IS NULL)`,
    [...JENIS_PENGUMUMAN, employeeId],
  )
}

// ---------- Panel Admin: kelola karyawan ----------
export async function listKaryawan() {
  const rows = await db.all('SELECT * FROM employees ORDER BY id')
  return rows.map((e) => ({
    id: e.id, nama: e.nama, nip: e.nip, jabatan: e.jabatan, departemen: e.departemen,
    email: e.email, telepon: e.telepon, lokasiKerja: e.lokasi_kerja,
    cutiTahunan: e.cuti_tahunan ?? 12, isAdmin: !!e.is_admin,
    // Status kepegawaian (Karyawan Tetap / Karyawan Kontrak).
    statusKaryawan: e.status_karyawan || 'Karyawan Tetap',
    // Shift kerja (1 atau 2) — dipakai saat jadwal mode 'shift'. Null = belum diatur.
    shift: e.shift == null ? null : shiftSah(e.shift),
    // Tarif gaji (Rp) untuk penghitung gaji — diubah admin di tab Karyawan/Gaji.
    gajiHarian: Number(e.gaji_harian ?? 0),
    uangMakan: Number(e.uang_makan ?? 0),
    tarifLembur: Number(e.tarif_lembur ?? 0),
  }))
}

// Status kepegawaian yang sah; nilai tak dikenal → 'Karyawan Tetap'.
export function statusKaryawanSah(nilai) {
  const t = String(nilai || '').trim().toLowerCase()
  return STATUS_KARYAWAN.find((s) => s.toLowerCase() === t) || 'Karyawan Tetap'
}

export async function buatKaryawan(d) {
  const info = await db.run(
    `INSERT INTO employees (nama, nip, jabatan, departemen, email, telepon, lokasi_kerja, cuti_tahunan, is_admin, pin_hash, gaji_harian, uang_makan, tarif_lembur, status_karyawan, shift)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.nama, d.nip || null, d.jabatan || null, d.departemen || null, d.email,
      d.telepon || null, d.lokasiKerja || null, d.cutiTahunan ?? 12, d.isAdmin ? 1 : 0,
      hashPin(d.pin || '123456'),
      Number(d.gajiHarian ?? 0) || 0, Number(d.uangMakan ?? 0) || 0, Number(d.tarifLembur ?? 0) || 0,
      statusKaryawanSah(d.statusKaryawan),
      d.shift === undefined || d.shift === null || String(d.shift).trim() === '' ? null : shiftSah(d.shift),
    ],
  )
  const daftar = await listKaryawan()
  return daftar.find((k) => k.id === info.lastInsertRowid) || daftar.at(-1) || null
}

export async function ubahKaryawan(id, d) {
  const kolom = {
    nama: 'nama', nip: 'nip', jabatan: 'jabatan', departemen: 'departemen',
    email: 'email', telepon: 'telepon', lokasiKerja: 'lokasi_kerja',
  }
  const sets = []
  const params = []
  for (const [k, kol] of Object.entries(kolom)) {
    if (d[k] !== undefined) { sets.push(`${kol} = ?`); params.push(d[k]) }
  }
  if (d.cutiTahunan !== undefined) { sets.push('cuti_tahunan = ?'); params.push(d.cutiTahunan) }
  // Status kepegawaian (Karyawan Tetap / Karyawan Kontrak).
  if (d.statusKaryawan !== undefined) { sets.push('status_karyawan = ?'); params.push(statusKaryawanSah(d.statusKaryawan)) }
  // Shift kerja (1 atau 2). String kosong = lepaskan penetapan (ikut Shift 1).
  if (d.shift !== undefined) {
    const kosong = d.shift === null || String(d.shift).trim() === ''
    sets.push('shift = ?')
    params.push(kosong ? null : shiftSah(d.shift))
  }
  // Tarif gaji (Rp) — nilai dari input selalu dikonversi ke angka non-negatif.
  for (const [k, kol] of [['gajiHarian', 'gaji_harian'], ['uangMakan', 'uang_makan'], ['tarifLembur', 'tarif_lembur']]) {
    if (d[k] !== undefined) { sets.push(`${kol} = ?`); params.push(Math.max(0, Number(d[k]) || 0)) }
  }
  if (d.isAdmin !== undefined) { sets.push('is_admin = ?'); params.push(d.isAdmin ? 1 : 0) }
  if (d.pin) { sets.push('pin_hash = ?'); params.push(hashPin(d.pin)) }
  if (sets.length) {
    params.push(id)
    await db.run(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`, params)
  }
  return employeeById(id)
}

export async function hapusKaryawan(id) {
  // Surat peringatan aktif dicatat ke RIWAYAT lebih dahulu, supaya jejak audit
  // (nomor surat + nama karyawan) tetap ada walau surat & karyawannya dihapus.
  const surat = await db.all(
    'SELECT s.*, e.nama AS nama_karyawan FROM warnings s LEFT JOIN employees e ON e.id = s.employee_id WHERE s.employee_id = ?',
    [id],
  )
  for (const s of surat) {
    await catatRiwayatPeringatan({
      warningId: s.id, employeeId: id, namaKaryawan: s.nama_karyawan || '',
      jenis: s.jenis, nomor: s.nomor || '', tanggal: s.tanggal, alasan: s.alasan || '',
      aksi: 'Dicabut',
    })
  }
  for (const sql of [
    'DELETE FROM attendance WHERE employee_id = ?',
    'DELETE FROM leaves WHERE employee_id = ?',
    'DELETE FROM overtime WHERE employee_id = ?',
    'DELETE FROM notifications WHERE employee_id = ?',
    'DELETE FROM sessions WHERE employee_id = ?',
    'DELETE FROM warnings WHERE employee_id = ?',
    'DELETE FROM employees WHERE id = ?',
  ]) {
    await db.run(sql, [id])
  }
}

// ---------- Surat peringatan (SP1/SP2/SP3) & pemecatan ----------
// Diterbitkan admin dari panel; tampil di Profil karyawan + notifikasi otomatis.
export const JENIS_PERINGATAN = ['SP1', 'SP2', 'SP3', 'Pemecatan']

export const LABEL_PERINGATAN = {
  SP1: 'Surat Peringatan 1',
  SP2: 'Surat Peringatan 2',
  SP3: 'Surat Peringatan 3',
  Pemecatan: 'Surat Pemecatan',
}

function peringatanToClient(s, nama = null) {
  return {
    id: s.id, employeeId: s.employee_id, nama: nama || null,
    jenis: s.jenis, label: LABEL_PERINGATAN[s.jenis] || s.jenis,
    nomor: s.nomor || '',
    tanggal: s.tanggal, alasan: s.alasan || '', dibuat: s.created_at || null,
  }
}

// Aksi yang dicatat pada riwayat surat peringatan.
export const AKSI_PERINGATAN = ['Diterbitkan', 'Dicabut']

// Nama admin pelaku aksi (kolom "Oleh" pada riwayat). Selalu ada isinya.
async function namaAdmin(olehId) {
  if (olehId == null) return 'Admin'
  const a = await db.get('SELECT nama FROM employees WHERE id = ?', [Number(olehId)])
  return a?.nama || 'Admin'
}

// ===== Penomoran otomatis surat =====
// Format resmi: 001/SP1-HRD/IX/2026 — kode mengikuti JENIS surat:
//   SP1 → SP1-HRD, SP2 → SP2-HRD, SP3 → SP3-HRD, Pemecatan → PHK-HRD.
// Urutan dihitung per jenis per tahun (terbanyak antara surat aktif dan riwayat,
// agar nomor tak pernah terpakai ulang), bulan romawi & tahun dari tanggal surat.
const ROMAWI_BULAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const KODE_SURAT = { SP1: 'SP1-HRD', SP2: 'SP2-HRD', SP3: 'SP3-HRD', Pemecatan: 'PHK-HRD' }

export async function buatNomorSurat(jenis, tanggal) {
  const tahun = String(tanggal).slice(0, 4)
  const bulan = ROMAWI_BULAN[Number(String(tanggal).slice(5, 7)) - 1] || 'I'
  const dariSurat = (await db.get(
    'SELECT COUNT(*) AS n FROM warnings WHERE jenis = ? AND substr(tanggal, 1, 4) = ?',
    [jenis, tahun],
  ))?.n ?? 0
  const dariRiwayat = (await db.get(
    "SELECT COUNT(*) AS n FROM warning_log WHERE jenis = ? AND aksi = 'Diterbitkan' AND substr(tanggal, 1, 4) = ?",
    [jenis, tahun],
  ))?.n ?? 0
  const urut = String(Math.max(Number(dariSurat) || 0, Number(dariRiwayat) || 0) + 1).padStart(3, '0')
  return `${urut}/${KODE_SURAT[jenis] || 'SP-HRD'}/${bulan}/${tahun}`
}

// Lengkapi nomor surat lama yang terbit sebelum fitur penomoran ada
// (kolom nomor kosong/null). Nomor DIPULIHKAN sesuai urutan kejadian
// 'Diterbitkan' di riwayat (bukan nomor baru), sehingga surat lama mendapat
// nomor aslinya kembali. Surat tanpa jejak riwayat memakai buatNomorSurat.
// Tidak menimpa surat yang sudah punya nomor. Aman diulang.
export async function lengkapiNomorSuratLama() {
  const kosong = await db.all(
    "SELECT id, jenis, tanggal FROM warnings WHERE nomor IS NULL OR nomor = '' ORDER BY tanggal ASC, id ASC",
  )
  let terisi = 0
  for (const s of kosong) {
    let nomor = null
    // Cari kejadian 'Diterbitkan' surat ini di riwayat → urutan kejadian itu
    // di antara surat sejenis setahun yang sama = nomor aslinya.
    const log = await db.get(
      "SELECT id FROM warning_log WHERE warning_id = ? AND aksi = 'Diterbitkan' LIMIT 1",
      [s.id],
    )
    if (log) {
      const seq = Number(
        (
          await db.get(
            // Tanpa JOIN surat: surat yang sudah dicabut/dihapus tetap dihitung
            // agar urutan nomor tidak bergeser.
            `SELECT COUNT(*) AS n FROM warning_log
             WHERE aksi = 'Diterbitkan' AND jenis = ? AND substr(tanggal, 1, 4) = ? AND id <= ?`,
            [s.jenis, String(s.tanggal).slice(0, 4), log.id],
          )
        )?.n ?? 0,
      )
      if (seq > 0) {
        const ROMAWI = ROMAWI_BULAN[Number(String(s.tanggal).slice(5, 7)) - 1] || 'I'
        nomor = `${String(seq).padStart(3, '0')}/${KODE_SURAT[s.jenis] || 'SP-HRD'}/${ROMAWI}/${String(s.tanggal).slice(0, 4)}`
      }
    }
    if (!nomor) nomor = await buatNomorSurat(s.jenis, s.tanggal)
    await db.run('UPDATE warnings SET nomor = ? WHERE id = ?', [nomor, s.id])
    // Riwayat kejadian 'Diterbitkan' milik surat ini ikut diperbarui agar konsisten.
    await db.run(
      "UPDATE warning_log SET nomor = ? WHERE warning_id = ? AND aksi = 'Diterbitkan' AND (nomor IS NULL OR nomor = '')",
      [nomor, s.id],
    )
    terisi++
  }
  if (terisi) console.log(`🔢 Nomor surat lama dilengkapi: ${terisi} surat.`)
  return terisi
}

// Catat satu kejadian ke riwayat (tabel warning_log). Nama karyawan, nomor surat,
// dan alasan DISALIN (snapshot) supaya riwayat tetap utuh setelah surat dicabut,
// bahkan setelah karyawannya dihapus.
async function catatRiwayatPeringatan({
  warningId = null, employeeId = null, namaKaryawan = '', jenis,
  nomor = '', tanggal, alasan = '', aksi, olehId = null,
}) {
  if (!AKSI_PERINGATAN.includes(aksi)) return
  const oleh = await namaAdmin(olehId)
  await db.run(
    `INSERT INTO warning_log (warning_id, employee_id, nama_karyawan, jenis, nomor, tanggal, alasan, aksi, oleh)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      warningId, employeeId, String(namaKaryawan || ''), jenis,
      String(nomor || ''), tanggal, String(alasan || ''), aksi, oleh,
    ],
  )
}

// Sinkronisasi satu arah warnings → warning_log. Surat yang pernah
// diterbitkan/dicabut SEBELUM fitur riwayat ada (atau saat server memakai
// kode lama) belum tercatat di warning_log; di sini kekurangan itu diisi
// otomatis. Aman diulang: hanya baris yang benar-benar belum ada yang ditulis.
// Dipanggil saat server boot dan tiap tab Riwayat SP dibuka.
export async function sinkronkanRiwayatPeringatan() {
  const kurang = await db.all(
    `SELECT s.id, s.employee_id, s.jenis, s.nomor, s.tanggal, s.alasan, e.nama AS nama_karyawan
     FROM warnings s LEFT JOIN employees e ON e.id = s.employee_id
     WHERE NOT EXISTS (SELECT 1 FROM warning_log w WHERE w.warning_id = s.id AND w.aksi = 'Diterbitkan')`,
  )
  for (const s of kurang) {
    await catatRiwayatPeringatan({
      warningId: s.id, employeeId: s.employee_id, namaKaryawan: s.nama_karyawan || '',
      jenis: s.jenis, nomor: s.nomor || '', tanggal: s.tanggal, alasan: s.alasan || '',
      aksi: 'Diterbitkan', olehId: null,
    })
  }
  if (kurang.length) {
    console.log(`📜 Sinkron riwayat SP: ${kurang.length} surat lama ditambahkan ke riwayat.`)
  }
  return kurang.length
}

// Riwayat surat peringatan untuk tab "Riwayat SP" di panel admin.
// Mengembalikan { items, ringkas } — ringkas dihitung dengan query COUNT
// terpisah agar tetap akurat walau daftarnya dibatasi LIMIT.
export async function listRiwayatPeringatan({ employeeId, jenis, aksi, dari, sampai } = {}) {
  const saring = []
  const params = []
  if (employeeId) { saring.push('employee_id = ?'); params.push(Number(employeeId)) }
  if (jenis && JENIS_PERINGATAN.includes(jenis)) { saring.push('jenis = ?'); params.push(jenis) }
  if (aksi && AKSI_PERINGATAN.includes(aksi)) { saring.push('aksi = ?'); params.push(aksi) }
  if (dari) { saring.push('tanggal >= ?'); params.push(dari) }
  if (sampai) { saring.push('tanggal <= ?'); params.push(sampai) }
  const where = saring.length ? ` WHERE ${saring.join(' AND ')}` : ''

  const rows = await db.all('SELECT * FROM warning_log' + where + ' ORDER BY id DESC LIMIT 500', params)
  const items = rows.map((r) => ({
    id: r.id, warningId: r.warning_id, employeeId: r.employee_id,
    nama: r.nama_karyawan || '', jenis: r.jenis,
    label: LABEL_PERINGATAN[r.jenis] || r.jenis,
    nomor: r.nomor || '', tanggal: r.tanggal, alasan: r.alasan || '',
    aksi: r.aksi, oleh: r.oleh || 'Admin', dibuat: r.created_at || null,
  }))

  const perAksi = await db.all(
    'SELECT aksi, COUNT(*) AS n FROM warning_log' + where + ' GROUP BY aksi', params,
  )
  const jumlah = (nama) => Number(perAksi.find((a) => a.aksi === nama)?.n ?? 0)
  return {
    items,
    ringkas: {
      total: perAksi.reduce((t, a) => t + Number(a.n || 0), 0),
      diterbitkan: jumlah('Diterbitkan'),
      dicabut: jumlah('Dicabut'),
    },
  }
}

// Semua surat milik satu karyawan (terbaru dulu) — disematkan ke Profil.
export async function listPeringatan(employeeId) {
  await lengkapiNomorSuratLama()
  const rows = await db.all(
    'SELECT * FROM warnings WHERE employee_id = ? ORDER BY id DESC',
    [employeeId],
  )
  return rows.map((s) => peringatanToClient(s))
}

// Daftar seluruh surat (untuk panel admin; bisa disaring per karyawan).
export async function listSemuaPeringatan({ employeeId } = {}) {
  let sql = 'SELECT s.*, e.nama AS nama_karyawan FROM warnings s JOIN employees e ON e.id = s.employee_id'
  const params = []
  if (employeeId) { sql += ' WHERE s.employee_id = ?'; params.push(Number(employeeId)) }
  sql += ' ORDER BY s.id DESC LIMIT 300'
  const rows = await db.all(sql, params)
  return rows.map((s) => peringatanToClient(s, s.nama_karyawan))
}

export async function buatPeringatan({ employeeId, jenis, tanggal, alasan = '', olehId = null }) {
  if (!JENIS_PERINGATAN.includes(jenis)) {
    return { error: `Jenis surat harus salah satu dari: ${JENIS_PERINGATAN.join(', ')}.` }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tanggal || ''))) {
    return { error: 'Tanggal surat harus format YYYY-MM-DD.' }
  }
  const teks = String(alasan || '').trim()
  if (teks.length < 3 || teks.length > 300) {
    return { error: 'Alasan wajib 3–300 karakter agar jelas bagi karyawan.' }
  }
  const karyawan = await db.get('SELECT id, nama FROM employees WHERE id = ?', [Number(employeeId)])
  if (!karyawan) return { error: 'Karyawan tidak ditemukan.' }
  // Nomor surat resmi otomatis: urut per jenis per tahun, bulan romawi & tahun
  // diambil otomatis dari tanggal surat (contoh 001/SP-HRD/IX/2026). Urutan
  // memakai terbanyak antara surat aktif dan riwayat — nomor tak pernah terpakai ulang.
  const nomor = await buatNomorSurat(jenis, tanggal)
  const info = await db.run(
    'INSERT INTO warnings (employee_id, jenis, nomor, tanggal, alasan) VALUES (?, ?, ?, ?, ?)',
    [karyawan.id, jenis, nomor, tanggal, teks],
  )
  // Jejak audit: setiap penerbitan masuk ke riwayat (tab Riwayat SP).
  await catatRiwayatPeringatan({
    warningId: info.lastInsertRowid, employeeId: karyawan.id, namaKaryawan: karyawan.nama,
    jenis, nomor, tanggal, alasan: teks, aksi: 'Diterbitkan', olehId,
  })
  const label = LABEL_PERINGATAN[jenis]
  await kirimNotifikasi({
    employeeId: karyawan.id,
    judul: jenis === 'Pemecatan' ? '🚫 Surat Pemecatan diterbitkan' : `⚠️ ${label} diterbitkan`,
    pesan:
      `Nomor ${nomor} — kamu menerima ${label.toLowerCase()} per ${tanggal}. Alasan: ${teks}.` +
      (jenis === 'Pemecatan'
        ? ' Hubungi HRD segera untuk proses penyelesaian.'
        : ' Segera perbaiki — surat berikutnya berakibat lebih berat.'),
    jenis: 'peringatan',
  })
  return { data: peringatanToClient(await db.get('SELECT * FROM warnings WHERE id = ?', [info.lastInsertRowid]), karyawan.nama) }
}

export async function hapusPeringatan(id, olehId = null) {
  const s = await db.get(
    'SELECT s.*, e.nama AS nama_karyawan FROM warnings s LEFT JOIN employees e ON e.id = s.employee_id WHERE s.id = ?',
    [id],
  )
  if (!s) return null
  // Catat DULU ke riwayat: setelah baris surat dihapus, data nama/nomor sumbernya
  // sudah tidak ada, sehingga snapshot harus dibuat sebelum DELETE.
  await catatRiwayatPeringatan({
    warningId: s.id, employeeId: s.employee_id, namaKaryawan: s.nama_karyawan || '',
    jenis: s.jenis, nomor: s.nomor || '', tanggal: s.tanggal, alasan: s.alasan || '',
    aksi: 'Dicabut', olehId,
  })
  await db.run('DELETE FROM warnings WHERE id = ?', [id])
  await kirimNotifikasi({
    employeeId: s.employee_id,
    judul: '📄 Surat peringatan dicabut',
    pesan: `${LABEL_PERINGATAN[s.jenis] || s.jenis} per ${s.tanggal} telah dicabut/dihapus oleh admin.`,
    jenis: 'peringatan',
  })
  return peringatanToClient(s, s.nama_karyawan)
}

// ---------- Panel Admin: kelola absensi ----------
const ABSENSI_JOIN = 'SELECT a.*, e.nama AS nama_karyawan FROM attendance a JOIN employees e ON e.id = a.employee_id'

export async function listSemuaAbsensi({ employeeId, dari, sampai } = {}) {
  let sql = ABSENSI_JOIN + ' WHERE 1=1'
  const params = []
  if (employeeId) { sql += ' AND a.employee_id = ?'; params.push(employeeId) }
  if (dari) { sql += ' AND a.tanggal >= ?'; params.push(dari) }
  if (sampai) { sql += ' AND a.tanggal <= ?'; params.push(sampai) }
  const rows = await db.all(sql + ' ORDER BY a.tanggal DESC, a.id DESC LIMIT 150', params)
  return rows.map((r) => ({ ...toClientRingkas(r), nama: r.nama_karyawan }))
}

export async function ubahAbsensi(id, { checkIn, checkOut, status } = {}) {
  const sets = []
  const params = []
  if (checkIn !== undefined) { sets.push('check_in = ?'); params.push(checkIn || null) }
  if (checkOut !== undefined) { sets.push('check_out = ?'); params.push(checkOut || null) }
  if (status !== undefined) { sets.push('status = ?'); params.push(status) }
  if (sets.length) {
    params.push(id)
    await db.run(`UPDATE attendance SET ${sets.join(', ')} WHERE id = ?`, params)
  }
  return toClient(await db.get('SELECT * FROM attendance WHERE id = ?', [id]))
}

export async function hapusAbsensi(id) {
  await db.run('DELETE FROM attendance WHERE id = ?', [id])
}

// ---------- Panel Admin: kelola izin/cuti ----------
export async function listSemuaIzin() {
  const rows = await db.all(
    'SELECT l.*, e.nama AS nama_karyawan FROM leaves l JOIN employees e ON e.id = l.employee_id ORDER BY l.id DESC LIMIT 300',
  )
  return rows.map((l) => ({ ...leaveToClient(l), nama: l.nama_karyawan }))
}

// Isi lampiran satu pengajuan (base64/dataURL) — diambil HANYA saat dibuka, baik
// oleh admin (panel) maupun oleh karyawan pemilik pengajuan (routes memeriksa hak).
export async function lampiranIzin(id) {
  const l = await db.get('SELECT id, employee_id, jenis, lampiran FROM leaves WHERE id = ?', [id])
  if (!l) return null
  return { id: l.id, employeeId: l.employee_id, jenis: l.jenis, lampiran: l.lampiran || null }
}

// Foto selfie satu catatan absensi ('masuk' | 'pulang') — juga diambil saat
// detail dibuka saja, sehingga daftar riwayat tetap ringan.
export async function fotoAbsensi(id, jenis = 'masuk') {
  const kolom = jenis === 'pulang' ? 'selfie_out' : 'selfie'
  const a = await db.get(`SELECT id, employee_id, tanggal, ${kolom} AS foto FROM attendance WHERE id = ?`, [id])
  if (!a) return null
  return { id: a.id, employeeId: a.employee_id, tanggal: a.tanggal, jenis: jenis === 'pulang' ? 'pulang' : 'masuk', foto: a.foto || null }
}

// Rekonsiliasi baris absensi berstatus IZIN (termasuk "Izin Terlambat"/"Izin
// Datang Siang" hasil pengajuan) terhadap tabel pengajuan — dipakai saat
// pengajuan DITOLAK/dihapus dan oleh pemeriksa konsistensi data:
//   • baris yang punya jam check-in  → status dipulihkan dari jamnya (aturan sama
//     dengan check-in) agar hari yang benar-benar dihadiri tidak hilang;
//   • baris tanpa check-in (hanya penanda izin) → dihapus, karena tanpa pengajuan
//     yang sah hari itu TIDAK boleh dihitung/dibayar sebagai izin.
export async function rekonsiliasiIzinKehadiran({ employeeId = null, dari = null, sampai = null, kering = false } = {}) {
  const saring = [`status IN (${STATUS_IZIN_PENGAJUAN.map(() => '?').join(', ')})`]
  const params = [...STATUS_IZIN_PENGAJUAN]
  if (employeeId) { saring.push('employee_id = ?'); params.push(Number(employeeId)) }
  if (dari) { saring.push('tanggal >= ?'); params.push(dari) }
  if (sampai) { saring.push('tanggal <= ?'); params.push(sampai) }
  const rows = await db.all(`SELECT * FROM attendance WHERE ${saring.join(' AND ')}`, params)

  const hasil = { dipulihkan: [], dihapus: [] }
  for (const r of rows) {
    // Baris sah bila ada pengajuan (non-ditolak) yang mencakup tanggalnya.
    // Status izin datang hanya sah bila pengajuan jenisnya memang izin datang.
    const wajib = jenisWajibStatusIzin(r.status)
    const dasar = await db.get(
      `SELECT id FROM leaves WHERE employee_id = ? AND status <> 'Ditolak' AND mulai <= ? AND selesai >= ?`
        + (wajib.length ? ` AND jenis IN (${wajib.map(() => '?').join(', ')})` : '') + ' LIMIT 1',
      wajib.length ? [r.employee_id, r.tanggal, r.tanggal, ...wajib] : [r.employee_id, r.tanggal, r.tanggal],
    )
    if (dasar) continue

    if (r.check_in) {
      const jadwal = await getJadwal(r.employee_id)
      const { status, alasan } = hitungStatusAbsen(jadwal, r.check_in)
      const keterangan = `${alasan || `Jam check-in ${r.check_in}`} (izin tidak disetujui — status dipulihkan)`
      if (!kering) await db.run('UPDATE attendance SET status = ?, keterangan = ? WHERE id = ?', [status, keterangan, r.id])
      hasil.dipulihkan.push({
        id: r.id, employeeId: r.employee_id, nama: r.nama, tanggal: r.tanggal,
        checkIn: r.check_in, statusLama: r.status, statusBaru: status,
      })
    } else {
      if (!kering) await db.run('DELETE FROM attendance WHERE id = ?', [r.id])
      hasil.dihapus.push({ id: r.id, employeeId: r.employee_id, tanggal: r.tanggal, keterangan: r.keterangan || '' })
    }
  }
  return hasil
}

// Manfaat izin datang: hari yang SUDAH check-in tetapi masih berstatus
// 'Terlambat' (uang makan hangus) dinaikkan ke STATUS IZIN DATANG sehingga uang
// makan hari itu tetap diberikan. Hanya hari kerja biasa yang disentuh (absen di
// hari libur tetap "Hadir Libur" agar hitungannya tidak berubah). Aman dijalankan
// berulang — hanya baris berstatus Terlambat diubah.
export async function terapkanIzinDatang(leave, { kering = false } = {}) {
  const status = statusDariJenisIzin(leave?.jenis)
  const employeeId = leave?.employee_id ?? leave?.employeeId
  if (!status || !employeeId || !leave?.mulai || !leave?.selesai) return { status: null, diterapkan: [] }

  const rows = await db.all(
    `SELECT * FROM attendance
      WHERE employee_id = ? AND tanggal >= ? AND tanggal <= ?
        AND COALESCE(hari_libur, 0) = 0
        AND check_in IS NOT NULL AND TRIM(check_in) NOT IN ('', '-')
        AND status = 'Terlambat'`,
    [employeeId, leave.mulai, leave.selesai],
  )
  const diterapkan = []
  for (const r of rows) {
    const keterangan = `${leave.jenis} (disetujui): check-in ${r.check_in} — uang makan tetap diberikan`
    if (!kering) await db.run('UPDATE attendance SET status = ?, keterangan = ? WHERE id = ?', [status, keterangan, r.id])
    diterapkan.push({
      id: r.id, employeeId, tanggal: r.tanggal, checkIn: r.check_in,
      statusLama: r.status, statusBaru: status,
    })
  }
  return { status, diterapkan }
}

export async function setStatusIzin(id, status, alasan = '') {
  const l = await db.get(
    'SELECT l.*, e.nama AS nama_karyawan FROM leaves l LEFT JOIN employees e ON e.id = l.employee_id WHERE l.id = ?',
    [id],
  )
  if (!l) return null
  // Alasan penolakan disimpan bersama status; dikosongkan bila dibuka ulang.
  const teksAlasan = status === 'Ditolak' ? String(alasan || '').trim() : ''
  await db.run('UPDATE leaves SET status = ?, alasan_tolak = ? WHERE id = ?', [status, teksAlasan, id])
  // Izin DITOLAK → baris absensi 'Izin' yang menggantung dibersihkan/dipulihkan,
  // supaya hari itu tidak lagi dihitung (dan dibayar) sebagai izin.
  if (status === 'Ditolak') {
    await rekonsiliasiIzinKehadiran({ employeeId: l.employee_id, dari: l.mulai, sampai: l.selesai })
  }
  // Izin "datang terlambat/siang" DISETUJUI → manfaatnya langsung diterapkan pada
  // hari yang sudah check-in (status Terlambat) supaya uang makan tidak hangus.
  if (status === 'Disetujui') await terapkanIzinDatang(l)
  await kirimNotifikasi({
    employeeId: l.employee_id,
    judul: status === 'Disetujui' ? '✅ Izin/cuti disetujui' : '❌ Izin/cuti ditolak',
    pesan:
      `Pengajuan ${l.jenis} (${l.mulai} s.d. ${l.selesai}) telah ${status.toLowerCase()} oleh admin.` +
      (status === 'Ditolak' && teksAlasan ? ` Alasan: ${teksAlasan}` : ''),
    jenis: 'izin',
  })
  return { ...leaveToClient(await db.get('SELECT * FROM leaves WHERE id = ?', [id])), nama: l.nama_karyawan }
}

export async function hapusIzin(id) {
  const l = await db.get('SELECT * FROM leaves WHERE id = ?', [id])
  if (!l) return 0
  // Hapus pengajuan = dasarnya hilang → bersihkan/pulihkan baris absensi 'Izin'.
  await rekonsiliasiIzinKehadiran({ employeeId: l.employee_id, dari: l.mulai, sampai: l.selesai })
  const info = await db.run('DELETE FROM leaves WHERE id = ?', [id])
  return info.changes
}

// ---------- Panel Admin: kelola lembur ----------
// `adaAbsensi` menandai lembur yang tanggalnya TIDAK punya catatan absensi
// (mis. data lama sebelum aturan "wajib absen dulu" berlaku) agar admin bisa
// meninjau sebelum menyetujui.
export async function listSemuaLembur() {
  const rows = await db.all(
    `SELECT o.*, e.nama AS nama_karyawan,
            (SELECT COUNT(*) FROM attendance a WHERE a.employee_id = o.employee_id AND a.tanggal = o.tanggal) AS ada_absensi
     FROM overtime o JOIN employees e ON e.id = o.employee_id ORDER BY o.id DESC`,
  )
  return rows.map((o) => ({ ...lemburToClient(o), nama: o.nama_karyawan, adaAbsensi: Number(o.ada_absensi || 0) > 0 }))
}

export async function setStatusLembur(id, status, alasan = '') {
  const o = await db.get(
    'SELECT o.*, e.nama AS nama_karyawan FROM overtime o LEFT JOIN employees e ON e.id = o.employee_id WHERE o.id = ?',
    [id],
  )
  if (!o) return null
  // Alasan penolakan disimpan bersama status; dikosongkan bila dibuka ulang.
  const teksAlasan = status === 'Ditolak' ? String(alasan || '').trim() : ''
  await db.run('UPDATE overtime SET status = ?, alasan_tolak = ? WHERE id = ?', [status, teksAlasan, id])
  await kirimNotifikasi({
    employeeId: o.employee_id,
    judul: status === 'Disetujui' ? '✅ Lembur disetujui' : '❌ Lembur ditolak',
    pesan:
      `Lembur ${o.tanggal} (${o.jam_mulai}-${o.jam_selesai}) telah ${status.toLowerCase()} oleh admin.` +
      (status === 'Ditolak' && teksAlasan ? ` Alasan: ${teksAlasan}` : ''),
    jenis: 'lembur',
  })
  return { ...lemburToClient(await db.get('SELECT * FROM overtime WHERE id = ?', [id])), nama: o.nama_karyawan }
}

export async function hapusLembur(id) {
  await db.run('DELETE FROM overtime WHERE id = ?', [id])
}

// ---------- Hari libur (nasional/cuti bersama + khusus dari admin) ----------
// Hari yang terdaftar: tidak Alpha otomatis, tidak dihitung hari kerja pada
// laporan/gaji, dan absensi di hari itu ditandai hari_libur = 1 (Hadir Libur).
export async function listHariLibur({ tahun } = {}) {
  const t = Number(tahun) || new Date().getFullYear()
  const rows = await db.all(
    `SELECT tanggal, nama, sumber FROM holidays
     WHERE tanggal LIKE ? OR tanggal LIKE ?
     ORDER BY tanggal`,
    [`${t}-%`, `${t + 1}-%`],
  )
  return rows.map((r) => ({ tanggal: r.tanggal, nama: r.nama, sumber: r.sumber === 'resmi' ? 'resmi' : 'admin' }))
}

// Set tanggal libur untuk rentang [dari..sampai] — dipakai laporan & alpha.
async function setTanggalLibur(dari, sampai) {
  const rows = await db.all(
    'SELECT tanggal FROM holidays WHERE tanggal >= ? AND tanggal <= ?',
    [dari, sampai],
  )
  return new Set(rows.map((r) => r.tanggal))
}

export async function tambahHariLibur(tanggal, nama) {
  await db.run(
    `INSERT INTO holidays (tanggal, nama, sumber) VALUES (?, ?, 'admin')
     ON CONFLICT (tanggal) DO UPDATE SET nama = excluded.nama, sumber = 'admin'`,
    [tanggal, nama],
  )
  return { tanggal, nama, sumber: 'admin' }
}

export async function hapusHariLibur(tanggal) {
  const info = await db.run('DELETE FROM holidays WHERE tanggal = ?', [tanggal])
  return info.changes > 0
}
// ---------- Panel Admin: laporan kehadiran (export Excel/PDF) ----------
// Hari kerja = hari yang aktif pada pengaturan jadwal (default Senin–Jumat) dalam
// rentang [dari..sampai] inklusif. Hari libur nasional tidak dikurangkan otomatis —
// admin cukup menyesuaikan periode laporan.
function hitungHariKerja(dari, sampai, hariAktif = HARI_KERJA_DEFAULT, liburSet = null) {
  const mulai = new Date(`${dari}T00:00:00Z`)
  const akhir = new Date(`${sampai}T00:00:00Z`)
  if (Number.isNaN(mulai.getTime()) || Number.isNaN(akhir.getTime()) || mulai > akhir) return 0
  const aktif = new Set(hariAktif)
  let n = 0
  for (let d = new Date(mulai); d <= akhir; d.setUTCDate(d.getUTCDate() + 1)) {
    // Hari libur (nasional/cuti bersama/khusus admin) bukan hari kerja —
    // tidak menggelembungkan target kehadiran & tidak menjadikan karyawan Alpha.
    if (liburSet?.has(toISODate(d))) continue
    if (aktif.has(d.getUTCDay())) n += 1
  }
  return n
}

// Selisih dua jam 'HH:MM' dalam jam desimal (lembur lintas tengah malam tetap dihitung).
function selisihJam(mulai, selesai) {
  const keMenit = (s) => {
    const [j, m] = String(s || '').split(':').map(Number)
    return (j || 0) * 60 + (m || 0)
  }
  let menit = keMenit(selesai) - keMenit(mulai)
  if (menit < 0) menit += 24 * 60
  return menit / 60
}

// Laporan rekap kehadiran per karyawan untuk satu periode. Sumber data:
// attendance (Hadir/Terlambat/Hadir Libur + hari IZIN DATANG yang ikut kolom
// Hadir) + rekapHarian() TERPADU untuk Izin/Sakit/Cuti & Alpha — aturan persis
// sama dengan tabel Riwayat karyawan, sehingga angka laporan admin dan riwayat
// karyawan selalu cocok. `izinDatang` dilaporkan terpisah sebagai catatan.
// `employeeId` (opsional) membatasi laporan ke SATU karyawan — dipakai slip gaji
// karyawan agar rumusnya persis sama dengan tab Gaji di panel admin.
export async function laporanKehadiran({ dari, sampai, departemen, employeeId } = {}) {
  const hariIni = toISODate()
  const mulai = dari || `${hariIni.slice(0, 7)}-01` // default: awal bulan berjalan
  const selesai = sampai || hariIni
  // Hari kerja mengikuti pengaturan jadwal admin (mis. Senin–Jumat atau Senin–Sabtu),
  // dikurangi hari libur yang terdaftar (nasional/cuti bersama/khusus admin).
  const hariAktif = await hariKerjaAktif()
  const liburSet = await setTanggalLibur(mulai, selesai)
  const hariKerja = hitungHariKerja(mulai, selesai, hariAktif, liburSet)

  let sqlKaryawan = 'SELECT id, nama, nip, jabatan, departemen, status_karyawan FROM employees'
  const params = []
  const saring = []
  if (departemen) {
    saring.push("LOWER(COALESCE(departemen, '')) = LOWER(?)")
    params.push(departemen)
  }
  if (employeeId) {
    saring.push('id = ?')
    params.push(Number(employeeId))
  }
  if (saring.length) sqlKaryawan += ` WHERE ${saring.join(' AND ')}`
  sqlKaryawan += " ORDER BY COALESCE(departemen, ''), nama"
  const karyawan = await db.all(sqlKaryawan, params)

  const baris = []
  for (const e of karyawan) {
    const [att, lembur, rekap] = await Promise.all([
      db.get(
        `SELECT
           -- Hadir = datang TEPAT WAKTU + hari dengan IZIN DATANG (terlambat/siang):
           -- dua-duanya hari MASUK kerja (uang makan keduanya dibayar). Jumlah hari
           -- izin datang dilaporkan terpisah pada kolom izinDatang sebagai CATATAN,
           -- bukan kolom Izin — izin itu tidak berarti "tidak masuk".
           COALESCE(SUM(CASE WHEN status IN ('Hadir', ?, ?) AND COALESCE(hari_libur, 0) = 0 THEN 1 ELSE 0 END), 0) AS hadir,
           COALESCE(SUM(CASE WHEN status = 'Terlambat' AND COALESCE(hari_libur, 0) = 0 THEN 1 ELSE 0 END), 0) AS terlambat,
           COALESCE(SUM(CASE WHEN status IN ('Hadir','Terlambat') AND COALESCE(hari_libur, 0) = 1 THEN 1 ELSE 0 END), 0) AS hadirLibur,
           -- Catatan: berapa di antara hari Hadir di atas yang memakai izin datang.
           COALESCE(SUM(CASE WHEN status IN (?, ?) AND COALESCE(hari_libur, 0) = 0 THEN 1 ELSE 0 END), 0) AS izinDatang
         FROM attendance WHERE employee_id = ? AND tanggal >= ? AND tanggal <= ?`,
        [STATUS_IZIN_TERLAMBAT, STATUS_IZIN_SIANG_LAMA, STATUS_IZIN_TERLAMBAT, STATUS_IZIN_SIANG_LAMA, e.id, mulai, selesai],
      ),
      db.all(
        `SELECT jam_mulai, jam_selesai FROM overtime
         WHERE employee_id = ? AND status = 'Disetujui' AND tanggal >= ? AND tanggal <= ?`,
        [e.id, mulai, selesai],
      ),
      // Satu panggilan untuk izin/sakit/cuti + alpha dengan aturan riwayat.
      rekapHarian(e.id, mulai, selesai),
    ])

    // Izin/Sakit/Cuti = hari KERJA non-libur dari rekap terpadu (hari libur &
    // akhir pekan tidak lagi ikut terhitung seperti pada rumus lama). Hari IZIN
    // DATANG tidak pernah masuk sini — itu kehadiran (kolom Hadir).
    let izin = 0
    let sakit = 0
    let cuti = 0
    for (const k of rekap.kategori.values()) {
      if (k === 'Cuti') cuti++
      else if (k === 'Sakit') sakit++
      else izin++
    }
    const lemburJam = lembur.reduce((t, o) => t + selisihJam(o.jam_mulai, o.jam_selesai), 0)

    const hadir = att?.hadir || 0
    const terlambat = att?.terlambat || 0
    // Hari dengan izin datang (disetujui) SUDAH termasuk pada `hadir` di atas —
    // di sini hanya sebagai CATATAN berapa di antaranya, supaya angkanya bisa
    // ditampilkan di laporan/slip tanpa dihitung dua kali.
    const izinDatang = att?.izinDatang || 0
    // Absensi di luar hari kerja (mis. masuk hari Sabtu) dipisahkan agar tidak
    // menggelembungkan % kehadiran.
    const hadirLibur = att?.hadirLibur || 0
    // Kehadiran = Hadir (termasuk hari izin datang — karyawan memang masuk) + Terlambat.
    const masuk = hadir + terlambat
    // Alpha DIHITUNG LANGSUNG dari rekap terpadu (bukan rumus pengurangan) —
    // menghormati jejak pertama karyawan, hari libur, dan "hari ini sebelum
    // pulang" persis seperti yang tampil di halaman Riwayat karyawan.
    const alpha = rekap.alpha.length
    const persen = hariKerja ? Math.min(100, Math.round((masuk / hariKerja) * 100)) : 0
    baris.push({
      id: e.id,
      nama: e.nama,
      nip: e.nip || '-',
      jabatan: e.jabatan || '-',
      departemen: e.departemen || '-',
      statusKaryawan: e.status_karyawan || 'Karyawan Tetap',
      hadir,
      terlambat,
      hadirLibur,
      izinDatang,
      izin,
      sakit,
      cuti,
      alpha,
      lembur: Math.round(lemburJam * 10) / 10,
      lemburKali: lembur.length,
      hariKerja,
      persen,
    })
  }

  const total = (k) => baris.reduce((t, r) => t + r[k], 0)
  const targetHari = hariKerja * (baris.length || 1)
  return {
    dari: mulai,
    sampai: selesai,
    departemen: departemen || null,
    hariKerja,
    hariKerjaHari: hariAktif, // angka 0–6 (0 = Minggu) untuk label "Sen, Sel, …" di UI
    baris,
    ringkasan: {
      totalKaryawan: baris.length,
      hadir: total('hadir'),
      terlambat: total('terlambat'),
      hadirLibur: total('hadirLibur'),
      izinDatang: total('izinDatang'),
      izin: total('izin'),
      sakit: total('sakit'),
      cuti: total('cuti'),
      alpha: total('alpha'),
      lembur: Math.round(total('lembur') * 10) / 10,
      persen: targetHari ? Math.min(100, Math.round((total('hadir') + total('terlambat')) / targetHari * 100)) : 0,
    },
    rekap: rekapDepartemen(baris),
  }
}

// Rekap per departemen untuk tabel kedua di PDF/sheet Ringkasan.
export function rekapDepartemen(baris = []) {
  const grup = new Map()
  for (const r of baris) {
    const k = r.departemen || '-'
    if (!grup.has(k)) grup.set(k, { departemen: k, karyawan: 0, hadir: 0, terlambat: 0, hadirLibur: 0, izin: 0, sakit: 0, cuti: 0, alpha: 0, lembur: 0, target: 0, masuk: 0 })
    const g = grup.get(k)
    g.karyawan += 1
    g.hadir += r.hadir
    g.terlambat += r.terlambat
    g.hadirLibur += r.hadirLibur
    g.izin += r.izin
    g.sakit += r.sakit
    g.cuti += r.cuti
    g.alpha += r.alpha
    g.lembur += r.lembur
    g.target += r.hariKerja
    g.masuk += r.hadir + r.terlambat
  }
  return [...grup.values()]
    .map((g) => ({ ...g, lembur: Math.round(g.lembur * 10) / 10, persen: g.target ? Math.min(100, Math.round((g.masuk / g.target) * 100)) : 0 }))
    .sort((a, b) => a.departemen.localeCompare(b.departemen))
}

// ---------- Panel Admin: penghitung gaji ----------
// Gaji per karyawan untuk satu periode — dihitung dari laporan kehadiran yang
// sama + tarif per karyawan (diisi admin di tab Karyawan/Gaji):
//   • Hari Dibayar  = Hadir + Terlambat + Hadir Libur + Izin + Sakit + Cuti
//     (Hadir SUDAH termasuk hari dengan izin datang terlambat/siang; pengajuan
//     izin/sakit/cuti yang tidak ditolak juga tetap dibayar; Alpha tidak)
//   • Hari Uang Makan = semua hari Hadir (termasuk hari izin datang) + Hadir Libur.
//     Terlambat masuk TANPA izin TIDAK mendapat uang makan.
//     Izin/sakit/cuti biasa juga tidak mendapat uang makan.
//   • Lembur (Rp) = total jam lembur Disetujui × tarif lembur per jam
//   • Piket (Rp)  = jumlah piket Disetujui pada periode × biaya piket (pengaturan admin)
// `employeeId` (opsional) → slip gaji satu karyawan (dipakai aplikasi karyawan).
export async function laporanGaji({ dari, sampai, departemen, employeeId } = {}) {
  const dasar = await laporanKehadiran({ dari, sampai, departemen, employeeId })
  const tarif = await db.all('SELECT id, gaji_harian, uang_makan, tarif_lembur FROM employees')
  const peta = new Map(tarif.map((e) => [e.id, e]))
  const rupiah = (n) => Math.round(Number(n) || 0)
  // Biaya piket (pengaturan admin) + jumlah piket DISETUJUI per karyawan pada rentang ini.
  const biaya = await biayaPiket()
  const petaPiket = await hitungPiket(dasar.dari, dasar.sampai, employeeId)

  const baris = dasar.baris.map((r) => {
    const e = peta.get(r.id) || {}
    const gajiHarian = Number(e.gaji_harian ?? 0)
    const uangMakan = Number(e.uang_makan ?? 0)
    const tarifLembur = Number(e.tarif_lembur ?? 0)
    const hariDibayar = r.hadir + r.terlambat + r.hadirLibur + r.izin + r.sakit + r.cuti
    // Hari izin datang SUDAH termasuk pada r.hadir (laporan kehadiran) → TIDAK
    // ditambahkan lagi agar tidak dihitung dua kali; nilai ini hanya CATATAN.
    const izinDatang = r.izinDatang || 0
    // Uang makan = semua hari Hadir (termasuk hari izin datang) + Hadir Libur.
    // Terlambat TANPA izin tidak dapat uang makan.
    const hariMakan = r.hadir + r.hadirLibur
    const tanpaUangMakan = r.terlambat
    const subGaji = rupiah(hariDibayar * gajiHarian)
    const subMakan = rupiah(hariMakan * uangMakan)
    const subLembur = rupiah(r.lembur * tarifLembur)
    // Piket: jumlah piket disetujui dalam periode × biaya piket (pengaturan admin).
    const piket = petaPiket.get(r.id) || 0
    const subPiket = rupiah(piket * biaya)
    return {
      ...r,
      gajiHarian, uangMakan, tarifLembur,
      hariDibayar, hariMakan, tanpaUangMakan, izinDatang,
      // Nilai uang makan yang hilang karena telat — ditampilkan agar transparan.
      potonganUangMakan: rupiah(tanpaUangMakan * uangMakan),
      subGaji, subMakan, subLembur,
      piket, biayaPiket: biaya, subPiket,
      total: subGaji + subMakan + subLembur + subPiket,
    }
  })

  const total = (k) => baris.reduce((t, r) => t + r[k], 0)
  return {
    dari: dasar.dari,
    sampai: dasar.sampai,
    departemen: dasar.departemen,
    hariKerja: dasar.hariKerja,
    hariKerjaHari: dasar.hariKerjaHari,
    baris,
    ringkasan: {
      totalKaryawan: baris.length,
      hariDibayar: total('hariDibayar'),
      hariMakan: total('hariMakan'),
      izinDatang: total('izinDatang'),
      tanpaUangMakan: total('tanpaUangMakan'),
      potonganUangMakan: rupiah(total('potonganUangMakan')),
      lembur: Math.round(total('lembur') * 10) / 10,
      piket: total('piket'),
      biayaPiket: biaya,
      subGaji: rupiah(total('subGaji')),
      subMakan: rupiah(total('subMakan')),
      subLembur: rupiah(total('subLembur')),
      subPiket: rupiah(total('subPiket')),
      total: rupiah(total('total')),
    },
  }
}

// ---------- Periode penggajian ----------
// Admin menetapkan periode (mis. "Gaji September 2026") pada tab Gaji; slip gaji
// di aplikasi karyawan mengikuti periode yang sedang AKTIF.
function periodeToClient(row) {
  if (!row) return null
  return {
    id: row.id, nama: row.nama, dari: row.dari, sampai: row.sampai,
    aktif: !!row.aktif, dibuat: row.created_at || null,
  }
}

export async function listPeriodeGaji() {
  const rows = await db.all('SELECT * FROM payroll_periods ORDER BY dari DESC, id DESC')
  return rows.map(periodeToClient)
}

export async function periodeGajiAktif() {
  return periodeToClient(
    await db.get('SELECT * FROM payroll_periods WHERE aktif = 1 ORDER BY id DESC LIMIT 1'),
  )
}

// Periode yang rentangnya bertumpuk membuat SATU tanggal masuk ke DUA slip gaji
// (absensi & lembur bisa dibayar dua kali). Fungsi ini menemukan bentroknya.
export async function periodeBertumpuk({ dari, sampai, kecualiId = null } = {}) {
  const rows = await db.all('SELECT id, nama, dari, sampai FROM payroll_periods')
  return rows.filter((p) => p.id !== Number(kecualiId) && dari <= p.sampai && sampai >= p.dari)
}

// Tetapkan periode penggajian (langsung AKTIF). Rentang tanggal yang sama tidak
// diduplikasi — hanya namanya yang diperbarui. Rentang yang BERTUMPUK dengan
// periode lain ditolak (mengembalikan { error }) agar tidak ada pembayaran ganda.
export async function tetapkanPeriodeGaji({ nama, dari, sampai }) {
  const ada = await db.get('SELECT * FROM payroll_periods WHERE dari = ? AND sampai = ?', [dari, sampai])
  const bentrok = await periodeBertumpuk({ dari, sampai, kecualiId: ada?.id ?? null })
  if (bentrok.length) {
    const daftar = bentrok.map((p) => `"${p.nama}" (${p.dari} s.d. ${p.sampai})`).join(', ')
    return {
      error: `Periode ${dari} s.d. ${sampai} bertumpuk dengan ${daftar}. Periode penggajian tidak boleh bertumpuk karena satu tanggal akan masuk dua slip gaji (berisiko dibayar dua kali). Ubah tanggalnya, atau rapikan periode yang bertumpuk lebih dulu.`,
      bentrok,
    }
  }
  await db.run('UPDATE payroll_periods SET aktif = 0')
  if (ada) {
    await db.run('UPDATE payroll_periods SET nama = ?, aktif = 1 WHERE id = ?', [nama || ada.nama, ada.id])
    return periodeToClient(await db.get('SELECT * FROM payroll_periods WHERE id = ?', [ada.id]))
  }
  const info = await db.run(
    'INSERT INTO payroll_periods (nama, dari, sampai, aktif) VALUES (?, ?, ?, 1)',
    [nama, dari, sampai],
  )
  return periodeToClient(await db.get('SELECT * FROM payroll_periods WHERE id = ?', [info.lastInsertRowid]))
}

export async function aktifkanPeriodeGaji(id) {
  const ada = await db.get('SELECT id FROM payroll_periods WHERE id = ?', [id])
  if (!ada) return null
  await db.run('UPDATE payroll_periods SET aktif = 0')
  await db.run('UPDATE payroll_periods SET aktif = 1 WHERE id = ?', [id])
  return periodeToClient(await db.get('SELECT * FROM payroll_periods WHERE id = ?', [id]))
}

export async function hapusPeriodeGaji(id) {
  const info = await db.run('DELETE FROM payroll_periods WHERE id = ?', [id])
  return info.changes
}

// Rapikan periode yang bertumpuk: periode yang lebih dulu dipotong menjadi
// sehari SEBELUM periode berikutnya mulai, sehingga tanggal yang bertumpuk
// hanya dihitung sekali (milik periode TERBARU). Aman dijalankan berulang
// (idempoten) dan mengembalikan rincian perubahan untuk ditampilkan admin.
export async function rapikanPeriodeGaji() {
  const rows = await db.all('SELECT id, nama, dari, sampai FROM payroll_periods ORDER BY id')
  const urut = [...rows].sort((a, b) => a.dari.localeCompare(b.dari) || a.id - b.id)
  const kurangiHari = (tgl, n) => {
    const d = new Date(`${tgl}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - n)
    return d.toISOString().slice(0, 10)
  }
  const perubahan = []
  const dilewati = []
  for (const p of urut) {
    const berikut = urut.find((x) => x.dari > p.dari || (x.dari === p.dari && x.id > p.id))
    if (!berikut || p.sampai < berikut.dari) continue
    const sampaiBaru = kurangiHari(berikut.dari, 1)
    if (sampaiBaru < p.dari) {
      // Rentangnya seluruhnya tertelan periode berikutnya → butuh keputusan admin.
      dilewati.push({ id: p.id, nama: p.nama, dari: p.dari, sampai: p.sampai, bentrokDengan: berikut.nama })
      continue
    }
    await db.run('UPDATE payroll_periods SET sampai = ? WHERE id = ?', [sampaiBaru, p.id])
    perubahan.push({
      id: p.id, nama: p.nama, dari: p.dari,
      sampaiLama: p.sampai, sampaiBaru, bertumpukDengan: berikut.nama,
    })
  }
  return { perubahan, dilewati, periode: await listPeriodeGaji() }
}

// Slip gaji SATU karyawan untuk periode aktif (atau periode terpilih). Rumusnya
// memakai laporanGaji yang sama dengan panel admin → angka selalu konsisten.
export async function slipGajiKaryawan(employeeId, periodeId = null) {
  const periode = periodeId
    ? periodeToClient(await db.get('SELECT * FROM payroll_periods WHERE id = ?', [periodeId]))
    : await periodeGajiAktif()
  if (!periode) return null
  const lap = await laporanGaji({ dari: periode.dari, sampai: periode.sampai, employeeId })
  return {
    periode,
    slip: lap.baris[0] || null,
    hariKerja: lap.hariKerja,
    hariKerjaHari: lap.hariKerjaHari,
  }
}

// ---------- Panel Admin: notifikasi & pengumuman ----------
// Pengumuman dikelompokkan (1 kartu per grup) lengkap dengan hitungan
// sudah/belum dibaca dan nama yang belum membaca.
export async function listSemuaNotifikasi() {
  const rows = await db.all(
    `SELECT n.*, e.nama AS nama_karyawan FROM notifications n
     LEFT JOIN employees e ON e.id = n.employee_id
     ORDER BY n.id DESC LIMIT 400`,
  )

  const grup = new Map()
  const hasil = []
  for (const r of rows) {
    const nama = r.nama_karyawan || `Karyawan #${r.employee_id}`
    if (r.grup_id) {
      if (!grup.has(r.grup_id)) {
        const item = {
          grupId: r.grup_id, judul: r.judul, pesan: r.pesan || '', jenis: r.jenis || 'info',
          dibuat: r.created_at, total: 0, dibaca: 0, penerima: [], belumBaca: [],
        }
        grup.set(r.grup_id, item)
        hasil.push(item)
      }
      const item = grup.get(r.grup_id)
      item.total += 1
      item.penerima.push(nama)
      if (r.dibaca) item.dibaca += 1
      else item.belumBaca.push(nama)
    } else {
      hasil.push({ ...notifToClient(r), nama: r.employee_id ? nama : 'Semua karyawan' })
    }
  }
  return hasil
}

// Ubah isi pengumuman (semua penerima) — status baca direset agar semua
// penerima membacanya kembali.
export async function ubahPengumuman(grupId, { judul, pesan, jenis } = {}) {
  const sets = []
  const params = []
  if (judul !== undefined && judul !== '') { sets.push('judul = ?'); params.push(judul) }
  if (pesan !== undefined) { sets.push('pesan = ?'); params.push(pesan) }
  if (jenis !== undefined) { sets.push('jenis = ?'); params.push(jenis) }
  if (!sets.length) return null
  params.push(grupId)
  await db.run(`UPDATE notifications SET ${sets.join(', ')} WHERE grup_id = ?`, params)
  await db.run('UPDATE notifications SET dibaca = 0 WHERE grup_id = ?', [grupId])
  return (await listSemuaNotifikasi()).find((n) => n.grupId === grupId) || null
}

export async function hapusPengumuman(grupId) {
  const info = await db.run('DELETE FROM notifications WHERE grup_id = ?', [grupId])
  return info.changes
}

export async function hapusNotifikasi(id) {
  await db.run('DELETE FROM notifications WHERE id = ?', [id])
}

// ---------- Ringkasan dasbor admin ----------
export async function ringkasanAdmin() {
  const satu = async (sql, ...p) => (await db.get(sql, p))?.n ?? 0
  return {
    totalKaryawan: await satu('SELECT COUNT(*) AS n FROM employees'),
    hadirHariIni: await satu(
      `SELECT COUNT(*) AS n FROM attendance WHERE tanggal = ? AND status IN ('Hadir','Terlambat',?,?)`,
      toISODate(), ...STATUS_IZIN_DATANG,
    ),
    izinMenunggu: await satu(`SELECT COUNT(*) AS n FROM leaves WHERE status = 'Menunggu'`),
    lemburMenunggu: await satu(`SELECT COUNT(*) AS n FROM overtime WHERE status = 'Menunggu'`),
    piketMenunggu: await satu(`SELECT COUNT(*) AS n FROM piket WHERE status = 'Menunggu'`),
  }
}

// Tren kehadiran N hari terakhir (default 7) untuk grafik Ringkasan admin:
// per hari = masuk (Hadir+Terlambat) dari attendance, izin & alpha per karyawan
// dari rekapHarian TERPADU — aturan identik dengan riwayat karyawan, sehingga
// angka grafik admin tidak pernah menyimpang dari halaman Riwayat.
export async function trenKehadiran(hari = 7) {
  const hariIni = toISODate()
  const mulai = new Date(`${hariIni}T00:00:00Z`)
  mulai.setUTCDate(mulai.getUTCDate() - (Math.max(1, Number(hari) || 7) - 1))
  const t0 = toISODate(mulai)
  const aktif = new Set(await hariKerjaAktif())
  const liburSet = await setTanggalLibur(t0, hariIni)
  const totalKaryawan = (await db.get('SELECT COUNT(*) AS n FROM employees'))?.n ?? 0
  const att = await db.all(
    'SELECT tanggal, status, COALESCE(hari_libur, 0) AS hari_libur FROM attendance WHERE tanggal >= ? AND tanggal <= ?',
    [t0, hariIni],
  )
  // Alpha & izin per tanggal dihitung per karyawan lewat rekap terpadu —
  // bukan rumus "total − masuk − izin" yang bisa salah hitung.
  const alphaPerTanggal = new Map()
  const izinPerTanggal = new Map()
  for (const k of (await db.all('SELECT id FROM employees'))) {
    const r = await rekapHarian(k.id, t0, hariIni)
    for (const t of r.alpha) alphaPerTanggal.set(t, (alphaPerTanggal.get(t) || 0) + 1)
    for (const t of r.kategori.keys()) izinPerTanggal.set(t, (izinPerTanggal.get(t) || 0) + 1)
  }
  const baris = []
  for (const d = new Date(`${t0}T00:00:00Z`); toISODate(d) <= hariIni; d.setUTCDate(d.getUTCDate() + 1)) {
    const tanggal = toISODate(d)
    const hariKerja = aktif.has(d.getUTCDay()) && !liburSet.has(tanggal)
    const masuk = att.filter((r) => r.tanggal === tanggal && ['Hadir', 'Terlambat', ...STATUS_IZIN_DATANG].includes(r.status) && !r.hari_libur).length
    const izin = hariKerja ? (izinPerTanggal.get(tanggal) || 0) : 0
    const alpha = hariKerja ? (alphaPerTanggal.get(tanggal) || 0) : 0
    baris.push({ tanggal, masuk, izin, alpha, hariKerja })
  }
  return { dari: t0, sampai: hariIni, totalKaryawan, baris }
}

// ---------- Absensi karyawan ----------
export function getToday(employeeId = 1) {
  return db.get('SELECT * FROM attendance WHERE employee_id = ? AND tanggal = ?', [employeeId, toISODate()])
}

// Status absensi yang TIDAK otomatis dianggap Hadir karena jamnya tidak wajar
// (mis. check-in 03:11 untuk jadwal masuk 09:00) — menunggu tinjauan admin.
// Hari dengan status ini belum dihitung sebagai hari dibayar.
export const STATUS_PERLU_TINJAUAN = 'Perlu Tinjauan'

// Toleransi datang lebih awal: check-in lebih dari 4 jam sebelum jam masuk
// (atau setelah jam pulang) dianggap tidak wajar.
export const TOLERANSI_AWAL_MENIT = 240

const keMenit = (jam) => {
  const [h, m] = String(jam || '').split(':').map(Number)
  return (Number(h) || 0) * 60 + (Number(m) || 0)
}

// Hitung status absensi dari jam check-in + jadwal efektif. SATU sumber aturan:
// dipakai saat check-in, saat memulihkan status (mis. izin ditolak), dan saat
// memeriksa data lama — sehingga hasilnya mustahil berbeda antar jalur.
export function hitungStatusAbsen(jadwal, jam) {
  const { jamMasukBatas, jamPulang, shiftNama } = jadwal || {}
  // Mode 'biasa' tidak punya jam "mulai" terpisah → acuannya batas jam masuk.
  const jamMulaiKerja = jadwal?.jamMasuk || jamMasukBatas
  const terlaluAwal = keMenit(jam) < keMenit(jamMulaiKerja) - TOLERANSI_AWAL_MENIT
  const lewatJamPulang = keMenit(jam) > keMenit(jamPulang)
  const tidakWajar = terlaluAwal || lewatJamPulang
  const status = tidakWajar ? STATUS_PERLU_TINJAUAN : String(jam) > String(jamMasukBatas) ? 'Terlambat' : 'Hadir'
  const tugas = shiftNama ? ` (${shiftNama})` : ''
  const alasan = tidakWajar
    ? terlaluAwal
      ? `Jam absen tidak wajar: ${jam} — jauh sebelum jam masuk ${jamMulaiKerja}${tugas}. Perlu ditinjau admin.`
      : `Jam absen tidak wajar: ${jam} — setelah jam pulang ${jamPulang}. Perlu ditinjau admin.`
    : status === 'Terlambat'
      ? `Check-in melewati batas ${jamMasukBatas}${tugas}`
      : ''
  return { status, alasan, terlaluAwal, lewatJamPulang, tidakWajar }
}

export async function catatCheckIn({ employeeId = 1, lokasi = {}, selfieUrl = null } = {}) {
  const tanggal = toISODate()
  const jam = jamSekarang()
  // Jadwal EFEKTIF milik karyawan ini: mode 'biasa' memakai jadwal induk, mode
  // 'shift' mengikuti shift (1/2) yang ditetapkan admin → batas Terlambat ikut shift.
  const jadwal = await getJadwal(employeeId)
  const { status: statusJam, alasan: alasanJam } = hitungStatusAbsen(jadwal, jam)
  // Absensi di luar hari kerja atau pada HARI LIBUR yang terdaftar ditandai agar
  // laporan tidak menghitungnya sebagai hari kerja biasa (Hadir Libur).
  const aktif = await hariKerjaAktif()
  const libur = await db.get('SELECT nama FROM holidays WHERE tanggal = ?', [tanggal])
  const diLuarJadwal = !aktif.includes(new Date(`${tanggal}T00:00:00Z`).getUTCDay())
  const hariLibur = libur || diLuarJadwal ? 1 : 0
  // Izin "datang terlambat/siang" yang SUDAH DISETUJUI untuk hari ini: keterlambatan
  // TIDAK menghapus uang makan — status memakai status izin datang.
  const izinDatang = hariLibur
    ? null
    : await db.get(
        `SELECT id, jenis FROM leaves WHERE employee_id = ? AND status = 'Disetujui'
           AND jenis IN (?, ?) AND mulai <= ? AND selesai >= ? ORDER BY mulai ASC LIMIT 1`,
        [employeeId, ...JENIS_IZIN_DATANG, tanggal, tanggal],
      )
  const statusIzinDatang = izinDatang && statusJam === 'Terlambat' ? statusDariJenisIzin(izinDatang.jenis) : null
  const status = statusIzinDatang || statusJam
  const keterangan = statusIzinDatang
    ? `${izinDatang.jenis} (disetujui): check-in ${jam} — uang makan tetap diberikan`
    : libur
      ? `Libur: ${libur.nama}`
      : diLuarJadwal
        ? 'Absensi di luar hari kerja'
        : alasanJam

  // Geofence: hitung jarak ke kantor pusat (authoritative di server).
  let diLuar = null
  let jarak = null
  if (lokasi.lat != null && lokasi.lon != null) {
    jarak = Math.round(haversineM(lokasi.lat, lokasi.lon, KANTOR.lat, KANTOR.lon))
    diLuar = jarak > KANTOR.radiusM ? 1 : 0
  }

  await db.run(
    `INSERT INTO attendance (employee_id, tanggal, check_in, status, keterangan, lat, lon, alamat, selfie, di_luar_area, jarak, hari_libur)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (employee_id, tanggal) DO UPDATE SET
       check_in = excluded.check_in, status = excluded.status, keterangan = excluded.keterangan,
       lat = excluded.lat, lon = excluded.lon, alamat = excluded.alamat, selfie = excluded.selfie,
       di_luar_area = excluded.di_luar_area, jarak = excluded.jarak, hari_libur = excluded.hari_libur`,
    [
      employeeId, tanggal, jam, status, keterangan,
      lokasi.lat ?? null, lokasi.lon ?? null, lokasi.alamat ?? null, selfieUrl, diLuar, jarak, hariLibur,
    ],
  )
  return getToday(employeeId)
}

export async function catatCheckOut({ employeeId = 1, lokasi = {}, selfieUrl = null } = {}) {
  const existing = await getToday(employeeId)
  if (!existing?.check_in) return { error: 'Belum check-in hari ini.' }
  if (existing.check_out) return { error: 'Sudah check-out hari ini.' }
  // Geofence untuk absen pulang dihitung terpisah — data masuk TIDAK disentuh,
  // sehingga jam masuk + detail + foto masuk tetap tersimpan utuh di riwayat.
  let diLuar = null
  let jarak = null
  if (lokasi.lat != null && lokasi.lon != null) {
    jarak = Math.round(haversineM(lokasi.lat, lokasi.lon, KANTOR.lat, KANTOR.lon))
    diLuar = jarak > KANTOR.radiusM ? 1 : 0
  }
  await db.run(
    `UPDATE attendance SET check_out = ?, lat_out = ?, lon_out = ?,
       alamat_out = COALESCE(?, alamat_out), selfie_out = COALESCE(?, selfie_out),
       di_luar_area_out = ?, jarak_out = ?
     WHERE employee_id = ? AND tanggal = ?`,
    [
      jamSekarang(), lokasi.lat ?? null, lokasi.lon ?? null,
      lokasi.alamat ?? null, selfieUrl, diLuar, jarak, employeeId, existing.tanggal,
    ],
  )
  return getToday(employeeId)
}

// Izin/cuti AKTIF hari ini (Disetujui, rentangnya mencakup tanggal sekarang) —
// dipakai Beranda untuk menandai bahwa karyawan sedang cuti/izin sehingga
// tidak perlu absen dan hari itu tidak dihitung Alpha.
export async function izinAktifHariIni(employeeId) {
  const hariIni = toISODate()
  const rows = await db.all(
    `SELECT id, jenis, mulai, selesai, keterangan, status FROM leaves
     WHERE employee_id = ? AND status = 'Disetujui' AND mulai <= ? AND selesai >= ?
     ORDER BY mulai ASC LIMIT 1`,
    [employeeId, hariIni, hariIni],
  )
  const l = rows[0]
  if (!l) return null
  return {
    id: l.id,
    jenis: l.jenis,
    mulai: l.mulai,
    selesai: l.selesai,
    keterangan: l.keterangan || '',
  }
}

// Rekap harian TERPADU per karyawan — SUMBER KEBENARAN TUNGGAL yang dipakai
// laporan admin, tren ringkasan, dan riwayat karyawan supaya angkanya SELALU
// cocok. Mengembalikan:
//   alpha    : [tanggal…] hari kerja tanpa absen, tanpa izin non-ditolak,
//              setelah jejak pertama karyawan, dan (untuk hari ini) setelah
//              jam pulang — aturan identik dengan tabel riwayat.
//   kategori : Map(tanggal → 'Izin'|'Sakit'|'Cuti') hari KERJA non-libur yang
//              tertutup pengajuan non-ditolak ATAU absensi berstatus Izin.
//              "Absen menang": hari dengan absensi Hadir/Terlambat TIDAK
//              dihitung izin agar tidak terhitung dua kali.
//              Hari dengan absensi IZIN DATANG (terlambat/siang) juga TIDAK
//              masuk kategori ini — itu kehadiran (dihitung Hadir), bukan izin.
//              Baris absensi di luar kehadiran (mis. status 'Alpha' yang dicatat
//              admin) BUKAN kehadiran → hari itu tetap dihitung Alpha.
export async function rekapHarian(employeeId, mulai, selesai) {
  const kosong = { alpha: [], kategori: new Map() }
  if (mulai > selesai) return kosong
  const hariIni = toISODate()
  const { jamPulang } = await getJadwal(employeeId)
  const hariAktif = new Set(await hariKerjaAktif())
  const liburSet = await setTanggalLibur(mulai, selesai)

  // Anti-alpha-fiktif: tanpa satu pun jejak (absensi/pengajuan) jangan mengarang.
  const jejak = await db.get(
    `SELECT MIN(t) AS awal FROM (
       SELECT MIN(tanggal) AS t FROM attendance WHERE employee_id = ?
       UNION ALL SELECT MIN(mulai) AS t FROM leaves WHERE employee_id = ?
     )`,
    [employeeId, employeeId],
  )
  if (!jejak?.awal) return kosong
  const batasAwal = jejak.awal > mulai ? jejak.awal : mulai
  if (batasAwal > selesai) return kosong

  const absen = new Map(
    (await db.all(
      'SELECT tanggal, status FROM attendance WHERE employee_id = ? AND tanggal >= ? AND tanggal <= ?',
      [employeeId, batasAwal, selesai],
    )).map((r) => [r.tanggal, r.status]),
  )
  const pengajuan = await db.all(
    `SELECT jenis, mulai, selesai FROM leaves
     WHERE employee_id = ? AND status <> 'Ditolak' AND mulai <= ? AND selesai >= ?`,
    [employeeId, selesai, batasAwal],
  )

  const alpha = []
  const kategori = new Map()
  for (let d = new Date(`${batasAwal}T00:00:00Z`); toISODate(d) <= selesai; d.setUTCDate(d.getUTCDate() + 1)) {
    const tanggal = toISODate(d)
    if (!hariAktif.has(d.getUTCDay())) continue // bukan hari kerja
    if (liburSet.has(tanggal)) continue // hari libur terdaftar
    const st = absen.get(tanggal)
    // Izin datang (terlambat/siang) = KEHADIRAN, bukan izin "tidak masuk":
    // karyawan tetap masuk kerja, hanya jam masuknya lewat. Dihitung HADIR (gaji
    // harian + uang makan dibayar) dan TIDAK pernah masuk keranjang Izin — sumber
    // kebenarannya STATUS ABSENSI, bukan pengajuan. Hari dengan izin datang tetapi
    // tanpa absensi tetap Alpha (lihat catatan di bawah), sehingga izin ini tidak
    // bisa "menutup" hari dari rekap.
    if (STATUS_IZIN_DATANG.includes(st)) continue
    // Izin biasa = hari kerja tertutup pengajuan izin sehingga tidak pernah jatuh
    // menjadi Alpha.
    if (st === 'Izin') { kategori.set(tanggal, 'Izin'); continue }
    // Kehadiran nyata (Hadir/Terlambat, termasuk hasil absen di hari libur).
    if (st === 'Hadir' || st === 'Terlambat' || st === 'Hadir Libur') continue
    // Baris absensi lain (mis. admin mencatat status 'Alpha') BUKAN kehadiran:
    // hari itu tetap dihitung Alpha agar laporan & riwayat tidak berbeda —
    // kecuali tanggalnya tertutup pengajuan izin/cuti/sakit non-ditolak.
    // Pengajuan IZIN DATANG dikecualikan: izin itu tidak berarti "tidak masuk",
    // jadi tidak boleh mengubah hari tanpa absensi menjadi Izin.
    const l = pengajuan.find(
      (x) => x.mulai <= tanggal && tanggal <= x.selesai && !JENIS_IZIN_DATANG.includes(x.jenis),
    )
    if (l) {
      const j = (l.jenis || '').toLowerCase()
      kategori.set(tanggal, j.startsWith('cuti') ? 'Cuti' : j.startsWith('sakit') ? 'Sakit' : 'Izin')
      continue
    }
    if (tanggal === hariIni && jamSekarang() < jamPulang) continue // hari belum berakhir
    alpha.push(tanggal)
  }
  return { alpha, kategori }
}

// Tanggal Alpha untuk riwayat karyawan (default 31 hari terakhir) — kini hanya
// pembungkus tipis di atas rekapHarian sehingga riwayat & laporan mustahil beda.
export async function tanggalAlpha(employeeId, dari, sampai) {
  const hariIni = toISODate()
  const mundur = new Date(`${hariIni}T00:00:00Z`)
  mundur.setUTCDate(mundur.getUTCDate() - 31)
  const mulai = dari || toISODate(mundur)
  const selesai = sampai || hariIni
  if (mulai > selesai) return []
  const { alpha } = await rekapHarian(employeeId, mulai, selesai)
  return alpha
}

// Riwayat gabungan: catatan absensi + pengajuan izin + ALPHA otomatis.
// Semua baris memakai bentuk RINGKAS (tanpa base64 selfie/lampiran) agar daftar
// riwayat & dashboard tetap ringan; media diambil saat detail dibuka.
export async function listHistory({ dari, sampai, status } = {}, employeeId = 1) {
  let sql = 'SELECT * FROM attendance WHERE employee_id = ?'
  const params = [employeeId]
  if (dari) { sql += ' AND tanggal >= ?'; params.push(dari) }
  if (sampai) { sql += ' AND tanggal <= ?'; params.push(sampai) }
  const absensi = (await db.all(sql, params)).map((r) => ({ ...toClientRingkas(r), sumber: 'absensi' }))

  let sqlL = 'SELECT * FROM leaves WHERE employee_id = ?'
  const paramsL = [employeeId]
  // Filter OVERLAP rentang (bukan "mulai di dalam rentang") — pengajuan yang
  // dimulai sebelum rentang tapi masih berjalan TETAP tampil.
  if (dari) { sqlL += ' AND selesai >= ?'; paramsL.push(dari) }
  if (sampai) { sqlL += ' AND mulai <= ?'; paramsL.push(sampai) }
  // `sumber: 'izin'` menandai baris TURUNAN dari pengajuan izin (bukan catatan
  // absensi). Dipakai Dashboard untuk statistik, namun disaring keluar oleh
  // halaman Riwayat (bottom-nav) yang khusus menampilkan riwayat absensi saja —
  // riwayat pengajuan izin kini ada di halaman Izin/Cuti.
  //
  // SATU BARIS PER HARI KERJA (bukan per pengajuan) supaya statistik pekan di
  // Beranda cocok dengan Laporan admin (cuti 3 hari = 3 baris). Hari punya
  // absensi (absen menang) dan hari non-kerja/libur tidak dibuat baris —
  // aturan identik dengan rekapHarian() di sisi server.
  const hariAktifL = new Set(await hariKerjaAktif())
  const absenHari = new Set(
    (await db.all(
      'SELECT tanggal FROM attendance WHERE employee_id = ?' +
      (dari ? ' AND tanggal >= ?' : '') + (sampai ? ' AND tanggal <= ?' : ''),
      [employeeId, ...(dari ? [dari] : []), ...(sampai ? [sampai] : [])],
    )).map((r) => r.tanggal),
  )
  const izin = []
  for (const l of await db.all(sqlL, paramsL)) {
    const aw = dari && l.mulai < dari ? dari : l.mulai
    const ak = sampai && l.selesai > sampai ? sampai : l.selesai
    for (let d = new Date(`${aw}T00:00:00Z`); toISODate(d) <= ak; d.setUTCDate(d.getUTCDate() + 1)) {
      const t = toISODate(d)
      if (!hariAktifL.has(d.getUTCDay())) continue // bukan hari kerja
      if (absenHari.has(t)) continue // absen menang — jangan ganda
      izin.push({
        id: `izin-${l.id}-${t}`, tanggal: t, checkIn: '-', checkOut: '-', status: 'Izin',
        keterangan: `${l.jenis}: ${l.keterangan || ''} (pengajuan ${l.status})`,
        lokasi: null, selfie: null, adaSelfie: false,
        lampiran: null, adaLampiran: !!l.lampiran,
        lokasiPulang: null, selfiePulang: null, adaSelfiePulang: false, diLuarAreaPulang: null, jarakPulang: null,
        sumber: 'izin',
      })
    }
  }

  const alpha = (await tanggalAlpha(employeeId, dari, sampai))
    // Tanggal yang sudah punya baris absensi TIDAK dibuatkan baris Alpha otomatis:
    // baris absensi itu sendiri sudah tampil di riwayat (mis. berstatus 'Alpha'),
    // sehingga riwayat tidak pernah menampilkan dua baris untuk tanggal yang sama.
    .filter((t) => !absenHari.has(t))
    .map((tanggal) => ({
    id: `alpha-${tanggal}`, tanggal, checkIn: null, checkOut: null, status: 'Alpha',
    keterangan: 'Tanpa absen masuk & pulang — tercatat Alpha otomatis',
    lokasi: null, selfie: null, adaSelfie: false, lampiran: null, adaLampiran: false,
    diLuarArea: null, jarak: null, hariLibur: false,
    lokasiPulang: null, selfiePulang: null, adaSelfiePulang: false, diLuarAreaPulang: null, jarakPulang: null,
    sumber: 'alpha',
  }))

  let merged = [...absensi, ...izin, ...alpha]
  if (status && status !== 'Semua') merged = merged.filter((r) => r.status === status)
  return merged.sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)))
}

// ---------- Pengajuan izin / cuti ----------
export async function createLeave({ employeeId = 1, jenis, mulai, selesai, keterangan = '', lampiran = null }) {
  const info = await db.run(
    `INSERT INTO leaves (employee_id, jenis, mulai, selesai, keterangan, lampiran)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [employeeId, jenis, mulai, selesai, keterangan, lampiran],
  )
  // Simpan id pengajuan SEBELUM ada operasi lain (id harus pasti).
  const id = info.lastInsertRowid

  // Konfirmasi ke kotak masuk karyawan (sejajar dengan pengajuan lembur) supaya
  // jejak pengajuan selalu terlihat walau halaman ditutup.
  await kirimNotifikasi({
    employeeId,
    judul: '📝 Pengajuan izin/cuti terkirim',
    pesan: `${jenis} ${mulai} s.d. ${selesai} sedang menunggu persetujuan admin.`,
    jenis: 'izin',
  })

  // Jika rentang izin mencakup hari ini → status kehadiran hari ini menjadi "Izin".
  // KHUSUS IZIN DATANG (terlambat/siang): baris absensi TIDAK dibuat — izin ini
  // bukan "tidak masuk", melainkan izin datang lewat jam batas. Hari itu dihitung
  // HADIR hanya bila karyawan benar-benar ABSEN (setelah disetujui admin, status
  // absensinya naik ke 'Izin Terlambat' lewat terapkanIzinDatang()). Tanpa absensi,
  // hari tersebut tidak ditutup sebagai Izin — rekap kehadiran membacanya dari
  // tabel absensi, bukan dari pengajuan.
  // ABSEN MENANG: bila karyawan sudah check-in hari ini, status kehadirannya TIDAK
  // ditimpa — supaya jam masuk tetap benar walau pengajuan nanti ditolak.
  const hariIni = toISODate()
  const izinDatang = JENIS_IZIN_DATANG.includes(jenis)
  if (!izinDatang && mulai <= hariIni && hariIni <= selesai) {
    const ada = await db.get(
      'SELECT check_in FROM attendance WHERE employee_id = ? AND tanggal = ?',
      [employeeId, hariIni],
    )
    if (!ada?.check_in) {
      await db.run(
        `INSERT INTO attendance (employee_id, tanggal, status, keterangan) VALUES (?, ?, 'Izin', ?)
         ON CONFLICT (employee_id, tanggal) DO UPDATE SET status = 'Izin', keterangan = excluded.keterangan`,
        [employeeId, hariIni, `${jenis}: ${keterangan}`],
      )
    }
  }
  return db.get('SELECT * FROM leaves WHERE id = ?', [id])
}

export async function listLeaves(employeeId = 1) {
  const rows = await db.all(
    'SELECT * FROM leaves WHERE employee_id = ? ORDER BY created_at DESC, id DESC LIMIT 200',
    [employeeId],
  )
  return rows.map(leaveToClient)
}

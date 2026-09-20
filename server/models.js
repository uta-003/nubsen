import crypto from 'node:crypto'
import { db, KANTOR, hashPin, getJadwal, hariKerjaAktif, HARI_KERJA_DEFAULT } from './db.js'
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

export function leaveToClient(row) {
  if (!row) return null
  return {
    id: row.id, jenis: row.jenis, mulai: row.mulai, selesai: row.selesai,
    keterangan: row.keterangan || '', lampiran: row.lampiran || null, status: row.status,
    // Waktu pengajuan dibuat — ditampilkan pada Riwayat Pengajuan Izin/Cuti.
    dibuat: row.created_at || null,
    // Alasan penolakan (bila status Ditolak) — tampil di riwayat & notifikasi.
    alasanTolak: row.alasan_tolak || '',
  }
}

// Status kepegawaian yang diakui sistem (dipilih admin pada form Karyawan).
export const STATUS_KARYAWAN = ['Karyawan Tetap', 'Karyawan Kontrak']

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

export async function buatLembur({ employeeId, tanggal, jamMulai, jamSelesai, keterangan = '' }) {
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
export const JENIS_PENGUMUMAN = ['pengumuman', 'penting', 'info']

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

export async function listNotifikasi(employeeId) {
  const items = (
    await db.all(
      'SELECT * FROM notifications WHERE employee_id = ? OR employee_id IS NULL ORDER BY id DESC LIMIT 50',
      [employeeId],
    )
  ).map(notifToClient)
  return { items, belumDibaca: items.filter((n) => !n.dibaca).length }
}

export async function tandaiSemuaDibaca(employeeId) {
  await db.run(
    'UPDATE notifications SET dibaca = 1 WHERE dibaca = 0 AND (employee_id = ? OR employee_id IS NULL)',
    [employeeId],
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
    `INSERT INTO employees (nama, nip, jabatan, departemen, email, telepon, lokasi_kerja, cuti_tahunan, is_admin, pin_hash, gaji_harian, uang_makan, tarif_lembur, status_karyawan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.nama, d.nip || null, d.jabatan || null, d.departemen || null, d.email,
      d.telepon || null, d.lokasiKerja || null, d.cutiTahunan ?? 12, d.isAdmin ? 1 : 0,
      hashPin(d.pin || '123456'),
      Number(d.gajiHarian ?? 0) || 0, Number(d.uangMakan ?? 0) || 0, Number(d.tarifLembur ?? 0) || 0,
      statusKaryawanSah(d.statusKaryawan),
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
  for (const sql of [
    'DELETE FROM attendance WHERE employee_id = ?',
    'DELETE FROM leaves WHERE employee_id = ?',
    'DELETE FROM overtime WHERE employee_id = ?',
    'DELETE FROM notifications WHERE employee_id = ?',
    'DELETE FROM sessions WHERE employee_id = ?',
    'DELETE FROM employees WHERE id = ?',
  ]) {
    await db.run(sql, [id])
  }
}

// ---------- Panel Admin: kelola absensi ----------
const ABSENSI_JOIN = 'SELECT a.*, e.nama AS nama_karyawan FROM attendance a JOIN employees e ON e.id = a.employee_id'

export async function listSemuaAbsensi({ employeeId, dari, sampai } = {}) {
  let sql = ABSENSI_JOIN + ' WHERE 1=1'
  const params = []
  if (employeeId) { sql += ' AND a.employee_id = ?'; params.push(employeeId) }
  if (dari) { sql += ' AND a.tanggal >= ?'; params.push(dari) }
  if (sampai) { sql += ' AND a.tanggal <= ?'; params.push(sampai) }
  const rows = await db.all(sql + ' ORDER BY a.tanggal DESC, a.id DESC LIMIT 200', params)
  return rows.map((r) => ({ ...toClient(r), nama: r.nama_karyawan }))
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
    'SELECT l.*, e.nama AS nama_karyawan FROM leaves l JOIN employees e ON e.id = l.employee_id ORDER BY l.id DESC',
  )
  return rows.map((l) => ({ ...leaveToClient(l), nama: l.nama_karyawan }))
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
  await db.run('DELETE FROM leaves WHERE id = ?', [id])
}

// ---------- Panel Admin: kelola lembur ----------
export async function listSemuaLembur() {
  const rows = await db.all(
    'SELECT o.*, e.nama AS nama_karyawan FROM overtime o JOIN employees e ON e.id = o.employee_id ORDER BY o.id DESC',
  )
  return rows.map((o) => ({ ...lemburToClient(o), nama: o.nama_karyawan }))
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
// ---------- Panel Admin: laporan kehadiran (export Excel/PDF) ----------
// Hari kerja = hari yang aktif pada pengaturan jadwal (default Senin–Jumat) dalam
// rentang [dari..sampai] inklusif. Hari libur nasional tidak dikurangkan otomatis —
// admin cukup menyesuaikan periode laporan.
function hitungHariKerja(dari, sampai, hariAktif = HARI_KERJA_DEFAULT) {
  const mulai = new Date(`${dari}T00:00:00Z`)
  const akhir = new Date(`${sampai}T00:00:00Z`)
  if (Number.isNaN(mulai.getTime()) || Number.isNaN(akhir.getTime()) || mulai > akhir) return 0
  const aktif = new Set(hariAktif)
  let n = 0
  for (let d = new Date(mulai); d <= akhir; d.setUTCDate(d.getUTCDate() + 1)) {
    if (aktif.has(d.getUTCDay())) n += 1
  }
  return n
}

// Jumlah hari tumpang-tindih rentang [a..b] dengan [mulai..selesai] (string ISO).
function hariTumpangTindih(a, b, mulai, selesai) {
  const dariS = a > mulai ? a : mulai
  const sampaiS = b < selesai ? b : selesai
  const ms = new Date(`${sampaiS}T00:00:00Z`) - new Date(`${dariS}T00:00:00Z`)
  return ms < 0 ? 0 : Math.round(ms / 86400000) + 1
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
// attendance (Hadir/Terlambat), leaves (Izin/Sakit/Cuti, bukan Ditolak, dipotong
// tepi rentang), overtime Disetujui (total jam). Alpha = hari kerja − masuk − izin.
// `employeeId` (opsional) membatasi laporan ke SATU karyawan — dipakai slip gaji
// karyawan agar rumusnya persis sama dengan tab Gaji di panel admin.
export async function laporanKehadiran({ dari, sampai, departemen, employeeId } = {}) {
  const hariIni = toISODate()
  const mulai = dari || `${hariIni.slice(0, 7)}-01` // default: awal bulan berjalan
  const selesai = sampai || hariIni
  // Hari kerja mengikuti pengaturan jadwal admin (mis. Senin–Jumat atau Senin–Sabtu).
  const hariAktif = await hariKerjaAktif()
  const hariKerja = hitungHariKerja(mulai, selesai, hariAktif)

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
    const [att, leaves, lembur] = await Promise.all([
      db.get(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'Hadir' AND COALESCE(hari_libur, 0) = 0 THEN 1 ELSE 0 END), 0) AS hadir,
           COALESCE(SUM(CASE WHEN status = 'Terlambat' AND COALESCE(hari_libur, 0) = 0 THEN 1 ELSE 0 END), 0) AS terlambat,
           COALESCE(SUM(CASE WHEN status IN ('Hadir','Terlambat') AND COALESCE(hari_libur, 0) = 1 THEN 1 ELSE 0 END), 0) AS hadirLibur,
           COALESCE(SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END), 0) AS izin
         FROM attendance WHERE employee_id = ? AND tanggal >= ? AND tanggal <= ?`,
        [e.id, mulai, selesai],
      ),
      db.all(
        `SELECT jenis, mulai, selesai FROM leaves
         WHERE employee_id = ? AND status <> 'Ditolak' AND mulai <= ? AND selesai >= ?`,
        [e.id, selesai, mulai],
      ),
      db.all(
        `SELECT jam_mulai, jam_selesai FROM overtime
         WHERE employee_id = ? AND status = 'Disetujui' AND tanggal >= ? AND tanggal <= ?`,
        [e.id, mulai, selesai],
      ),
    ])

    let izin = att?.izin || 0 // hari berstatus izin yang tercatat langsung di absensi
    let sakit = 0
    let cuti = 0
    for (const l of leaves) {
      const hari = hariTumpangTindih(l.mulai, l.selesai, mulai, selesai)
      const jenis = (l.jenis || '').toLowerCase()
      if (jenis.startsWith('cuti')) cuti += hari
      else if (jenis.startsWith('sakit')) sakit += hari
      else izin += hari
    }
    const lemburJam = lembur.reduce((t, o) => t + selisihJam(o.jam_mulai, o.jam_selesai), 0)

    const hadir = att?.hadir || 0
    const terlambat = att?.terlambat || 0
    // Absensi di luar hari kerja (mis. masuk hari Sabtu) dipisahkan agar tidak
    // menggelembungkan % kehadiran.
    const hadirLibur = att?.hadirLibur || 0
    const masuk = hadir + terlambat
    const alpha = Math.max(0, hariKerja - masuk - izin - sakit - cuti)
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
//     (pengajuan izin/sakit/cuti yang tidak ditolak tetap dibayar; Alpha tidak)
//   • Hari Uang Makan = hanya hari masuk TEPAT WAKTU (Hadir + Hadir Libur).
//     Terlambat masuk TIDAK mendapat uang makan; izin/sakit/cuti juga tidak.
//   • Lembur (Rp) = total jam lembur Disetujui × tarif lembur per jam
// `employeeId` (opsional) → slip gaji satu karyawan (dipakai aplikasi karyawan).
export async function laporanGaji({ dari, sampai, departemen, employeeId } = {}) {
  const dasar = await laporanKehadiran({ dari, sampai, departemen, employeeId })
  const tarif = await db.all('SELECT id, gaji_harian, uang_makan, tarif_lembur FROM employees')
  const peta = new Map(tarif.map((e) => [e.id, e]))
  const rupiah = (n) => Math.round(Number(n) || 0)

  const baris = dasar.baris.map((r) => {
    const e = peta.get(r.id) || {}
    const gajiHarian = Number(e.gaji_harian ?? 0)
    const uangMakan = Number(e.uang_makan ?? 0)
    const tarifLembur = Number(e.tarif_lembur ?? 0)
    const hariDibayar = r.hadir + r.terlambat + r.hadirLibur + r.izin + r.sakit + r.cuti
    // Terlambat TIDAK dapat uang makan (gaji hariannya tetap dibayar).
    const hariMakan = r.hadir + r.hadirLibur
    const tanpaUangMakan = r.terlambat
    const subGaji = rupiah(hariDibayar * gajiHarian)
    const subMakan = rupiah(hariMakan * uangMakan)
    const subLembur = rupiah(r.lembur * tarifLembur)
    return {
      ...r,
      gajiHarian, uangMakan, tarifLembur,
      hariDibayar, hariMakan, tanpaUangMakan,
      // Nilai uang makan yang hilang karena telat — ditampilkan agar transparan.
      potonganUangMakan: rupiah(tanpaUangMakan * uangMakan),
      subGaji, subMakan, subLembur,
      total: subGaji + subMakan + subLembur,
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
      tanpaUangMakan: total('tanpaUangMakan'),
      potonganUangMakan: rupiah(total('potonganUangMakan')),
      lembur: Math.round(total('lembur') * 10) / 10,
      subGaji: rupiah(total('subGaji')),
      subMakan: rupiah(total('subMakan')),
      subLembur: rupiah(total('subLembur')),
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

// Tetapkan periode penggajian (langsung AKTIF). Rentang tanggal yang sama tidak
// diduplikasi — hanya namanya yang diperbarui.
export async function tetapkanPeriodeGaji({ nama, dari, sampai }) {
  const ada = await db.get('SELECT * FROM payroll_periods WHERE dari = ? AND sampai = ?', [dari, sampai])
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
      `SELECT COUNT(*) AS n FROM attendance WHERE tanggal = ? AND status IN ('Hadir','Terlambat')`,
      toISODate(),
    ),
    izinMenunggu: await satu(`SELECT COUNT(*) AS n FROM leaves WHERE status = 'Menunggu'`),
    lemburMenunggu: await satu(`SELECT COUNT(*) AS n FROM overtime WHERE status = 'Menunggu'`),
  }
}

// ---------- Absensi karyawan ----------
export function getToday(employeeId = 1) {
  return db.get('SELECT * FROM attendance WHERE employee_id = ? AND tanggal = ?', [employeeId, toISODate()])
}

export async function catatCheckIn({ employeeId = 1, lokasi = {}, selfieUrl = null } = {}) {
  const tanggal = toISODate()
  const jam = jamSekarang()
  const { jamMasukBatas } = await getJadwal() // jadwal aktif dari settings (admin bisa ubah)
  const status = jam > jamMasukBatas ? 'Terlambat' : 'Hadir'
  // Absensi di luar hari kerja ditandai agar laporan tidak menghitungnya sebagai
  // hari kerja (mis. masuk hari Sabtu pada perusahaan Senin–Jumat).
  const aktif = await hariKerjaAktif()
  const hariLibur = aktif.includes(new Date(`${tanggal}T00:00:00Z`).getUTCDay()) ? 0 : 1
  const keterangan = hariLibur
    ? 'Absensi di luar hari kerja'
    : status === 'Terlambat' ? `Check-in melewati batas ${jamMasukBatas}` : ''

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

// Riwayat gabungan: catatan absensi + pengajuan izin yang sudah disetujui masuk list.
export async function listHistory({ dari, sampai, status } = {}, employeeId = 1) {
  let sql = 'SELECT * FROM attendance WHERE employee_id = ?'
  const params = [employeeId]
  if (dari) { sql += ' AND tanggal >= ?'; params.push(dari) }
  if (sampai) { sql += ' AND tanggal <= ?'; params.push(sampai) }
  const absensi = (await db.all(sql, params)).map((r) => ({ ...toClient(r), sumber: 'absensi' }))

  let sqlL = 'SELECT * FROM leaves WHERE employee_id = ?'
  const paramsL = [employeeId]
  if (dari) { sqlL += ' AND mulai >= ?'; paramsL.push(dari) }
  if (sampai) { sqlL += ' AND mulai <= ?'; paramsL.push(sampai) }
  // `sumber: 'izin'` menandai baris TURUNAN dari pengajuan izin (bukan catatan
  // absensi). Dipakai Dashboard untuk statistik, namun disaring keluar oleh
  // halaman Riwayat (bottom-nav) yang khusus menampilkan riwayat absensi saja —
  // riwayat pengajuan izin kini ada di halaman Izin/Cuti.
  const izin = (await db.all(sqlL, paramsL)).map((l) => ({
    tanggal: l.mulai, checkIn: '-', checkOut: '-', status: 'Izin',
    keterangan: `${l.jenis}: ${l.keterangan || ''} (pengajuan ${l.status})`,
    lokasi: null, selfie: null, lampiran: l.lampiran || null,
    lokasiPulang: null, selfiePulang: null, diLuarAreaPulang: null, jarakPulang: null,
    sumber: 'izin',
  }))

  let merged = [...absensi, ...izin]
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
  const hariIni = toISODate()
  if (mulai <= hariIni && hariIni <= selesai) {
    await db.run(
      `INSERT INTO attendance (employee_id, tanggal, status, keterangan) VALUES (?, ?, 'Izin', ?)
       ON CONFLICT (employee_id, tanggal) DO UPDATE SET status = 'Izin', keterangan = excluded.keterangan`,
      [employeeId, hariIni, `${jenis}: ${keterangan}`],
    )
  }
  return db.get('SELECT * FROM leaves WHERE id = ?', [id])
}

export async function listLeaves(employeeId = 1) {
  const rows = await db.all(
    'SELECT * FROM leaves WHERE employee_id = ? ORDER BY created_at DESC, id DESC',
    [employeeId],
  )
  return rows.map(leaveToClient)
}

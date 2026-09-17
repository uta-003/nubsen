import crypto from 'node:crypto'
import { db, KANTOR, hashPin, getJadwal } from './db.js'
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
    lokasi: row.lat == null ? null : { lat: row.lat, lon: row.lon, alamat: row.alamat || null },
    selfie: row.selfie || null,
    lampiran: row.lampiran || null,
    diLuarArea: row.di_luar_area == null ? null : !!row.di_luar_area,
    jarak: row.jarak ?? null,
  }
}

export function leaveToClient(row) {
  if (!row) return null
  return {
    id: row.id, jenis: row.jenis, mulai: row.mulai, selesai: row.selesai,
    keterangan: row.keterangan || '', lampiran: row.lampiran || null, status: row.status,
  }
}

// ---------- Karyawan ----------
function employeeById(id) {
  const e = db.prepare('SELECT * FROM employees WHERE id = ?').get(id)
  if (!e) return null
  const cutiTahunan = e.cuti_tahunan ?? 12
  const cutiTerpakai = Math.round(
    db.prepare(
      `SELECT COALESCE(SUM(julianday(selesai) - julianday(mulai) + 1), 0) AS hari
       FROM leaves WHERE employee_id = ? AND jenis LIKE 'Cuti%' AND status <> 'Ditolak'`,
    ).get(id).hari,
  )
  return {
    id: e.id, nama: e.nama, nip: e.nip, jabatan: e.jabatan, departemen: e.departemen,
    email: e.email, telepon: e.telepon, lokasiKerja: e.lokasi_kerja,
    cutiTahunan, sisaCuti: Math.max(0, cutiTahunan - cutiTerpakai),
    isAdmin: !!e.is_admin,
  }
}

export function getEmployee(id = 1) {
  return employeeById(id)
}

// ---------- Autentikasi (sesi token sederhana) ----------
export function login(email, pin) {
  const e = db.prepare('SELECT * FROM employees WHERE LOWER(email) = LOWER(?)').get(String(email).trim())
  if (!e || !e.pin_hash || e.pin_hash !== hashPin(pin)) return null
  const token = crypto.randomBytes(24).toString('hex')
  db.prepare('INSERT INTO sessions (token, employee_id) VALUES (?, ?)').run(token, e.id)
  return { token, karyawan: employeeById(e.id) }
}

export function logout(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

export function employeeByToken(token) {
  if (!token) return null
  const s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token)
  return s ? employeeById(s.employee_id) : null
}

// ---------- Lembur ----------
function lemburToClient(row) {
  if (!row) return null
  return {
    id: row.id, tanggal: row.tanggal, jamMulai: row.jam_mulai, jamSelesai: row.jam_selesai,
    keterangan: row.keterangan || '', status: row.status,
  }
}
export { lemburToClient }

export function buatLembur({ employeeId, tanggal, jamMulai, jamSelesai, keterangan = '' }) {
  const info = db.prepare(
    `INSERT INTO overtime (employee_id, tanggal, jam_mulai, jam_selesai, keterangan) VALUES (?, ?, ?, ?, ?)`,
  ).run(employeeId, tanggal, jamMulai, jamSelesai, keterangan)
  // Ambil id baris lembur SEBELUM mengirim notifikasi (last_insert_rowid akan berubah).
  const id = Number(info.lastInsertRowid)
  kirimNotifikasi({
    employeeId,
    judul: '⏰ Pengajuan lembur terkirim',
    pesan: `Lembur ${tanggal} pukul ${jamMulai}-${jamSelesai} sedang menunggu persetujuan admin.`,
    jenis: 'lembur',
  })
  return lemburToClient(db.prepare('SELECT * FROM overtime WHERE id = ?').get(id))
}

export function listLembur(employeeId) {
  return db.prepare('SELECT * FROM overtime WHERE employee_id = ? ORDER BY id DESC').all(employeeId).map(lemburToClient)
}

// ---------- Notifikasi ----------
export function notifToClient(row) {
  return {
    id: row.id, employeeId: row.employee_id, judul: row.judul, pesan: row.pesan || '',
    jenis: row.jenis || 'info', grupId: row.grup_id || null,
    dibaca: !!row.dibaca, dibuat: row.created_at,
  }
}

export function kirimNotifikasi({ employeeId = null, judul, pesan = '', jenis = 'info' }) {
  const info = db
    .prepare('INSERT INTO notifications (employee_id, judul, pesan, jenis) VALUES (?, ?, ?, ?)')
    .run(employeeId, judul, pesan, jenis)
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(Number(info.lastInsertRowid))
}

// Pengumuman/pemberitahuan dari admin → satu baris PER karyawan (fan-out) supaya
// setiap orang punya status "dibaca" sendiri, dan admin bisa memantau siapa yang belum baca.
export const JENIS_PENGUMUMAN = ['pengumuman', 'penting', 'info']

export function kirimPengumuman({ judul, pesan = '', jenis = 'pengumuman', employeeIds = null }) {
  const target = Array.isArray(employeeIds) && employeeIds.length
    ? employeeIds.map(Number)
    : db.prepare('SELECT id FROM employees ORDER BY id').all().map((e) => e.id)
  const grupId = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const insert = db.prepare(
    'INSERT INTO notifications (employee_id, judul, pesan, jenis, grup_id) VALUES (?, ?, ?, ?, ?)',
  )
  for (const id of target) insert.run(id, judul, pesan, jenis, grupId)
  return { grupId, jumlah: target.length }
}

export function listNotifikasi(employeeId) {
  const items = db
    .prepare('SELECT * FROM notifications WHERE employee_id = ? OR employee_id IS NULL ORDER BY id DESC LIMIT 50')
    .all(employeeId)
    .map(notifToClient)
  return { items, belumDibaca: items.filter((n) => !n.dibaca).length }
}

export function tandaiSemuaDibaca(employeeId) {
  db.prepare('UPDATE notifications SET dibaca = 1 WHERE dibaca = 0 AND (employee_id = ? OR employee_id IS NULL)').run(employeeId)
}
// ---------- Panel Admin ----------
export function listKaryawan() {
  return db.prepare('SELECT * FROM employees ORDER BY id').all().map((e) => ({
    id: e.id, nama: e.nama, nip: e.nip, jabatan: e.jabatan, departemen: e.departemen,
    email: e.email, telepon: e.telepon, lokasiKerja: e.lokasi_kerja,
    cutiTahunan: e.cuti_tahunan ?? 12, isAdmin: !!e.is_admin,
  }))
}

export function buatKaryawan(d) {
  db.prepare(
    `INSERT INTO employees (nama, nip, jabatan, departemen, email, telepon, lokasi_kerja, cuti_tahunan, is_admin, pin_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    d.nama, d.nip || null, d.jabatan || null, d.departemen || null, d.email,
    d.telepon || null, d.lokasiKerja || null, d.cutiTahunan ?? 12, d.isAdmin ? 1 : 0,
    hashPin(d.pin || '123456'),
  )
  return listKaryawan().at(-1)
}

export function ubahKaryawan(id, d) {
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
  if (d.isAdmin !== undefined) { sets.push('is_admin = ?'); params.push(d.isAdmin ? 1 : 0) }
  if (d.pin) { sets.push('pin_hash = ?'); params.push(hashPin(d.pin)) }
  if (sets.length) {
    params.push(id)
    db.prepare(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }
  return employeeById(id)
}

export function hapusKaryawan(id) {
  for (const sql of [
    'DELETE FROM attendance WHERE employee_id = ?',
    'DELETE FROM leaves WHERE employee_id = ?',
    'DELETE FROM overtime WHERE employee_id = ?',
    'DELETE FROM notifications WHERE employee_id = ?',
    'DELETE FROM sessions WHERE employee_id = ?',
    'DELETE FROM employees WHERE id = ?',
  ]) {
    db.prepare(sql).run(id)
  }
}
const ABSENSI_JOIN = 'SELECT a.*, e.nama AS nama_karyawan FROM attendance a JOIN employees e ON e.id = a.employee_id'
export function listSemuaAbsensi({ employeeId, dari, sampai } = {}) {
  let sql = ABSENSI_JOIN + ' WHERE 1=1'
  const params = []
  if (employeeId) { sql += ' AND a.employee_id = ?'; params.push(employeeId) }
  if (dari) { sql += ' AND a.tanggal >= ?'; params.push(dari) }
  if (sampai) { sql += ' AND a.tanggal <= ?'; params.push(sampai) }
  return db.prepare(sql + ' ORDER BY a.tanggal DESC, a.id DESC LIMIT 200').all(...params)
    .map((r) => ({ ...toClient(r), nama: r.nama_karyawan }))
}

export function ubahAbsensi(id, { checkIn, checkOut, status } = {}) {
  const sets = []
  const params = []
  if (checkIn !== undefined) { sets.push('check_in = ?'); params.push(checkIn || null) }
  if (checkOut !== undefined) { sets.push('check_out = ?'); params.push(checkOut || null) }
  if (status !== undefined) { sets.push('status = ?'); params.push(status) }
  if (sets.length) {
    params.push(id)
    db.prepare(`UPDATE attendance SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }
  return toClient(db.prepare('SELECT * FROM attendance WHERE id = ?').get(id))
}

export function hapusAbsensi(id) {
  db.prepare('DELETE FROM attendance WHERE id = ?').run(id)
}
export function listSemuaIzin() {
  return db
    .prepare('SELECT l.*, e.nama AS nama_karyawan FROM leaves l JOIN employees e ON e.id = l.employee_id ORDER BY l.id DESC')
    .all()
    .map((l) => ({ ...leaveToClient(l), nama: l.nama_karyawan }))
}

export function setStatusIzin(id, status) {
  const l = db.prepare('SELECT * FROM leaves WHERE id = ?').get(id)
  if (!l) return null
  db.prepare('UPDATE leaves SET status = ? WHERE id = ?').run(status, id)
  kirimNotifikasi({
    employeeId: l.employee_id,
    judul: status === 'Disetujui' ? '✅ Izin/cuti disetujui' : '❌ Izin/cuti ditolak',
    pesan: `Pengajuan ${l.jenis} (${l.mulai} s.d. ${l.selesai}) telah ${status.toLowerCase()} oleh admin.`,
    jenis: 'izin',
  })
  return { ...leaveToClient(db.prepare('SELECT * FROM leaves WHERE id = ?').get(id)), nama: l.nama_karyawan }
}

export function hapusIzin(id) {
  db.prepare('DELETE FROM leaves WHERE id = ?').run(id)
}
export function listSemuaLembur() {
  return db
    .prepare('SELECT o.*, e.nama AS nama_karyawan FROM overtime o JOIN employees e ON e.id = o.employee_id ORDER BY o.id DESC')
    .all()
    .map((o) => ({ ...lemburToClient(o), nama: o.nama_karyawan }))
}

export function setStatusLembur(id, status) {
  const o = db.prepare('SELECT * FROM overtime WHERE id = ?').get(id)
  if (!o) return null
  db.prepare('UPDATE overtime SET status = ? WHERE id = ?').run(status, id)
  kirimNotifikasi({
    employeeId: o.employee_id,
    judul: status === 'Disetujui' ? '✅ Lembur disetujui' : '❌ Lembur ditolak',
    pesan: `Lembur ${o.tanggal} (${o.jam_mulai}-${o.jam_selesai}) telah ${status.toLowerCase()} oleh admin.`,
    jenis: 'lembur',
  })
  return { ...lemburToClient(db.prepare('SELECT * FROM overtime WHERE id = ?').get(id)), nama: o.nama_karyawan }
}

export function hapusLembur(id) {
  db.prepare('DELETE FROM overtime WHERE id = ?').run(id)
}

// Daftar notifikasi untuk panel admin: pengumuman dikelompokkan (1 kartu per grup)
// lengkap dengan hitungan sudah/belum dibaca dan nama yang belum membaca.
export function listSemuaNotifikasi() {
  const rows = db
    .prepare(
      `SELECT n.*, e.nama AS nama_karyawan FROM notifications n
       LEFT JOIN employees e ON e.id = n.employee_id
       ORDER BY n.id DESC LIMIT 400`,
    )
    .all()

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
      hasil.push({
        ...notifToClient(r),
        nama: r.employee_id ? nama : 'Semua karyawan',
      })
    }
  }
  return hasil
}

// Ubah isi pengumuman (semua penerima) — status baca direset agar semua membacanya lagi.
export function ubahPengumuman(grupId, { judul, pesan, jenis } = {}) {
  const sets = []
  const params = []
  if (judul !== undefined && judul !== '') { sets.push('judul = ?'); params.push(judul) }
  if (pesan !== undefined) { sets.push('pesan = ?'); params.push(pesan) }
  if (jenis !== undefined) { sets.push('jenis = ?'); params.push(jenis) }
  if (!sets.length) return null
  params.push(grupId)
  db.prepare(`UPDATE notifications SET ${sets.join(', ')} WHERE grup_id = ?`).run(...params)
  db.prepare('UPDATE notifications SET dibaca = 0 WHERE grup_id = ?').run(grupId)
  return listSemuaNotifikasi().find((n) => n.grupId === grupId) || null
}

export function hapusPengumuman(grupId) {
  const info = db.prepare('DELETE FROM notifications WHERE grup_id = ?').run(grupId)
  return Number(info.changes)
}

export function hapusNotifikasi(id) {
  db.prepare('DELETE FROM notifications WHERE id = ?').run(id)
}

export function ringkasanAdmin() {
  const satu = (sql, ...p) => db.prepare(sql).get(...p).n
  return {
    totalKaryawan: satu('SELECT COUNT(*) AS n FROM employees'),
    hadirHariIni: satu(`SELECT COUNT(*) AS n FROM attendance WHERE tanggal = ? AND status IN ('Hadir','Terlambat')`, toISODate()),
    izinMenunggu: satu(`SELECT COUNT(*) AS n FROM leaves WHERE status = 'Menunggu'`),
    lemburMenunggu: satu(`SELECT COUNT(*) AS n FROM overtime WHERE status = 'Menunggu'`),
  }
}





// ---------- Absensi ----------
export function getToday(employeeId = 1) {
  return db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND tanggal = ?').get(employeeId, toISODate())
}

export function catatCheckIn({ employeeId = 1, lokasi = {}, selfieUrl = null } = {}) {
  const tanggal = toISODate()
  const jam = jamSekarang()
  const { jamMasukBatas } = getJadwal() // jadwal aktif dari settings (dapat diubah admin)
  const status = jam > jamMasukBatas ? 'Terlambat' : 'Hadir'
  const keterangan = status === 'Terlambat' ? `Check-in melewati batas ${jamMasukBatas}` : ''

  // Geofence: hitung jarak ke kantor pusat (authoritative di server).
  let diLuar = null
  let jarak = null
  if (lokasi.lat != null && lokasi.lon != null) {
    jarak = Math.round(haversineM(lokasi.lat, lokasi.lon, KANTOR.lat, KANTOR.lon))
    diLuar = jarak > KANTOR.radiusM ? 1 : 0
  }

  db.prepare(
    `INSERT INTO attendance (employee_id, tanggal, check_in, status, keterangan, lat, lon, alamat, selfie, di_luar_area, jarak)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (employee_id, tanggal) DO UPDATE SET
       check_in = excluded.check_in, status = excluded.status, keterangan = excluded.keterangan,
       lat = excluded.lat, lon = excluded.lon, alamat = excluded.alamat, selfie = excluded.selfie,
       di_luar_area = excluded.di_luar_area, jarak = excluded.jarak`,
  ).run(employeeId, tanggal, jam, status, keterangan,
    lokasi.lat ?? null, lokasi.lon ?? null, lokasi.alamat ?? null, selfieUrl, diLuar, jarak)
  return getToday(employeeId)
}

export function catatCheckOut({ employeeId = 1, lokasi = {}, selfieUrl = null } = {}) {
  const existing = getToday(employeeId)
  if (!existing?.check_in) return { error: 'Belum check-in hari ini.' }
  if (existing.check_out) return { error: 'Sudah check-out hari ini.' }
  db.prepare(
    `UPDATE attendance SET check_out = ?, lat = ?, lon = ?,
       alamat = COALESCE(?, alamat), selfie = COALESCE(?, selfie)
     WHERE employee_id = ? AND tanggal = ?`,
  ).run(jamSekarang(), lokasi.lat ?? null, lokasi.lon ?? null,
    lokasi.alamat ?? null, selfieUrl, employeeId, existing.tanggal)
  return getToday(employeeId)
}

// Riwayat gabungan: catatan absensi + pengajuan izin yang sudah disetujui masuk list.
export function listHistory({ dari, sampai, status } = {}, employeeId = 1) {
  let sql = 'SELECT * FROM attendance WHERE employee_id = ?'
  const params = [employeeId]
  if (dari) { sql += ' AND tanggal >= ?'; params.push(dari) }
  if (sampai) { sql += ' AND tanggal <= ?'; params.push(sampai) }
  const absensi = db.prepare(sql).all(...params).map(toClient)

  let sqlL = 'SELECT * FROM leaves WHERE employee_id = ?'
  const paramsL = [employeeId]
  if (dari) { sqlL += ' AND mulai >= ?'; paramsL.push(dari) }
  if (sampai) { sqlL += ' AND mulai <= ?'; paramsL.push(sampai) }
  const izin = db.prepare(sqlL).all(...paramsL).map((l) => ({
    tanggal: l.mulai, checkIn: '-', checkOut: '-', status: 'Izin',
    keterangan: `${l.jenis}: ${l.keterangan || ''} (pengajuan ${l.status})`,
    lokasi: null, selfie: null, lampiran: l.lampiran || null,
  }))

  let merged = [...absensi, ...izin]
  if (status && status !== 'Semua') merged = merged.filter((r) => r.status === status)
  return merged.sort((a, b) => b.tanggal.localeCompare(a.tanggal))
}

// ---------- Pengajuan Izin ----------
export function createLeave({ employeeId = 1, jenis, mulai, selesai, keterangan = '', lampiran = null }) {
  const info = db.prepare(
    `INSERT INTO leaves (employee_id, jenis, mulai, selesai, keterangan, lampiran)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(employeeId, jenis, mulai, selesai, keterangan, lampiran)
  // Simpan id pengajuan SEBELUM ada INSERT lain (last_insert_rowid akan berubah).
  const id = Number(info.lastInsertRowid)

  // Jika rentang izin mencakup hari ini → status kehadiran hari ini menjadi "Izin".
  const hariIni = toISODate()
  if (mulai <= hariIni && hariIni <= selesai) {
    db.prepare(
      `INSERT INTO attendance (employee_id, tanggal, status, keterangan) VALUES (?, ?, 'Izin', ?)
       ON CONFLICT (employee_id, tanggal) DO UPDATE SET status = 'Izin', keterangan = excluded.keterangan`,
    ).run(employeeId, hariIni, `${jenis}: ${keterangan}`)
  }
  return db.prepare('SELECT * FROM leaves WHERE id = ?').get(id)
}

export function listLeaves(employeeId = 1) {
  return db.prepare('SELECT * FROM leaves WHERE employee_id = ? ORDER BY created_at DESC, id DESC')
    .all(employeeId).map(leaveToClient)
}

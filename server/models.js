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
async function employeeById(id) {
  const e = await db.get('SELECT * FROM employees WHERE id = ?', [id])
  if (!e) return null
  const cutiTahunan = e.cuti_tahunan ?? 12
  const jumlah = await db.get(
    `SELECT COALESCE(SUM(julianday(selesai) - julianday(mulai) + 1), 0) AS hari
     FROM leaves WHERE employee_id = ? AND jenis LIKE 'Cuti%' AND status <> 'Ditolak'`,
    [id],
  )
  const cutiTerpakai = Math.round(jumlah?.hari || 0)
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
  }))
}

export async function buatKaryawan(d) {
  const info = await db.run(
    `INSERT INTO employees (nama, nip, jabatan, departemen, email, telepon, lokasi_kerja, cuti_tahunan, is_admin, pin_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.nama, d.nip || null, d.jabatan || null, d.departemen || null, d.email,
      d.telepon || null, d.lokasiKerja || null, d.cutiTahunan ?? 12, d.isAdmin ? 1 : 0,
      hashPin(d.pin || '123456'),
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

export async function setStatusIzin(id, status) {
  const l = await db.get(
    'SELECT l.*, e.nama AS nama_karyawan FROM leaves l LEFT JOIN employees e ON e.id = l.employee_id WHERE l.id = ?',
    [id],
  )
  if (!l) return null
  await db.run('UPDATE leaves SET status = ? WHERE id = ?', [status, id])
  await kirimNotifikasi({
    employeeId: l.employee_id,
    judul: status === 'Disetujui' ? '✅ Izin/cuti disetujui' : '❌ Izin/cuti ditolak',
    pesan: `Pengajuan ${l.jenis} (${l.mulai} s.d. ${l.selesai}) telah ${status.toLowerCase()} oleh admin.`,
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

export async function setStatusLembur(id, status) {
  const o = await db.get(
    'SELECT o.*, e.nama AS nama_karyawan FROM overtime o LEFT JOIN employees e ON e.id = o.employee_id WHERE o.id = ?',
    [id],
  )
  if (!o) return null
  await db.run('UPDATE overtime SET status = ? WHERE id = ?', [status, id])
  await kirimNotifikasi({
    employeeId: o.employee_id,
    judul: status === 'Disetujui' ? '✅ Lembur disetujui' : '❌ Lembur ditolak',
    pesan: `Lembur ${o.tanggal} (${o.jam_mulai}-${o.jam_selesai}) telah ${status.toLowerCase()} oleh admin.`,
    jenis: 'lembur',
  })
  return { ...lemburToClient(await db.get('SELECT * FROM overtime WHERE id = ?', [id])), nama: o.nama_karyawan }
}

export async function hapusLembur(id) {
  await db.run('DELETE FROM overtime WHERE id = ?', [id])
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
  const keterangan = status === 'Terlambat' ? `Check-in melewati batas ${jamMasukBatas}` : ''

  // Geofence: hitung jarak ke kantor pusat (authoritative di server).
  let diLuar = null
  let jarak = null
  if (lokasi.lat != null && lokasi.lon != null) {
    jarak = Math.round(haversineM(lokasi.lat, lokasi.lon, KANTOR.lat, KANTOR.lon))
    diLuar = jarak > KANTOR.radiusM ? 1 : 0
  }

  await db.run(
    `INSERT INTO attendance (employee_id, tanggal, check_in, status, keterangan, lat, lon, alamat, selfie, di_luar_area, jarak)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (employee_id, tanggal) DO UPDATE SET
       check_in = excluded.check_in, status = excluded.status, keterangan = excluded.keterangan,
       lat = excluded.lat, lon = excluded.lon, alamat = excluded.alamat, selfie = excluded.selfie,
       di_luar_area = excluded.di_luar_area, jarak = excluded.jarak`,
    [
      employeeId, tanggal, jam, status, keterangan,
      lokasi.lat ?? null, lokasi.lon ?? null, lokasi.alamat ?? null, selfieUrl, diLuar, jarak,
    ],
  )
  return getToday(employeeId)
}

export async function catatCheckOut({ employeeId = 1, lokasi = {}, selfieUrl = null } = {}) {
  const existing = await getToday(employeeId)
  if (!existing?.check_in) return { error: 'Belum check-in hari ini.' }
  if (existing.check_out) return { error: 'Sudah check-out hari ini.' }
  await db.run(
    `UPDATE attendance SET check_out = ?, lat = ?, lon = ?,
       alamat = COALESCE(?, alamat), selfie = COALESCE(?, selfie)
     WHERE employee_id = ? AND tanggal = ?`,
    [
      jamSekarang(), lokasi.lat ?? null, lokasi.lon ?? null,
      lokasi.alamat ?? null, selfieUrl, employeeId, existing.tanggal,
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
  const absensi = (await db.all(sql, params)).map(toClient)

  let sqlL = 'SELECT * FROM leaves WHERE employee_id = ?'
  const paramsL = [employeeId]
  if (dari) { sqlL += ' AND mulai >= ?'; paramsL.push(dari) }
  if (sampai) { sqlL += ' AND mulai <= ?'; paramsL.push(sampai) }
  const izin = (await db.all(sqlL, paramsL)).map((l) => ({
    tanggal: l.mulai, checkIn: '-', checkOut: '-', status: 'Izin',
    keterangan: `${l.jenis}: ${l.keterangan || ''} (pengajuan ${l.status})`,
    lokasi: null, selfie: null, lampiran: l.lampiran || null,
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

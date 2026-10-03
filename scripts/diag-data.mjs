// Diagnostik baca-saja: karyawan, periode gaji, pengaturan, & absensi.
// Pemakaian: node scripts/diag-data.mjs [bagian-nama-karyawan]
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const argDb = process.argv.find((a) => a.startsWith('--db='))
const dbPath = argDb
  ? argDb.slice(5)
  : path.join(__dirname, '..', 'server', 'data', 'absensi.db')
const db = new DatabaseSync(dbPath)
const cari = process.argv.slice(2).filter((a) => !a.startsWith('--db=')).join(' ')

const j = (label, data) => console.log(`\n===== ${label} =====\n` + JSON.stringify(data, null, 1))

j('KARYAWAN', db.prepare('SELECT * FROM employees ORDER BY id').all())

j('PERIODE GAJI', db.prepare('SELECT * FROM payroll_periods ORDER BY id').all())

j('SETTINGS', db.prepare('SELECT key, value FROM settings ORDER BY key').all())

j('HARI LIBUR', db.prepare('SELECT * FROM holidays ORDER BY tanggal').all())

j('REKAP ABSENSI PER KARYAWAN', db.prepare(
  `SELECT e.id, e.nama,
          SUM(CASE WHEN a.status='Hadir' THEN 1 ELSE 0 END) AS hadir,
          SUM(CASE WHEN a.status='Terlambat' THEN 1 ELSE 0 END) AS terlambat,
          SUM(CASE WHEN a.status='Alpha' THEN 1 ELSE 0 END) AS alpha,
          SUM(CASE WHEN a.status='Izin' THEN 1 ELSE 0 END) AS izin,
          SUM(CASE WHEN a.status LIKE 'Izin %' THEN 1 ELSE 0 END) AS izinDatang,
          COUNT(a.id) AS totalBaris, MIN(a.tanggal) AS dari, MAX(a.tanggal) AS sampai
   FROM employees e LEFT JOIN attendance a ON a.employee_id = e.id
   GROUP BY e.id ORDER BY e.id`).all())

if (cari) {
  const k = db.prepare('SELECT * FROM employees WHERE nama LIKE ?').all(`%${cari}%`)
  j('KARYAWAN DICARI', k.map((r) => ({ id: r.id, nama: r.nama })))
  for (const row of k) {
    j(`ABSENSI #${row.id} ${row.nama}`, db.prepare(
      `SELECT id, tanggal, check_in, check_out, status, keterangan, hari_libur, created_at
       FROM attendance WHERE employee_id = ? ORDER BY tanggal`).all(row.id))
    j(`IZIN #${row.id}`, db.prepare(
      `SELECT id, jenis, mulai, selesai, status, keterangan FROM leaves WHERE employee_id = ? ORDER BY mulai`).all(row.id))
    j(`LEMBUR #${row.id}`, db.prepare(
      `SELECT id, tanggal, jam_mulai, jam_selesai, status, keterangan FROM overtime WHERE employee_id = ? ORDER BY tanggal`).all(row.id))
    j(`PIKET #${row.id}`, db.prepare(
      `SELECT id, tanggal, jam_mulai, jam_selesai, status FROM piket WHERE employee_id = ? ORDER BY tanggal`).all(row.id))
  }
}

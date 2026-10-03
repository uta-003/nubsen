// Diagnostik Turso (baca-saja): karyawan, periode gaji, pengaturan, absensi.
// Pemakaian: node scripts/diag-turso-data.mjs [--db=file:...] [bagian-nama-karyawan]
// Kredensial diambil dari env (mis. node --env-file=<path>).
import { createClient } from '@libsql/client/web'

const url = (process.env.TURSO_DATABASE_URL || '').trim()
const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim()
if (!url || !authToken) {
  console.error('TURSO_DATABASE_URL / TURSO_AUTH_TOKEN kosong — jalankan dengan --env-file=<berkas .env>')
  process.exit(1)
}
console.log('DB:', url.replace(/\/\/.*@/, '//'))
const db = createClient({ url, authToken })

const all = async (sql, args = []) => (await db.execute({ sql, args })).rows
const j = async (label, sql, args = []) => {
  try {
    console.log(`\n===== ${label} =====\n` + JSON.stringify(await all(sql, args), null, 1))
  } catch (e) {
    console.log(`\n===== ${label} ===== GAGAL: ${e.message}`)
  }
}

const argDb = process.argv.find((a) => a.startsWith('--db='))
if (argDb) { /* dukung file: lokal nanti bila perlu */ }
const cari = process.argv.slice(2).filter((a) => !a.startsWith('--')).join(' ')

await j('KARYAWAN', 'SELECT * FROM employees ORDER BY id')
await j('PERIODE GAJI', 'SELECT * FROM payroll_periods ORDER BY id')
await j('SETTINGS', 'SELECT key, value FROM settings ORDER BY key')

await j('REKAP ABSENSI PER KARYAWAN', `
  SELECT e.id, e.nama,
          SUM(CASE WHEN a.status='Hadir' THEN 1 ELSE 0 END) AS hadir,
          SUM(CASE WHEN a.status='Terlambat' THEN 1 ELSE 0 END) AS terlambat,
          SUM(CASE WHEN a.status='Alpha' THEN 1 ELSE 0 END) AS alpha,
          SUM(CASE WHEN a.status='Izin' THEN 1 ELSE 0 END) AS izin,
          SUM(CASE WHEN a.status LIKE 'Izin %' THEN 1 ELSE 0 END) AS izinDatang,
          SUM(CASE WHEN a.status='Hadir Libur' THEN 1 ELSE 0 END) AS hadirLibur,
          COUNT(a.id) AS totalBaris, MIN(a.tanggal) AS dari, MAX(a.tanggal) AS sampai
   FROM employees e LEFT JOIN attendance a ON a.employee_id = e.id
   GROUP BY e.id ORDER BY e.id`)

if (cari) {
  const k = await all('SELECT id, nama FROM employees WHERE nama LIKE ?', [`%${cari}%`])
  console.log(`\n===== DICARI: "${cari}" =====\n` + JSON.stringify(k))
  for (const row of k) {
    await j(`ABSENSI #${row.id} ${row.nama}`,
      `SELECT id, tanggal, check_in, check_out, status, keterangan, hari_libur, created_at
       FROM attendance WHERE employee_id = ? ORDER BY tanggal`, [row.id])
    await j(`IZIN #${row.id}`,
      `SELECT id, jenis, mulai, selesai, status, keterangan FROM leaves WHERE employee_id = ? ORDER BY mulai`, [row.id])
    await j(`LEMBUR #${row.id}`,
      `SELECT id, tanggal, jam_mulai, jam_selesai, status FROM overtime WHERE employee_id = ? ORDER BY tanggal`, [row.id])
    await j(`PIKET #${row.id}`,
      `SELECT id, tanggal, jam_mulai, jam_selesai, status FROM piket WHERE employee_id = ? ORDER BY tanggal`, [row.id])
  }
}

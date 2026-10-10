// ============================================================================
//  Uji alur PERIODE GAJI: sinkron rentang dengan absensi + status BAYAR.
//
//  Jalankan dengan DATA_DIR sementara supaya database kerja TIDAK tersentuh:
//    $env:DATA_DIR="$env:TEMP\nubsen-uji-periode-bayar"; $env:VERCEL="1"
//    node scripts/uji-periode-bayar.mjs
//
//  Cakupan:
//    • absensi "yatim" di luar periode terdeteksi (attendance, leaves, lembur, piket)
//    • sinkron memperluas rentang aktif sampai menutupi seluruh absensi
//    • tandai BAYAR mengunci rentang (sinkron/rapikan/hapus ditolak)
//    • batalkan bayar membuka kembali kunci (idempoten)
// ============================================================================
import os from 'node:os'
import path from 'node:path'
import { mkdirSync, rmSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Database sementara — proses ini tidak pernah menyentuh data produksi.
const AKAR = path.resolve(import.meta.dirname, '..')
const SEMENTARA = path.join(os.tmpdir(), 'nubsen-uji-periode-bayar')
try { rmSync(SEMENTARA, { recursive: true, force: true }) } catch { /* diabaikan */ }
mkdirSync(SEMENTARA, { recursive: true })
process.env.DATA_DIR = SEMENTARA
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN

let lulus = 0
let gagal = 0
const cek = (nama, syarat, info = '') => {
  if (syarat) { lulus++; console.log(`PASS  ${nama}${info ? ' → ' + info : ''}`) }
  else { gagal++; console.log(`FAIL  ${nama}${info ? ' → ' + info : ''}`) }
}

const { app } = await import(pathToFileURL(path.join(AKAR, 'server', 'index.js')).href)
const { db } = await import(pathToFileURL(path.join(AKAR, 'server', 'db.js')).href)

const server = app.listen(0)
await new Promise((r) => server.once('listening', r))
const BASE = `http://127.0.0.1:${server.address().port}`

async function req(p, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, data: json.data, error: json.error }
}

// ---- 1. Admin baru + karyawan uji ----
const setup = await req('/api/auth/setup', { method: 'POST', body: { nama: 'Admin Uji', email: 'admin.uji@uji.local', pin: '123456' } })
cek('pengaturan awal → admin + token', setup.status < 300 && !!setup.data?.token, setup.error)
const tA = setup.data?.token

const karyawan = await req('/api/admin/employees', {
  method: 'POST', token: tA,
  body: { nama: 'Karyawan Uji', email: 'karyawan.uji@uji.local', jabatan: 'Tester', departemen: 'QA', nip: 'UJI-PERIODE', pin: '654321' },
})
cek('admin menambah karyawan uji', karyawan.status === 201 && karyawan.data?.id > 0, `id=${karyawan.data?.id} ${karyawan.error || ''}`)
const idK = karyawan.data?.id

// ---- 2. Periode aktif + absensi di LUAR rentangnya ----
const periode = await req('/api/admin/gaji/periode', {
  method: 'POST', token: tA, body: { nama: 'Uji September 2026', dari: '2026-09-10', sampai: '2026-09-20' },
})
cek('tetapkan periode 10–20 Sept', periode.status < 300 && periode.data?.aktif === true, JSON.stringify(periode.data || periode.error))
const idP = periode.data?.id

// Absensi yatim: 3 Sept (sebelum) & 25 Sept (sesudah) — harus terdeteksi.
await db.run(
  "INSERT INTO attendance (employee_id, tanggal, check_in, check_out, status) VALUES (?, ?, ?, ?, 'Hadir'), (?, ?, ?, ?, 'Hadir')",
  [idK, '2026-09-03', '08:00', '17:00', idK, '2026-09-25', '08:00', '17:00'],
)
// Lembur yatim 27 Sept (Menunggu — tidak ditolak, ikut terdeteksi).
await db.run(
  "INSERT INTO overtime (employee_id, tanggal, jam_mulai, jam_selesai, status) VALUES (?, '2026-09-27', '17:00', '19:00', 'Menunggu')",
  [idK],
)
// Piket yatim 28 Sept.
await db.run(
  "INSERT INTO piket (employee_id, tanggal, jam_mulai, jam_selesai, status) VALUES (?, '2026-09-28', '17:00', '19:00', 'Menunggu')",
  [idK],
)

const luar = await req('/api/admin/gaji/periode/di-luar', { token: tA })
const tglLuar = luar.data?.tanggal || []
cek('absensi yatim terdeteksi (3 Sept)', tglLuar.includes('2026-09-03'), JSON.stringify(tglLuar))
cek('lembur yatim terdeteksi (27 Sept)', tglLuar.includes('2026-09-27'), JSON.stringify(tglLuar))
cek('piket yatim terdeteksi (28 Sept)', tglLuar.includes('2026-09-28'), JSON.stringify(tglLuar))
cek('periode aktif ikut dikirim', luar.data?.periodeAktif?.id === idP, JSON.stringify(luar.data?.periodeAktif))


// ---- 3. Sinkron memperluas rentang sampai menutupi seluruh absensi ----
const sinkron = await req(`/api/admin/gaji/periode/${idP}/sinkron`, { method: 'POST', token: tA })
cek('sinkron memperluas rentang', sinkron.status < 300 && sinkron.data?.dariBaru === '2026-09-03' && sinkron.data?.sampaiBaru === '2026-09-28',
  JSON.stringify({ dari: sinkron.data?.dariBaru, sampai: sinkron.data?.sampaiBaru, error: sinkron.error }))

const luarSesudah = await req('/api/admin/gaji/periode/di-luar', { token: tA })
cek('tidak ada lagi absensi yatim', (luarSesudah.data?.tanggal || []).length === 0, JSON.stringify(luarSesudah.data?.tanggal))

// Sinkron ulang = idempoten (tidak berubah).
const sinkron2 = await req(`/api/admin/gaji/periode/${idP}/sinkron`, { method: 'POST', token: tA })
cek('sinkron ulang idempoten', sinkron2.status < 300 && sinkron2.data?.tidakBerubah === true, JSON.stringify(sinkron2.data || sinkron2.error))

// ---- 4. Tandai BAYAR → rentang terkunci ----
const bayar = await req(`/api/admin/gaji/periode/${idP}/bayar`, { method: 'PUT', token: tA, body: { dibayar: true } })
cek('tandai bayar → dibayarPada terisi', bayar.status < 300 && typeof bayar.data?.dibayarPada === 'string', JSON.stringify(bayar.data || bayar.error))
const stempelLama = bayar.data?.dibayarPada

// Absensi baru di luar rentang — sinkron periode LUNAS harus ditolak.
await db.run(
  "INSERT INTO attendance (employee_id, tanggal, check_in, check_out, status) VALUES (?, '2026-09-30', '08:00', '17:00', 'Hadir')",
  [idK],
)
const sinkronBayar = await req(`/api/admin/gaji/periode/${idP}/sinkron`, { method: 'POST', token: tA })
cek('sinkron periode LUNAS ditolak (400)', sinkronBayar.status === 400, sinkronBayar.error)

const hapusBayar = await req(`/api/admin/gaji/periode/${idP}`, { method: 'DELETE', token: tA })
cek('hapus periode LUNAS ditolak (400)', hapusBayar.status === 400, hapusBayar.error)

// Periode bertumpuk yang tidak lewat API (validasi API menolak rentang bertumpuk;
// kasus ini mewakili data lama). Posisinya SETELAH periode LUNAS → rapikan ingin
// memotong periode LUNAS, tapi harus MELEWATINYA.
await db.run(
  "INSERT INTO payroll_periods (nama, dari, sampai, aktif) VALUES ('Uji Bertumpuk', '2026-09-20', '2026-09-30', 0)",
)
const rapikan = await req('/api/admin/gaji/periode/rapikan', { method: 'POST', token: tA })
const dilewati = rapikan.data?.dilewati || []
cek('rapikan melewati periode LUNAS', dilewati.some((d) => d.id === idP && d.alasan === 'sudah dibayarkan'), JSON.stringify(dilewati))
// Bersihkan periode bertumpuk agar tidak mengganggu langkah berikutnya
// (sinkron setelah batal bayar menolak rentang yang bertumpuk).
await db.run("DELETE FROM payroll_periods WHERE nama = 'Uji Bertumpuk'")

// Tandai bayar dua kali → stempel diperbarui (idempoten, tidak dobel).
const bayar2 = await req(`/api/admin/gaji/periode/${idP}/bayar`, { method: 'PUT', token: tA, body: { dibayar: true } })
cek('tandai bayar ulang tetap LUNAS', bayar2.status < 300 && typeof bayar2.data?.dibayarPada === 'string' && bayar2.data.dibayarPada >= stempelLama, JSON.stringify(bayar2.data || bayar2.error))

// ---- 5. Batalkan bayar → kunci terbuka ----
const batal = await req(`/api/admin/gaji/periode/${idP}/bayar`, { method: 'PUT', token: tA, body: { dibayar: false } })
cek('batalkan bayar → dibayarPada null', batal.status < 300 && batal.data?.dibayarPada == null, JSON.stringify(batal.data || batal.error))

const sinkron3 = await req(`/api/admin/gaji/periode/${idP}/sinkron`, { method: 'POST', token: tA })
cek('sinkron terbuka lagi setelah batal bayar', sinkron3.status < 300 && sinkron3.data?.sampaiBaru === '2026-09-30',
  JSON.stringify({ sampai: sinkron3.data?.sampaiBaru, error: sinkron3.error }))

const hapus = await req(`/api/admin/gaji/periode/${idP}`, { method: 'DELETE', token: tA })
cek('hapus periode setelah batal bayar → 200', hapus.status === 200, hapus.error)

// ---- Ringkasan ----
server.close()
console.log(`\n${lulus} lulus, ${gagal} gagal`)
try { rmSync(SEMENTARA, { recursive: true, force: true }) } catch { /* file DB mungkin masih dikunci proses — diabaikan */ }
process.exit(gagal ? 1 : 0)

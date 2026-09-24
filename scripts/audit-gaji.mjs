// ============================================================================
//  AUDIT GAJI — memeriksa apakah data absensi benar-benar sinkron dengan gaji.
//
//  Sifatnya READ-ONLY: hanya SELECT dari database (Turso/libSQL atau berkas
//  SQLite), lalu seluruh data disalin ke SQLite SEMENTARA dan dihitung memakai
//  kode server asli (server/models.js) sehingga rumusnya identik dengan yang
//  dipakai panel admin & slip karyawan.
//
//  Pemakaian:
//    1) isi .env pada akar proyek:
//         TURSO_DATABASE_URL=libsql://...      (atau file:./data.sqlite)
//         TURSO_AUTH_TOKEN=...                 (tidak perlu untuk file:)
//    2) npm run audit:gaji
//
//  Tanpa satu pun tulis ke database sumber — aman dijalankan kapan saja.
// ============================================================================
import { mkdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient } from '@libsql/client'
import { muatEnv } from '../server/utils/env.js'

const AKAR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
muatEnv()

const url = (process.env.TURSO_DATABASE_URL || '').trim()
const token = (process.env.TURSO_AUTH_TOKEN || '').trim()
if (!url) {
  console.error('✖ TURSO_DATABASE_URL belum diisi. Salin .env.example → .env lalu isi kredensialnya.')
  process.exit(2)
}
if (!/^file:/i.test(url) && !token) {
  console.error('✖ TURSO_AUTH_TOKEN belum diisi (wajib untuk database Turso).')
  process.exit(2)
}

// Semua pembacaan memakai salinan lokal → database asli tidak pernah ditulis.
// Folder tetap (bukan acak) supaya sisa dari jalannya yang sebelumnya bisa
// dibersihkan lebih dulu dan tidak menumpuk di folder sementara.
const SEMENTARA = path.join(os.tmpdir(), 'nubsen-audit-gaji')
try { rmSync(SEMENTARA, { recursive: true, force: true }) } catch { /* sisa dikunci proses lain — diabaikan */ }
mkdirSync(SEMENTARA, { recursive: true })
process.env.DATA_DIR = SEMENTARA
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN

const { db } = await import(pathToFileURL(path.join(AKAR, 'server', 'db.js')).href)
const M = await import(pathToFileURL(path.join(AKAR, 'server', 'models.js')).href)

const sumber = createClient({ url, authToken: token || undefined })
const TABEL = ['employees', 'attendance', 'leaves', 'overtime', 'piket', 'holidays', 'settings', 'payroll_periods']

console.log(`\n=== MENARIK DATA (read-only) dari ${/^file:/i.test(url) ? url : url.replace(/\/\/.*@/, '//')} ===`)
const jumlah = {}
for (const t of TABEL) {
  let rows
  try {
    ({ rows } = await sumber.execute(`SELECT * FROM ${t}`))
  } catch (e) {
    console.log(`  ${t}: dilewati (${e.message})`)
    continue
  }
  jumlah[t] = rows.length
  if (!rows.length) continue
  const kolom = Object.keys(rows[0])
  const sql = `INSERT INTO ${t} (${kolom.join(', ')}) VALUES (${kolom.map(() => '?').join(', ')})`
  for (const r of rows) {
    const nilai = kolom.map((k) => {
      const v = r[k]
      if (typeof v === 'bigint') return Number(v)
      if (v instanceof Uint8Array) return Buffer.from(v).toString('base64')
      return v
    })
    await db.run(sql, nilai)
  }
  console.log(`  ${t}: ${rows.length} baris`)
}
await sumber.close()

const temuan = []
const catat = (sev, judul, detail) => {
  temuan.push({ sev, judul })
  console.log(`\n[${sev}] ${judul}\n      ${detail}`)
}
const rupiah = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID')

// ---------- 1. Periode penggajian ----------
const periode = await M.listPeriodeGaji()
const aktif = periode.filter((p) => p.aktif)
console.log(`\n=== PERIODE GAJI (${periode.length}) ===`)
for (const p of periode) console.log(`  #${p.id} ${p.nama} | ${p.dari} .. ${p.sampai}${p.aktif ? '  ← AKTIF' : ''}`)
if (!periode.length) catat('BAHAYA', 'Belum ada periode penggajian', 'Tanpa periode, slip gaji karyawan kosong (null) walaupun absensi ada.')
if (aktif.length > 1) catat('PENTING', 'Lebih dari satu periode aktif', `${aktif.length} periode aktif: ${aktif.map((p) => `#${p.id}`).join(', ')}. Slip karyawan memakai yang terbaru.`)

// ---------- 2. Slip tiap karyawan per periode + pemeriksaan silang ----------
for (const p of periode) {
  const lap = await M.laporanGaji({ dari: p.dari, sampai: p.sampai })
  console.log(`\n=== ${p.nama} | ${p.dari}..${p.sampai} | hari kerja=${lap.hariKerja} ===`)
  console.log('nama | hadir telat libur izin sakit cuti alpha | hariDibayar | lembur(j) | TOTAL')
  let total = 0
  for (const r of lap.baris) {
    total += r.total
    console.log(`  ${r.nama} | ${r.hadir} ${r.terlambat} ${r.hadirLibur} ${r.izin} ${r.sakit} ${r.cuti} ${r.alpha} | ${r.hariDibayar} | ${r.lembur} | ${rupiah(r.total)}`)

    if (r.hariDibayar > 0 && r.gajiHarian === 0) {
      catat('BAHAYA', `${r.nama}: ada ${r.hariDibayar} hari dibayar tetapi tarif gaji 0`,
        `Gaji harian = 0 → slip ${r.nama} pada ${p.nama} bernilai ${rupiah(r.total)} padahal absensinya ada. Isi tarif di panel admin → tab Karyawan (Gaji harian / Uang makan / Tarif lembur).`)
    }
    if (r.lembur > 0 && r.tarifLembur === 0) {
      catat('BAHAYA', `${r.nama}: lembur ${r.lembur} jam tanpa tarif lembur`,
        `Tarif lembur = 0 → ${r.lembur} jam lembur disetujui tidak dibayar (Rp0).`)
    }
    // Lembur yang tanggalnya benar-benar jatuh pada hari Alpha.
    const rekap = await M.rekapHarian(r.id, p.dari, p.sampai)
    const hariAlpha = new Set(rekap.alpha)
    const otDisetujui = await db.all(
      `SELECT tanggal, jam_mulai, jam_selesai FROM overtime WHERE employee_id = ? AND status = 'Disetujui' AND tanggal >= ? AND tanggal <= ?`,
      [r.id, p.dari, p.sampai],
    )
    const lemburDiHariAlpha = otDisetujui.filter((o) => hariAlpha.has(o.tanggal))
    if (lemburDiHariAlpha.length) {
      catat('PENTING', `${r.nama}: lembur disetujui pada hari Alpha`,
        `${lemburDiHariAlpha.map((o) => `${o.tanggal} ${o.jam_mulai}-${o.jam_selesai}`).join(', ')} — hari itu tidak dibayar (Alpha) tetapi lemburnya tetap dibayar.`)
    }
    // Slip karyawan harus identik dengan baris laporan admin.
    const s = await M.slipGajiKaryawan(r.id, p.id)
    const t = s?.slip
    const sama = t && t.total === r.total && t.hariDibayar === r.hariDibayar && t.subLembur === r.subLembur
    if (!sama) {
      catat('BAHAYA', `${r.nama}: slip karyawan ≠ laporan gaji admin`,
        `slip=${rupiah(t?.total)} vs laporan=${rupiah(r.total)} pada ${p.nama}.`)
    }
  }
  console.log(`  TOTAL KESELURUHAN: ${rupiah(total)}`)
  if (!lap.baris.length) catat('CATATAN', `Tidak ada karyawan pada ${p.nama}`, 'Database karyawan kosong atau filter gagal.')

  // Izin berstatus Menunggu ikut terhitung dibayar.
  const menunggu = await db.all(
    `SELECT e.nama, l.jenis, l.mulai, l.selesai FROM leaves l LEFT JOIN employees e ON e.id = l.employee_id
     WHERE l.status = 'Menunggu' AND l.mulai <= ? AND l.selesai >= ?`,
    [p.sampai, p.dari],
  )
  for (const l of menunggu) {
    catat('PENTING', `Izin "Menunggu" sudah dibayar: ${l.nama || '#' + l.employee_id}`,
      `${l.jenis} ${l.mulai}..${l.selesai} — belum disetujui admin tetapi dihitung sebagai hari dibayar (dan tidak Alpha).`)
  }
}

// ---------- 3. Pemeriksaan integritas data mentah ----------
const semuaAbsen = await db.all(`SELECT MIN(tanggal) AS a, MAX(tanggal) AS b, COUNT(*) AS n FROM attendance`)
console.log(`\n=== ABSENSI: ${semuaAbsen[0]?.n || 0} baris (${semuaAbsen[0]?.a || '-'} .. ${semuaAbsen[0]?.b || '-'}) ===`)

const ganda = await db.all(`SELECT employee_id, tanggal, COUNT(*) AS n FROM attendance GROUP BY employee_id, tanggal HAVING n > 1`)
for (const d of ganda) catat('BAHAYA', 'Absensi ganda pada tanggal sama', `employee_id=${d.employee_id} tanggal=${d.tanggal} (${d.n} baris) → potensi gaji dobel.`)

// 'Izin Terlambat' (= izin datang terlambat/siang) juga status resmi: karyawan
// tetap masuk kerja, hanya jam masuknya lewat — dihitung sebagai HADIR.
const statusAneh = await db.all(`SELECT status, COUNT(*) AS n FROM attendance WHERE status NOT IN ('Hadir','Terlambat','Izin','Izin Terlambat','Izin Datang Siang','Alpha','Hadir Libur') GROUP BY status`)
for (const s of statusAneh) catat('CATATAN', `Status absensi tak lazim: "${s.status}"`, `${s.n} baris. Status di luar daftar resmi tidak dihitung sebagai kehadiran maupun izin.`)

const alphaManual = await db.all(`SELECT COUNT(*) AS n FROM attendance WHERE status = 'Alpha'`)
if (alphaManual[0]?.n) catat('CATATAN', 'Ada absensi berstatus "Alpha" yang dicatat manual', `${alphaManual[0].n} baris — sekarang ikut dihitung Alpha di laporan (perbaikan rekapHarian).`)

const nolTarif = await db.all(`SELECT nama FROM employees WHERE COALESCE(gaji_harian,0) = 0`)
for (const e of nolTarif) catat('BAHAYA', `Tarif belum diatur: ${e.nama}`, 'Absensi karyawan ini akan selalu menghasilkan slip Rp0.')

const tanggalKerja = await db.all(`SELECT COUNT(DISTINCT tanggal) AS n FROM attendance`)
console.log(`Tanggal unik dengan absensi: ${tanggalKerja[0]?.n || 0}`)

// ---------- 4. Ringkasan ----------
const hitung = (s) => temuan.filter((t) => t.sev === s).length
console.log(`\n=== RINGKASAN: ${temuan.length} temuan (BAHAYA ${hitung('BAHAYA')} · PENTING ${hitung('PENTING')} · CATATAN ${hitung('CATATAN')}) ===`)
if (!temuan.length) console.log('Tidak ada ketidaksesuaian yang terdeteksi: absensi dan gaji konsisten.')

try { rmSync(SEMENTARA, { recursive: true, force: true }) } catch { /* masih dikunci proses ini */ }
console.log('\nSalinan sementara: ' + SEMENTARA)
console.log('Database sumber tidak pernah ditulis.')
process.exit(hitung('BAHAYA') ? 1 : 0)


// ============================================================================
//  PERBAIKI DATA ABSENSI satu karyawan — samakan status & keterangan setiap
//  baris absensi dengan aturan yang berlaku SEKARANG (jadwal aktif, hari
//  kerja, hari libur, toleransi jam), satu sumber aturan dengan aplikasi:
//  getJadwal() + hitungStatusAbsen() dari server.
//
//  Aturan perbaikan:
//   1. Baris berstatus "Izin" yang pengajuannya tidak sah (mis. DITOLAK)
//      padahal ada check-in nyata → status DIPULIHKAN dari jam check-in
//      (aturan sama dengan rekonsiliasi izin di server).
//   2. Jam absen tidak wajar yang sudah DITINJAU admin (status tetap
//      Hadir/Terlambat) → status dihormati; keterangan diperbarui agar tidak
//      lagi menyuruh "perlu ditinjau".
//   3. Baris lain → status & keterangan disegarkan sesuai jadwal hari itu
//      (mis. batas berubah 08:15 → 10:00, keterangan lama ikut stale).
//   4. Tanda hari_libur disamakan dengan hari nyata (akhir pekan/libur = 1).
//   Baris TANPA check-in tidak disentuh.
//
//  Pemakaian:
//    node scripts/perbaiki-absensi.mjs "Nama Karyawan"             → pratinjau
//    node scripts/perbaiki-absensi.mjs "Nama Karyawan" --terapkan  → tulis
//  Database mengikuti env (Turso bila TURSO_DATABASE_URL diisi; SQLite lokal
//  selain itu). Setelah menulis, laporan gaji kedua periode + slip karyawan
//  dicetak sebagai bukti angka akhir.
// ============================================================================
import { muatEnv } from '../server/utils/env.js'

muatEnv()
const { db, getJadwal, hariKerjaAktif } = await import('../server/db.js')
const M = await import('../server/models.js')
const { hitungStatusAbsen, STATUS_IZIN_DATANG, STATUS_PERLU_TINJAUAN } = M

const TERAPKAN = process.argv.includes('--terapkan')
const SEMUA = process.argv.includes('--semua')
const cari = process.argv.slice(2).filter((a) => !a.startsWith('--')).join(' ')
const rupiah = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString('id-ID')}`

// Baris absensi hanya boleh disentuh bila punya JAM check-in sungguhan. Aplikasi
// menyimpan '-' untuk baris tanpa jam (mis. catatan Alpha buatan), dan '-' itu
// TRUTHY — guard lama `if (!r.check_in)` meloloskannya sehingga status baris
// Alpha berubah keliru menjadi "Perlu Tinjauan". Karena itu dipakai pola jam.
const adaJam = (j) => /^\d{1,2}:\d{2}/.test(String(j ?? '').trim())

// Daftar karyawan yang diproses: --semua = seluruh karyawan, selain itu satu nama.
let daftar
if (SEMUA) {
  daftar = await db.all('SELECT id, nama FROM employees ORDER BY nama')
  if (cari) console.log(`ℹ️  --semua dipakai → argumen "${cari}" diabaikan.`)
} else {
  const nama = cari || 'E. Nugraha Wicaksono'
  const satu = await db.get('SELECT id, nama FROM employees WHERE nama LIKE ?', [`%${nama}%`])
  if (!satu) {
    console.error(`✖ Karyawan "${nama}" tidak ditemukan. Pakai --semua untuk memproses seluruh karyawan.`)
    process.exit(1)
  }
  daftar = [satu]
}
if (!daftar.length) {
  console.error('✖ Tidak ada karyawan pada database.')
  process.exit(1)
}

const aktif = new Set(await hariKerjaAktif())
let totalUbah = 0
let totalDampak = 0
let totalDilewati = 0

for (const karyawan of daftar) {
console.log(`\n=== PERBAIKI ABSENSI: #${karyawan.id} ${karyawan.nama} — mode ${TERAPKAN ? 'TERAPKAN ✍️' : 'PRATINJAU (kering)'} ===\n`)

const [rows, tarif] = await Promise.all([
  db.all('SELECT * FROM attendance WHERE employee_id = ? ORDER BY tanggal, id', [karyawan.id]),
  db.get('SELECT gaji_harian, uang_makan FROM employees WHERE id = ?', [karyawan.id]),
])

// Nilai (gaji + uang makan) yang dibayar untuk satu hari kehadiran, sesuai
// hitungBarisGaji/laporan: hari libur dibayar penuh + uang makan; Hadir & izin
// datang dibayar + uang makan; Terlambat hanya gaji; lainnya bukan kehadiran.
const nilaiHari = (status, hariLibur) => {
  const g = Math.round(Number(tarif?.gaji_harian) || 0)
  const m = Math.round(Number(tarif?.uang_makan) || 0)
  if (['Hadir', 'Terlambat'].includes(status)) return hariLibur ? g + m : status === 'Hadir' ? g + m : g
  if (STATUS_IZIN_DATANG.includes(status)) return g + m
  return 0
}

const keteranganHari = async (tanggal) => {
  const libur = await db.get('SELECT nama FROM holidays WHERE tanggal = ?', [tanggal])
  if (libur) return `Libur: ${libur.nama}`
  const diLuar = !aktif.has(new Date(`${tanggal}T00:00:00Z`).getUTCDay())
  return diLuar ? 'Absensi di luar hari kerja' : null
}

let jumlahUbah = 0
let dampak = 0
for (const r of rows) {
  if (!adaJam(r.check_in)) {
    totalDilewati += 1
    console.log(`⏭️  ${r.tanggal} (#${r.id}) dilewati — tanpa jam check-in (status ${r.status})`)
    continue
  }
  const jadwal = await getJadwal(karyawan.id, r.tanggal)
  const { status: statusJam, alasan } = hitungStatusAbsen(jadwal, r.check_in)
  const ketHari = await keteranganHari(r.tanggal)
  const hariLiburBaru = ketHari ? 1 : 0

  let statusBaru = r.status
  let ketBaru = r.keterangan || ''
  if (['Izin', ...STATUS_IZIN_DATANG].includes(r.status)) {
    // (1) Pulihkan dari jam check-in — pengajuan izinnya tidak sah (ditolak/hilang).
    statusBaru = statusJam
    ketBaru = `${ketHari || alasan || `Jam check-in ${r.check_in}`} (izin tidak disetujui — status dipulihkan)`
  } else if (statusJam === STATUS_PERLU_TINJAUAN && ['Hadir', 'Terlambat'].includes(r.status)) {
    // (2) Keputusan admin atas jam tidak wajar dihormati; rapikan keterangannya.
    statusBaru = r.status
    ketBaru = `${alasan.replace(/ ?Perlu ditinjau admin\.$/, '')} Ditinjau admin: tetap ${r.status}.`
  } else {
    // (3) Segarkan status & keterangan sesuai aturan yang berlaku sekarang.
    statusBaru = statusJam
    ketBaru = ketHari || alasan || ''
  }

  const sebelum = nilaiHari(r.status, !!r.hari_libur)
  const sesudah = nilaiHari(statusBaru, !!hariLiburBaru)
  const sama = statusBaru === r.status && ketBaru === (r.keterangan || '') && hariLiburBaru === (r.hari_libur ?? 0)
  if (sama) {
    console.log(`✓  ${r.tanggal} (#${r.id}) sudah sesuai — ${statusBaru}, check-in ${r.check_in}`)
    continue
  }
  jumlahUbah += 1
  dampak += sesudah - sebelum
  console.log(
    `${TERAPKAN ? '✍️' : '⚠️'}  ${r.tanggal} (#${r.id}) check-in ${r.check_in} / pulang ${r.check_out || '-'}\n` +
    `    status : ${r.status} → ${statusBaru}\n` +
    `    ket    : ${r.keterangan || '(kosong)'}\n` +
    `           → ${ketBaru || '(kosong)'}\n` +
    `    libur  : ${r.hari_libur ?? 0} → ${hariLiburBaru}   nilai hari: ${rupiah(sebelum)} → ${rupiah(sesudah)}`,
  )
  if (TERAPKAN) {
    await db.run(
      'UPDATE attendance SET status = ?, keterangan = ?, hari_libur = ? WHERE id = ?',
      [statusBaru, ketBaru, hariLiburBaru, r.id],
    )
  }
}

totalUbah += jumlahUbah
totalDampak += dampak
console.log(`\n${jumlahUbah} baris ${TERAPKAN ? 'DIPERBAIKI' : 'perlu perbaikan'} — dampak gaji ${TERAPKAN ? 'akhir' : 'indikasi'}: ${dampak >= 0 ? '+' : ''}${rupiah(dampak)}`)

// ---------- Bukti angka akhir: laporan gaji per periode + slip karyawan ----------
const { listPeriodeGaji, laporanGaji, slipGajiKaryawan } = M
const periode = await listPeriodeGaji()
for (const p of periode) {
  const lap = await laporanGaji({ dari: p.dari, sampai: p.sampai, employeeId: karyawan.id })
  const b = lap.baris[0]
  if (!b) continue
  console.log(`\n— ${p.nama}${p.aktif ? ' (AKTIF)' : ''} ${p.dari}..${p.sampai}: hadir ${b.hadir}, terlambat ${b.terlambat}, hadir libur ${b.hadirLibur}, izin ${b.izin}, sakit ${b.sakit}, cuti ${b.cuti}, alpha ${b.alpha} | hari dibayar ${b.hariDibayar} | lembur ${b.lembur}j | piket ${b.piket} | TOTAL ${rupiah(b.total)}`)
  const slip = (await slipGajiKaryawan(karyawan.id, p.id))?.slip
  if (slip) console.log(`  slip karyawan: total ${rupiah(slip.total)} — ${slip.total === b.total ? 'COCOK dengan laporan ✓' : `BEDA dengan laporan ${rupiah(b.total)} ✗`}`)
}
}

// Ringkasan lintas karyawan (hanya bila lebih dari satu yang diproses).
if (daftar.length > 1) {
  console.log(`\n===== RINGKASAN ${daftar.length} KARYAWAN: ${totalUbah} baris ${TERAPKAN ? 'DIPERBAIKI' : 'perlu perbaikan'}, ${totalDilewati} baris dilewati (tanpa jam), dampak gaji ${TERAPKAN ? 'akhir' : 'indikasi'}: ${totalDampak >= 0 ? '+' : ''}${rupiah(totalDampak)} =====`)
}
console.log('')

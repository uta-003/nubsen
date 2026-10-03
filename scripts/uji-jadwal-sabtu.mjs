// ============================================================================
//  UJI JADWAL SABTU (mode 'biasa') — memastikan Sabtu dapat jam masuk & pulang
//  berbeda dari Senin–Jumat, sementara hari lain tetap memakai jam kantor umum.
//
//  Sifatnya aman diulang: nilai pengaturan Sabtu yang sudah ada disimpan dulu,
//  dipakai untuk uji, lalu DIKEMBALIKAN seperti semula di akhir. Database
//  mengikuti env (Turso bila TURSO_DATABASE_URL diisi; SQLite lokal selain itu).
//
//  Pemakaian: node scripts/uji-jadwal-sabtu.mjs
//             (isi env via --env-file bila ingin menguji database Turso)
// ============================================================================
import { muatEnv } from '../server/utils/env.js'

muatEnv()
const { getJadwal, getJadwalGlobal, setSetting } = await import('../server/db.js')
const { hitungStatusAbsen } = await import('../server/models.js')

let gagal = 0
const cek = (nama, kondisi, detail = '') => {
  console.log(`${kondisi ? '✅' : '❌'} ${nama}${detail ? ` — ${detail}` : ''}`)
  if (!kondisi) gagal += 1
}

// Simpan nilai lama, pasang jadwal Sabtu uji, dan pastikan dikembalikan nanti.
const lamaMasuk = await getJadwalGlobal().then((j) => j.jamMasukBatasSabtu || '')
const lamaPulang = await getJadwalGlobal().then((j) => j.jamPulangSabtu || '')
await setSetting('jamMasukBatasSabtu', '09:00')
await setSetting('jamPulangSabtu', '14:00')

try {
  // 2026-10-03 = Sabtu, 2026-10-02 = Jumat.
  const sabtu = await getJadwal(null, '2026-10-03')
  const jumat = await getJadwal(null, '2026-10-02')

  cek('Sabtu memakai jadwal Sabtu', sabtu.jamMasukBatas === '09:00' && sabtu.jamPulang === '14:00',
    `batas ${sabtu.jamMasukBatas}, pulang ${sabtu.jamPulang}`)
  cek('Jumat tetap memakai jam kantor umum', jumat.jamMasukBatas !== '09:00' && jumat.jamPulang !== '14:00',
    `batas ${jumat.jamMasukBatas}, pulang ${jumat.jamPulang}`)
  cek('Penanda hari Sabtu benar', sabtu.sabtu === true && jumat.sabtu === false)

  const telat = hitungStatusAbsen(sabtu, '09:30')
  const tepat = hitungStatusAbsen(sabtu, '08:59')
  cek('Check-in 09:30 di Sabtu → Terlambat', telat.status === 'Terlambat', telat.alasan)
  cek('Check-in 08:59 di Sabtu → Hadir', tepat.status === 'Hadir')

  // Tanpa jadwal Sabtu (kosong) → Sabtu kembali mengikuti Senin–Jumat.
  await setSetting('jamMasukBatasSabtu', '')
  await setSetting('jamPulangSabtu', '')
  const sabtuKosong = await getJadwal(null, '2026-10-03')
  cek('Jadwal Sabtu kosong → ikut Senin–Jumat',
    sabtuKosong.jamMasukBatas === jumat.jamMasukBatas && sabtuKosong.jamPulang === jumat.jamPulang,
    `batas ${sabtuKosong.jamMasukBatas}, pulang ${sabtuKosong.jamPulang}`)
} finally {
  // Kembalikan pengaturan seperti semula.
  await setSetting('jamMasukBatasSabtu', lamaMasuk)
  await setSetting('jamPulangSabtu', lamaPulang)
}

console.log(gagal ? `\n${gagal} pengujian GAGAL` : '\nSemua pengujian lulus.')
process.exit(gagal ? 1 : 0)

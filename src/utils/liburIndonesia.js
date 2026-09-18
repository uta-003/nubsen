// ============================================================================
//  Hari libur nasional & cuti bersama Indonesia (tanggal merah).
//
//  Sumber data:
//    * 2023–2025: SKB Menteri Agama, Menteri Ketenagakerjaan & Menteri PANRB
//      (diverifikasi silang: officeholidays.com/countries/indonesia).
//    * 2024: ditambah hari pemungutan suara Pemilu (14 Feb) & Pilkada (27 Nov)
//      sesuai Keppres (libur nasional).
//    * 2026: rilis resmi Kemenko PMK (kemenkopmk.go.id).
//
//  Tahun yang belum ditetapkan pemerintah TIDAK ditebak: hanya libur
//  bertanggal tetap (TANGGAL_TETAP) yang ditampilkan, supaya aplikasi tidak
//  menampilkan tanggal merah yang keliru. Perbarui DATA_LIBUR tiap awal tahun.
// ============================================================================

export const JENIS_NASIONAL = 'nasional' // libur nasional (tanggal merah)
export const JENIS_CUTI = 'cuti' // cuti bersama
export const LABEL_JENIS = {
  [JENIS_NASIONAL]: 'Libur Nasional',
  [JENIS_CUTI]: 'Cuti Bersama',
}

// [tanggal ISO, nama resmi, jenis]
export const DATA_LIBUR = {
  2023: [
    ['2023-01-01', 'Tahun Baru Masehi', JENIS_NASIONAL],
    ['2023-01-22', 'Tahun Baru Imlek 2574 Kongzili', JENIS_NASIONAL],
    ['2023-01-23', 'Cuti Bersama Tahun Baru Imlek', JENIS_CUTI],
    ['2023-02-18', 'Isra Mikraj Nabi Muhammad SAW', JENIS_NASIONAL],
    ['2023-03-22', 'Hari Suci Nyepi (Tahun Baru Saka 1945)', JENIS_NASIONAL],
    ['2023-03-23', 'Cuti Bersama Hari Suci Nyepi', JENIS_CUTI],
    ['2023-04-07', 'Wafat Isa Almasih (Jumat Agung)', JENIS_NASIONAL],
    ['2023-04-19', 'Cuti Bersama Idul Fitri 1444 H', JENIS_CUTI],
    ['2023-04-20', 'Cuti Bersama Idul Fitri 1444 H', JENIS_CUTI],
    ['2023-04-21', 'Cuti Bersama Idul Fitri 1444 H', JENIS_CUTI],
    ['2023-04-22', 'Idul Fitri 1444 H', JENIS_NASIONAL],
    ['2023-04-23', 'Idul Fitri 1444 H (hari kedua)', JENIS_NASIONAL],
    ['2023-04-24', 'Cuti Bersama Idul Fitri 1444 H', JENIS_CUTI],
    ['2023-04-25', 'Cuti Bersama Idul Fitri 1444 H', JENIS_CUTI],
    ['2023-05-01', 'Hari Buruh Internasional', JENIS_NASIONAL],
    ['2023-05-18', 'Kenaikan Isa Almasih', JENIS_NASIONAL],
    ['2023-05-19', 'Cuti Bersama Kenaikan Isa Almasih', JENIS_CUTI],
    ['2023-06-01', 'Hari Lahir Pancasila', JENIS_NASIONAL],
    ['2023-06-04', 'Hari Raya Waisak 2567 BE', JENIS_NASIONAL],
    ['2023-06-05', 'Cuti Bersama Hari Raya Waisak', JENIS_CUTI],
    ['2023-06-29', 'Idul Adha 1444 H', JENIS_NASIONAL],
    ['2023-06-30', 'Cuti Bersama Idul Adha 1444 H', JENIS_CUTI],
    ['2023-07-19', 'Tahun Baru Islam 1445 H', JENIS_NASIONAL],
    ['2023-08-17', 'Hari Kemerdekaan Republik Indonesia', JENIS_NASIONAL],
    ['2023-09-28', 'Maulid Nabi Muhammad SAW', JENIS_NASIONAL],
    ['2023-12-25', 'Kelahiran Isa Almasih (Natal)', JENIS_NASIONAL],
    ['2023-12-26', 'Cuti Bersama Natal', JENIS_CUTI],
  ],
  2024: [
    ['2024-01-01', 'Tahun Baru Masehi', JENIS_NASIONAL],
    ['2024-02-08', 'Isra Mikraj Nabi Muhammad SAW', JENIS_NASIONAL],
    ['2024-02-09', 'Cuti Bersama Tahun Baru Imlek', JENIS_CUTI],
    ['2024-02-10', 'Tahun Baru Imlek 2575 Kongzili', JENIS_NASIONAL],
    ['2024-02-14', 'Hari Pemungutan Suara Pemilu 2024', JENIS_NASIONAL],
    ['2024-03-11', 'Hari Suci Nyepi (Tahun Baru Saka 1946)', JENIS_NASIONAL],
    ['2024-03-12', 'Cuti Bersama Hari Suci Nyepi', JENIS_CUTI],
    ['2024-03-29', 'Wafat Isa Almasih (Jumat Agung)', JENIS_NASIONAL],
    ['2024-03-31', 'Kebangkitan Isa Almasih (Paskah)', JENIS_NASIONAL],
    ['2024-04-08', 'Cuti Bersama Idul Fitri 1445 H', JENIS_CUTI],
    ['2024-04-09', 'Cuti Bersama Idul Fitri 1445 H', JENIS_CUTI],
    ['2024-04-10', 'Idul Fitri 1445 H', JENIS_NASIONAL],
    ['2024-04-11', 'Idul Fitri 1445 H (hari kedua)', JENIS_NASIONAL],
    ['2024-04-12', 'Cuti Bersama Idul Fitri 1445 H', JENIS_CUTI],
    ['2024-04-15', 'Cuti Bersama Idul Fitri 1445 H', JENIS_CUTI],
    ['2024-05-01', 'Hari Buruh Internasional', JENIS_NASIONAL],
    ['2024-05-09', 'Kenaikan Isa Almasih', JENIS_NASIONAL],
    ['2024-05-10', 'Cuti Bersama Kenaikan Isa Almasih', JENIS_CUTI],
    ['2024-05-23', 'Hari Raya Waisak 2568 BE', JENIS_NASIONAL],
    ['2024-05-24', 'Cuti Bersama Hari Raya Waisak', JENIS_CUTI],
    ['2024-06-01', 'Hari Lahir Pancasila', JENIS_NASIONAL],
    ['2024-06-17', 'Idul Adha 1445 H', JENIS_NASIONAL],
    ['2024-06-18', 'Cuti Bersama Idul Adha 1445 H', JENIS_CUTI],
    ['2024-07-07', 'Tahun Baru Islam 1446 H', JENIS_NASIONAL],
    ['2024-08-17', 'Hari Kemerdekaan Republik Indonesia', JENIS_NASIONAL],
    ['2024-09-16', 'Maulid Nabi Muhammad SAW', JENIS_NASIONAL],
    ['2024-11-27', 'Hari Pemungutan Suara Pilkada 2024', JENIS_NASIONAL],
    ['2024-12-25', 'Kelahiran Isa Almasih (Natal)', JENIS_NASIONAL],
    ['2024-12-26', 'Cuti Bersama Natal', JENIS_CUTI],
  ],
  2025: [
    ['2025-01-01', 'Tahun Baru Masehi', JENIS_NASIONAL],
    ['2025-01-27', 'Isra Mikraj Nabi Muhammad SAW', JENIS_NASIONAL],
    ['2025-01-28', 'Cuti Bersama Tahun Baru Imlek', JENIS_CUTI],
    ['2025-01-29', 'Tahun Baru Imlek 2576 Kongzili', JENIS_NASIONAL],
    ['2025-03-28', 'Cuti Bersama Hari Suci Nyepi', JENIS_CUTI],
    ['2025-03-29', 'Hari Suci Nyepi (Tahun Baru Saka 1947)', JENIS_NASIONAL],
    ['2025-03-31', 'Idul Fitri 1446 H', JENIS_NASIONAL],
    ['2025-04-01', 'Idul Fitri 1446 H (hari kedua)', JENIS_NASIONAL],
    ['2025-04-02', 'Cuti Bersama Idul Fitri 1446 H', JENIS_CUTI],
    ['2025-04-03', 'Cuti Bersama Idul Fitri 1446 H', JENIS_CUTI],
    ['2025-04-04', 'Cuti Bersama Idul Fitri 1446 H', JENIS_CUTI],
    ['2025-04-07', 'Cuti Bersama Idul Fitri 1446 H', JENIS_CUTI],
    ['2025-04-18', 'Wafat Isa Almasih (Jumat Agung)', JENIS_NASIONAL],
    ['2025-04-20', 'Kebangkitan Isa Almasih (Paskah)', JENIS_NASIONAL],
    ['2025-05-01', 'Hari Buruh Internasional', JENIS_NASIONAL],
    ['2025-05-12', 'Hari Raya Waisak 2569 BE', JENIS_NASIONAL],
    ['2025-05-13', 'Cuti Bersama Hari Raya Waisak', JENIS_CUTI],
    ['2025-05-29', 'Kenaikan Isa Almasih', JENIS_NASIONAL],
    ['2025-05-30', 'Cuti Bersama Kenaikan Isa Almasih', JENIS_CUTI],
    ['2025-06-01', 'Hari Lahir Pancasila', JENIS_NASIONAL],
    ['2025-06-06', 'Idul Adha 1446 H', JENIS_NASIONAL],
    ['2025-06-09', 'Cuti Bersama Idul Adha 1446 H', JENIS_CUTI],
    ['2025-06-27', 'Tahun Baru Islam 1447 H', JENIS_NASIONAL],
    ['2025-08-17', 'Hari Kemerdekaan Republik Indonesia', JENIS_NASIONAL],
    ['2025-08-18', 'Cuti Bersama Kemerdekaan RI', JENIS_CUTI],
    ['2025-09-05', 'Maulid Nabi Muhammad SAW', JENIS_NASIONAL],
    ['2025-12-25', 'Kelahiran Isa Almasih (Natal)', JENIS_NASIONAL],
    ['2025-12-26', 'Cuti Bersama Natal', JENIS_CUTI],
  ],
  // 2026 — ditetapkan resmi (Kemenko PMK). Catatan: hari raya yang jatuh pada
  // akhir pekan (mis. Paskah 5 Apr, Waisak 31 Mei) tetap dihitung tanggal merah.
  2026: [
    ['2026-01-01', 'Tahun Baru Masehi', JENIS_NASIONAL],
    ['2026-01-16', 'Isra Mikraj Nabi Muhammad SAW', JENIS_NASIONAL],
    ['2026-02-16', 'Cuti Bersama Tahun Baru Imlek', JENIS_CUTI],
    ['2026-02-17', 'Tahun Baru Imlek 2577 Kongzili', JENIS_NASIONAL],
    ['2026-03-18', 'Cuti Bersama Hari Suci Nyepi', JENIS_CUTI],
    ['2026-03-19', 'Hari Suci Nyepi (Tahun Baru Saka 1948)', JENIS_NASIONAL],
    ['2026-03-20', 'Cuti Bersama Idul Fitri 1447 H', JENIS_CUTI],
    ['2026-03-21', 'Idul Fitri 1447 H', JENIS_NASIONAL],
    ['2026-03-22', 'Idul Fitri 1447 H (hari kedua)', JENIS_NASIONAL],
    ['2026-03-23', 'Cuti Bersama Idul Fitri 1447 H', JENIS_CUTI],
    ['2026-03-24', 'Cuti Bersama Idul Fitri 1447 H', JENIS_CUTI],
    ['2026-04-03', 'Wafat Isa Almasih (Jumat Agung)', JENIS_NASIONAL],
    ['2026-04-05', 'Kebangkitan Isa Almasih (Paskah)', JENIS_NASIONAL],
    ['2026-05-01', 'Hari Buruh Internasional', JENIS_NASIONAL],
    ['2026-05-14', 'Kenaikan Isa Almasih', JENIS_NASIONAL],
    ['2026-05-15', 'Cuti Bersama Kenaikan Isa Almasih', JENIS_CUTI],
    ['2026-05-27', 'Idul Adha 1447 H', JENIS_NASIONAL],
    ['2026-05-28', 'Cuti Bersama Idul Adha 1447 H', JENIS_CUTI],
    ['2026-05-31', 'Hari Raya Waisak 2570 BE', JENIS_NASIONAL],
    ['2026-06-01', 'Hari Lahir Pancasila', JENIS_NASIONAL],
    ['2026-06-16', 'Tahun Baru Islam 1448 H', JENIS_NASIONAL],
    ['2026-08-17', 'Hari Kemerdekaan Republik Indonesia', JENIS_NASIONAL],
    ['2026-08-25', 'Maulid Nabi Muhammad SAW', JENIS_NASIONAL],
    ['2026-12-24', 'Cuti Bersama Natal', JENIS_CUTI],
    ['2026-12-25', 'Kelahiran Isa Almasih (Natal)', JENIS_NASIONAL],
  ],
}

// Peta tanggal ISO → detail libur (dibangun sekali saat modul dimuat).
const TAHUNAN = new Map()
for (const daftar of Object.values(DATA_LIBUR)) {
  for (const [tanggal, nama, jenis] of daftar) TAHUNAN.set(tanggal, { tanggal, nama, jenis })
}

// Libur bertanggal TETAP → berlaku di semua tahun (dipakai bila tahun tersebut
// belum ada di DATA_LIBUR, mis. 2027 ke atas).
const TANGGAL_TETAP = [
  ['01-01', 'Tahun Baru Masehi'],
  ['05-01', 'Hari Buruh Internasional'],
  ['06-01', 'Hari Lahir Pancasila'],
  ['08-17', 'Hari Kemerdekaan Republik Indonesia'],
  ['12-25', 'Kelahiran Isa Almasih (Natal)'],
]

// Detail libur untuk tanggal ISO 'YYYY-MM-DD' → { tanggal, nama, jenis } | null.
export function detailLibur(iso) {
  if (!iso) return null
  const dariTabel = TAHUNAN.get(iso)
  if (dariTabel) return dariTabel
  const tetap = TANGGAL_TETAP.find(([md]) => md === iso.slice(5))
  return tetap ? { tanggal: iso, nama: tetap[1], jenis: JENIS_NASIONAL, tetap: true } : null
}

// Nama libur untuk tanggal ISO (null bila bukan libur).
export function namaLibur(iso) {
  return detailLibur(iso)?.nama || null
}

// Jenis libur: 'nasional' (tanggal merah) | 'cuti' (cuti bersama) | null.
export function jenisLibur(iso) {
  return detailLibur(iso)?.jenis || null
}

// Label panjang & singkat untuk badge di UI.
export function labelJenisLibur(jenis) {
  return LABEL_JENIS[jenis] || 'Libur'
}
export function labelJenisPendek(jenis) {
  return jenis === JENIS_CUTI ? 'Cuti bersama' : 'Libur nasional'
}

// Kompatibilitas versi awal kalender: peta tanggal ISO → nama libur.
export const LIBUR_INDONESIA = Object.fromEntries([...TAHUNAN.values()].map((l) => [l.tanggal, l.nama]))

// Semua libur pada satu tahun (termasuk libur bertanggal tetap) → terurut.
export function liburTahun(tahun) {
  const peta = new Map(
    [...TAHUNAN.values()]
      .filter((l) => l.tanggal.startsWith(`${tahun}-`))
      .map((l) => [l.tanggal, l]),
  )
  for (const [md, nama] of TANGGAL_TETAP) {
    const tanggal = `${tahun}-${md}`
    if (!peta.has(tanggal)) peta.set(tanggal, { tanggal, nama, jenis: JENIS_NASIONAL, tetap: true })
  }
  return [...peta.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal))
}

// Semua libur pada bulan tertentu (bulan 0 = Januari) → [{ tanggal, nama, jenis }].
export function liburBulan(tahun, bulan) {
  const prefiks = `${tahun}-${String(bulan + 1).padStart(2, '0')}`
  return liburTahun(tahun).filter((l) => l.tanggal.startsWith(prefiks))
}

// Libur berikutnya sejak `dari` (inklusif hari ini) → { tanggal, nama, jenis, hariLagi }.
// `hariLagi` 0 = hari ini, 1 = besok, dst. Dicari maksimal 400 hari ke depan
// (libur bertanggal tetap ikut terhitung untuk tahun yang belum ditetapkan).
export function liburBerikutnya(dari = new Date()) {
  const d = new Date(dari.getFullYear(), dari.getMonth(), dari.getDate())
  for (let i = 0; i < 400; i++) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const libur = detailLibur(iso)
    if (libur) return { ...libur, hariLagi: i }
    d.setDate(d.getDate() + 1)
  }
  return null
}

// Tahun yang datanya sudah ditetapkan (dipakai untuk catatan sumber di UI).
export function tahunLiburTersedia() {
  return Object.keys(DATA_LIBUR).map(Number).sort((a, b) => a - b)
}

// Libur dalam rentang tanggal ISO (inklusif) — dipakai kartu statistik mingguan.
// Ditambah hariKe & bulan (0 = Januari) agar UI tidak perlu memotong string lagi.
export function liburRentang(dariIso, sampaiIso) {
  const kandidat = new Map()
  for (const tahun of new Set([dariIso.slice(0, 4), sampaiIso.slice(0, 4)])) {
    for (const l of liburTahun(Number(tahun))) kandidat.set(l.tanggal, l)
  }
  return [...kandidat.values()]
    .filter((l) => l.tanggal >= dariIso && l.tanggal <= sampaiIso)
    .map((l) => ({ ...l, hariKe: Number(l.tanggal.slice(8)), bulan: Number(l.tanggal.slice(5, 7)) - 1 }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
}

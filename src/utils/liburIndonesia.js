// ============ Hari libur & tanggal merah Indonesia ============
// 2025: sesuai SKB 3 Menteri (resmi).
// 2026: perkiraan umum berbasis kalender (SKB resmi menyusul) — perbarui tiap awal tahun.
export const LIBUR_INDONESIA = {
  // ---- 2025 ----
  '2025-01-01': 'Tahun Baru Masehi',
  '2025-01-28': 'Cuti Bersama Imlek',
  '2025-01-29': 'Tahun Baru Imlek 2576',
  '2025-02-27': 'Isra Mikraj Nabi Muhammad SAW',
  '2025-03-28': 'Cuti Bersama Nyepi',
  '2025-03-29': 'Nyepi (Tahun Baru Saka 1947)',
  '2025-03-31': 'Idul Fitri 1446 H',
  '2025-04-01': 'Idul Fitri 1446 H (hari ke-2)',
  '2025-04-02': 'Cuti Bersama Idul Fitri',
  '2025-04-03': 'Cuti Bersama Idul Fitri',
  '2025-04-18': 'Wafat Isa Almasih (Jumat Agung)',
  '2025-04-20': 'Kebangkitan Yesus Kristus (Paskah)',
  '2025-04-21': 'Cuti Bersama Paskah',
  '2025-05-01': 'Hari Buruh Internasional',
  '2025-05-12': 'Hari Raya Waisak',
  '2025-05-13': 'Cuti Bersama Waisak',
  '2025-05-29': 'Kenaikan Isa Almasih',
  '2025-05-30': 'Cuti Bersama Kenaikan',
  '2025-06-01': 'Hari Lahir Pancasila',
  '2025-06-06': 'Idul Adha 1446 H',
  '2025-06-09': 'Cuti Bersama Idul Adha',
  '2025-06-26': 'Tahun Baru Islam 1447 H',
  '2025-06-27': 'Cuti Bersama Tahun Baru Islam',
  '2025-08-17': 'Hari Kemerdekaan RI',
  '2025-09-05': 'Maulid Nabi Muhammad SAW',
  '2025-12-25': 'Kelahiran Isa Almasih (Natal)',
  '2025-12-26': 'Cuti Bersama Natal',
  // ---- 2026 (perkiraan) ----
  '2026-01-01': 'Tahun Baru Masehi',
  '2026-02-17': 'Tahun Baru Imlek 2577',
  '2026-03-19': 'Nyepi (Tahun Baru Saka 1948)',
  '2026-03-20': 'Idul Fitri 1447 H (perkiraan)',
  '2026-03-21': 'Idul Fitri 1447 H (perkiraan)',
  '2026-03-23': 'Cuti Bersama Idul Fitri (perkiraan)',
  '2026-04-03': 'Wafat Isa Almasih (Jumat Agung)',
  '2026-04-05': 'Kebangkitan Yesus Kristus (Paskah)',
  '2026-05-01': 'Hari Buruh Internasional',
  '2026-05-14': 'Kenaikan Isa Almasih',
  '2026-05-27': 'Idul Adha 1447 H (perkiraan)',
  '2026-05-31': 'Hari Raya Waisak (perkiraan)',
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-06-17': 'Tahun Baru Islam 1448 H (perkiraan)',
  '2026-08-17': 'Hari Kemerdekaan RI',
  '2026-08-25': 'Maulid Nabi Muhammad SAW (perkiraan)',
  '2026-12-25': 'Kelahiran Isa Almasih (Natal)',
}

// Nama libur untuk tanggal ISO 'YYYY-MM-DD' (null bila bukan libur).
export function namaLibur(iso) {
  return LIBUR_INDONESIA[iso] || null
}

// Semua libur pada bulan tertentu → [{ tanggal, nama }] terurut.
export function liburBulan(tahun, bulan) {
  const prefiks = `${tahun}-${String(bulan + 1).padStart(2, '0')}`
  return Object.entries(LIBUR_INDONESIA)
    .filter(([tgl]) => tgl.startsWith(prefiks))
    .map(([tanggal, nama]) => ({ tanggal, nama }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
}

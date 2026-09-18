import { toISODate, hariIndo, bulanIndo } from './date'
import { detailLibur, liburRentang } from './liburIndonesia'

// ============================================================================
//  Statistik absensi — berbasis PEKAN (Senin → Minggu).
//
//  Pekan Indonesia dimulai hari SENIN dan berakhir hari MINGGU, sehingga satu
//  pekan pada kartu statistik sama persis dengan pekan kerja pada jadwal admin
//  (Sen–Jum, atau Sen–Sab untuk perusahaan 6 hari). Tanggal ditampilkan per
//  pekan: label pekan + nomor tanggal pada setiap batang.
// ============================================================================
export const URUTAN_HARI = [1, 2, 3, 4, 5, 6, 0] // Senin … Minggu (0 = Minggu)
export const HARI_PENDEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
export const HARI_KERJA_DEFAULT = [1, 2, 3, 4, 5]

// Senin 00:00 dari pekan yang memuat `date`; `geser` menggeser per pekan
// (0 = pekan ini, -1 = pekan lalu, +1 = pekan depan).
export function awalPekan(date = new Date(), geser = 0) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + geser * 7) // (getDay()+6)%7 → 0 = Senin
  return d
}

// '15 – 21 Sep 2026' bila sebulan; '29 Sep – 4 Okt 2026' bila lintas bulan/tahun.
export function labelRentangPekan(mulai) {
  const selesai = new Date(mulai)
  selesai.setDate(selesai.getDate() + 6)
  const b = (d) => bulanIndo[d.getMonth()].slice(0, 3)
  const kiri = mulai.getMonth() === selesai.getMonth() ? `${mulai.getDate()}` : `${mulai.getDate()} ${b(mulai)}`
  return `${kiri} – ${selesai.getDate()} ${b(selesai)} ${selesai.getFullYear()}`
}

// Nama pekan relatif terhadap pekan berjalan.
export function namaPekan(geser) {
  if (geser === 0) return 'Pekan ini'
  if (geser === -1) return 'Pekan lalu'
  if (geser === 1) return 'Pekan depan'
  return `${Math.abs(geser)} pekan ${geser < 0 ? 'lalu' : 'depan'}`
}

// Data satu pekan penuh (Senin→Minggu) + rekapnya.
// `hariKerja` = daftar hari kerja dari jadwal server (0 = Minggu … 6 = Sabtu);
// tanggal merah (libur nasional & cuti bersama) tidak dihitung sebagai hari kerja.
export function dataPekan(history = [], { geser = 0, hariKerja = HARI_KERJA_DEFAULT } = {}) {
  const perTanggal = new Map(history.map((h) => [h.tanggal, h]))
  const mulai = awalPekan(new Date(), geser)
  const hariIni = toISODate(new Date())
  const aktif = Array.isArray(hariKerja) && hariKerja.length ? hariKerja : HARI_KERJA_DEFAULT

  const hari = URUTAN_HARI.map((nomor, i) => {
    const d = new Date(mulai)
    d.setDate(mulai.getDate() + i)
    const tanggal = toISODate(d)
    const libur = detailLibur(tanggal)
    return {
      tanggal,
      tgl: d.getDate(),
      hari: hariIndo[nomor],
      namaPendek: HARI_PENDEK[i],
      record: perTanggal.get(tanggal) || null,
      libur,
      akhirPekan: nomor === 0, // kolom Minggu
      hariKerja: aktif.includes(nomor) && !libur,
      hariIni: tanggal === hariIni,
    }
  })

  const hitung = (s) => hari.filter((h) => (h.record?.status || '') === s).length
  const hitungKerja = (s) => hari.filter((h) => h.hariKerja && (h.record?.status || '') === s).length
  const hariKerjaPekan = hari.filter((h) => h.hariKerja).length
  // % kehadiran hanya membandingkan hari kerja dengan kehadiran PADA hari kerja
  // tersebut — sejalan dengan laporan kehadiran panel admin (kehadiran di hari
  // libur dihitung terpisah sebagai "Hadir Libur").
  const masuk = hitungKerja('Hadir') + hitungKerja('Terlambat')
  const rekap = {
    Hadir: hitung('Hadir'),
    Terlambat: hitung('Terlambat'),
    Izin: hitung('Izin'),
    Alpha: hitung('Alpha'),
    hariKerja: hariKerjaPekan,
    masuk,
    // Catatan pada hari libur/akhir pekan (tidak masuk hitungan kehadiran).
    diLuarHariKerja: hari.filter((h) => !h.hariKerja && h.record).length,
    persen: hariKerjaPekan ? Math.round((masuk / hariKerjaPekan) * 100) : 0,
  }

  return {
    geser,
    mulai: hari[0].tanggal,
    selesai: hari[6].tanggal,
    label: labelRentangPekan(mulai),
    nama: namaPekan(geser),
    hari,
    rekap,
    libur: liburRentang(hari[0].tanggal, hari[6].tanggal),
    adaData: hari.some((h) => !!h.record),
  }
}

// Streak hari hadir beruntun (Hadir/Terlambat dihitung hadir). Minggu dan
// tanggal merah tidak memutus streak karena memang bukan hari kerja.
export function hitungStreak(history = []) {
  const perTanggal = new Map(history.map((h) => [h.tanggal, h]))
  const hadir = (r) => r && (r.status === 'Hadir' || r.status === 'Terlambat')
  let streak = 0
  const d = new Date()
  if (!hadir(perTanggal.get(toISODate(d)))) d.setDate(d.getDate() - 1)
  // Batas 400 hari ke belakang: cukup untuk streak realistis & mencegah loop tak berujung.
  for (let i = 0; i < 400; i++) {
    const iso = toISODate(d)
    if (d.getDay() === 0 || detailLibur(iso)) {
      d.setDate(d.getDate() - 1) // libur: lewati, jangan putus
      continue
    }
    if (!hadir(perTanggal.get(iso))) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// Jumlah catatan per status pada beberapa pekan terakhir (dipakai ringkasan cepat).
export function rekapBeberapaPekan(history = [], jumlahPekan = 4, hariKerja = HARI_KERJA_DEFAULT) {
  return Array.from({ length: jumlahPekan }, (_, i) => dataPekan(history, { geser: -i, hariKerja }))
}

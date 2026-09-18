// ============ Util tanggal & waktu ============

export const hariIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
export const bulanIndo = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function formatTanggalLengkap(date = new Date()) {
  return `${hariIndo[date.getDay()]}, ${date.getDate()} ${bulanIndo[date.getMonth()]} ${date.getFullYear()}`
}

export function formatJam(date = new Date()) {
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatTanggalPendek(iso) {
  const d = new Date(iso)
  return `${d.getDate()} ${bulanIndo[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
}

// Tanggal ISO 'YYYY-MM-DD' berbasis WAKTU LOKAL perangkat.
// Catatan: date.toISOString() memakai UTC, sehingga di WIB (UTC+7) pukul
// 00:00–06:59 tanggalnya tergeser ke hari sebelumnya (mis. pegawai check-in
// pukul 06:30 tercatat kemarin). getFullYear/getMonth/getDate selalu lokal.
export function toISODate(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

export function sapaanWaktu(date = new Date()) {
  const h = date.getHours()
  if (h >= 4 && h < 11) return 'Selamat Pagi'
  if (h >= 11 && h < 15) return 'Selamat Siang'
  if (h >= 15 && h < 18) return 'Selamat Sore'
  return 'Selamat Malam'
}

export function durasiKerja(mulai, selesai) {
  const [h1, m1] = mulai.split(':').map(Number)
  const [h2, m2] = selesai.split(':').map(Number)
  const menit = h2 * 60 + m2 - (h1 * 60 + m1)
  return `${Math.floor(menit / 60)} jam ${menit % 60} mnt`
}

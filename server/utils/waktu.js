// ============================================================================
//  Util waktu server — SELALU WIB (Asia/Jakarta, UTC+7).
//
//  Server produksi (Vercel serverless / Render) berjalan di UTC. Jika jam
//  diambil dari getHours() mesin, check-in/check-out akan tercatat 7 jam
//  lebih lambat dari jam pengguna. Intl.DateTimeFormat dengan timeZone
//  eksplisit membuat hasil konsisten di mesin lokal, Vercel, maupun Render.
//  Ubah lewat variabel lingkungan APP_TIMEZONE bila kantor pindah zona.
// ============================================================================
const ZONA = process.env.APP_TIMEZONE || 'Asia/Jakarta'

const format = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23', // tengah malam = '00', bukan '24'
})

export function waktuZona(date = new Date()) {
  const bagian = {}
  for (const p of format.formatToParts(date)) bagian[p.type] = p.value
  return {
    tanggal: `${bagian.year}-${bagian.month}-${bagian.day}`,
    jam: `${bagian.hour}:${bagian.minute}`,
  }
}

// Tanggal hari ini di zona aplikasi → 'YYYY-MM-DD'
export function toISODate(date = new Date()) {
  return waktuZona(date).tanggal
}

// Jam sekarang di zona aplikasi → 'HH:MM'
export function jamSekarang(date = new Date()) {
  return waktuZona(date).jam
}

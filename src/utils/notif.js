// ============ Notifikasi ke layar HP ============
//
// Kenapa perlu plugin native: aplikasi Android NUBSEN berjalan di WebView dan
// WebView TIDAK mengimplementasikan Notification API — 'Notification' in window
// bernilai false di sana, sehingga seluruh notifikasi peramban tidak pernah
// muncul di layar HP. Solusinya plugin LocalNotifications (kanal penting tinggi
// + suara + getar) yang juga bisa MENJADWALKAN pengingat harian via AlarmManager,
// jadi pengingat absen tetap muncul walau aplikasi sedang tertutup.
//
// Di peramban biasa jalur lama tetap dipakai: Service Worker bila ada (muncul
// walau tab di latar belakang), dengan fallback new Notification().
import { diAplikasi, muatPlugin } from './native'

export const KANAL = 'nubsen'
// id tetap untuk pengingat harian (bukan id notifikasi server).
export const ID_PENGINGAT_MASUK = 9001
export const ID_PENGINGAT_PULANG = 9002
// Nama drawable monokrom untuk ikon status bar (res/drawable/ic_stat_nubsen.xml).
const IKON_KECIL = 'ic_stat_nubsen'
const WARNA_IKON = '#4F46E5'

// Id notifikasi server (bisa besar/berupa string) → int32 positif yang stabil.
export function idNotifikasi(asal) {
  const n = Number(asal)
  if (Number.isInteger(n) && n > 0 && n < 2147483647) return n
  const teks = String(asal ?? '')
  let hash = 0
  for (let i = 0; i < teks.length; i++) hash = (hash * 31 + teks.charCodeAt(i)) % 2000000000
  return hash || 1
}

// 'HH:MM' → menit sejak tengah malam; null bila formatnya tidak sah.
export function menitDariJam(hhmm) {
  const cocok = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || '').trim())
  if (!cocok) return null
  return Number(cocok[1]) * 60 + Number(cocok[2])
}

// Geser jam 'HH:MM' sebanyak deltaMenit (untuk pengingat 5 menit sebelum batas).
export function geserJam(hhmm, deltaMenit) {
  const menit = menitDariJam(hhmm)
  if (menit == null) return null
  const total = Math.min(23 * 60 + 59, Math.max(0, menit + deltaMenit))
  return { jam: Math.floor(total / 60), menit: total % 60 }
}

let kanalSiap = false

async function pastikanKanal(LN) {
  if (kanalSiap) return
  try {
    await LN.createChannel({
      id: KANAL,
      name: 'Notifikasi NUBSEN',
      description: 'Pengingat absen, pengumuman, dan keputusan izin/lembur.',
      importance: 5, // IMPORTANCE_HIGH → muncul sebagai heads-up di layar
      visibility: 1, // VISIBILITY_PUBLIC → isi tampil di layar kunci
      vibration: true,
      lights: true,
      lightColor: WARNA_IKON,
    })
  } catch {
    // Kanal bawaan Android tetap dipakai bila pembuatan kanal gagal.
  }
  kanalSiap = true
}

// Minta izin notifikasi + siapkan kanal. Dipakai tombol "Pengingat Absen" dan
// saat aplikasi dibuka supaya notifikasi bisa muncul di layar HP.
// Hasil: 'aplikasi' | 'web' | 'tidak-diizinkan' | 'tidak-didukung'
export async function siapkanNotifikasi() {
  if (diAplikasi()) {
    try {
      const LN = await muatPlugin('LocalNotifications')
      let izin = await LN.checkPermissions().catch(() => null)
      if (!izin || izin.display !== 'granted') {
        izin = await LN.requestPermissions().catch(() => izin)
      }
      await pastikanKanal(LN)
      return izin?.display === 'granted' ? 'aplikasi' : 'tidak-diizinkan'
    } catch {
      return 'tidak-diizinkan'
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return 'tidak-didukung'
  if (Notification.permission === 'granted') return 'web'
  if (Notification.permission === 'denied') return 'tidak-diizinkan'
  const izin = await Notification.requestPermission().catch(() => 'denied')
  return izin === 'granted' ? 'web' : 'tidak-diizinkan'
}

// Notifikasi peramban: Service Worker lebih dulu (tahan tab di latar belakang).
async function tampilkanDiPeramban({ judul, pesan, id }) {
  const badan = [judul, pesan].filter(Boolean).join('\n')
  const opsi = {
    body: badan,
    icon: '/logo-icon.png',
    badge: '/icons/icon-192.png',
    tag: `notif-${id}`,
    data: { url: `${window.location.origin}/#notifikasi` },
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg) {
      await reg.showNotification(judul || 'NUBSEN', opsi)
      return true
    }
  } catch {
    // SW belum siap — lanjut ke notifikasi halaman.
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(judul || 'NUBSEN', opsi)
    return true
  }
  return false
}

// Tampilkan SATU notifikasi di layar HP seketika. Semua jenis dari server
// (pengumuman, penting, jadwal, izin, lembur, absensi) diperlakukan sama.
export async function tampilkanNotifikasi({ id = Date.now(), judul = 'NUBSEN', pesan = '', jenis = 'info' }) {
  if (diAplikasi()) {
    try {
      const LN = await muatPlugin('LocalNotifications')
      await pastikanKanal(LN)
      const izin = await LN.checkPermissions().catch(() => null)
      if (izin && izin.display !== 'granted') return false
      await LN.schedule({
        notifications: [
          {
            id: idNotifikasi(id),
            title: judul || 'NUBSEN',
            body: pesan || '',
            channelId: KANAL,
            smallIcon: IKON_KECIL,
            iconColor: WARNA_IKON,
            group: 'nubsen',
            extra: { jenis },
            // Beberapa saat ke depan: langsung tampil, tanpa alarm berulang.
            schedule: { at: new Date(Date.now() + 1200) },
          },
        ],
      })
      return true
    } catch {
      return false
    }
  }
  return tampilkanDiPeramban({ judul, pesan, id })
}
// Jadwalkan / batalkan pengingat absen HARIAN (masuk & pulang) sesuai jadwal kerja.
// Di Android alarm diulang tiap hari oleh AlarmManager → tetap muncul walau
// aplikasi tertutup. Di peramban tidak ada padanannya (dijaga timer di hook).
export async function jadwalkanPengingat({ aktif, jamMasukBatas = '08:15', jamPulang = '17:00' }) {
  if (!diAplikasi()) return false
  const LN = await muatPlugin('LocalNotifications')
  await LN
    .cancel({ notifications: [{ id: ID_PENGINGAT_MASUK }, { id: ID_PENGINGAT_PULANG }] })
    .catch(() => {})
  if (!aktif) return true
  await pastikanKanal(LN)

  const daftar = []
  const masuk = geserJam(jamMasukBatas, -5) // peringatan 5 menit sebelum batas
  if (masuk) {
    daftar.push({
      id: ID_PENGINGAT_MASUK,
      title: '⏰ Absen masuk',
      body: `Batas absen masuk ${jamMasukBatas}. Jangan lupa selfie + GPS.`,
      ketika: masuk,
    })
  }
  const pulang = geserJam(jamPulang, 0)
  if (pulang) {
    daftar.push({
      id: ID_PENGINGAT_PULANG,
      title: '🏃 Absen pulang',
      body: `Sudah jam ${jamPulang}. Jangan lupa absen pulang — hati-hati di jalan!`,
      ketika: pulang,
    })
  }
  if (!daftar.length) return false

  await LN.schedule({
    notifications: daftar.map((d) => ({
      id: d.id,
      title: d.title,
      body: d.body,
      channelId: KANAL,
      smallIcon: IKON_KECIL,
      iconColor: WARNA_IKON,
      group: 'nubsen',
      // { on } = penjadwalan gaya cron: plugin menghitung waktu berikutnya, lalu
      // menjadwalkan ulang sendiri setelah berbunyi (tiap hari pada jam itu).
      schedule: { on: { hour: d.ketika.jam, minute: d.ketika.menit }, allowWhileIdle: true },
    })),
  })
  return true
}

// Matikan pengingat harian (dipakai saat toggle pengingat dimatikan).
export function batalkanPengingat() {
  return jadwalkanPengingat({ aktif: false })
}

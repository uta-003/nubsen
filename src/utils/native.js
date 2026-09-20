// Deteksi lingkungan + pemuat plugin native Capacitor.
//
// Aplikasi Android NUBSEN memuat halaman dari https://nubsen.vercel.app
// (capacitor.config.json → server.url). Capacitor MENYUNTIKKAN jembatan native
// ke halaman remote itu (Bridge.java: WebViewCompat.addDocumentStartJavaScript
// dengan origin = appUrl), jadi plugin native tetap bisa dipanggil dari bundel
// web yang sama dengan versi PWA — tanpa build terpisah.
//
// Di peramban biasa semua fungsi di sini mengembalikan nilai "tidak ada native"
// sehingga aplikasi tetap berjalan dengan jalur web (Service Worker, unduhan
// Blob, dan halaman Pengaturan notifikasi peramban).
import { Capacitor } from '@capacitor/core'

// true hanya di dalam aplikasi native (Android/iOS).
export function diAplikasi() {
  try {
    return !!Capacitor.isNativePlatform?.()
  } catch {
    return false
  }
}

export function platform() {
  try {
    return Capacitor.getPlatform?.() || 'web'
  } catch {
    return 'web'
  }
}

// Plugin dimuat dengan import() dinamis saat benar-benar dipakai: bundel awal
// (login & absen) tidak ikut membawa kode native.
const pemuat = {
  App: () => import('@capacitor/app').then((m) => m.App),
  Filesystem: () => import('@capacitor/filesystem'),
  Share: () => import('@capacitor/share').then((m) => m.Share),
  LocalNotifications: () => import('@capacitor/local-notifications').then((m) => m.LocalNotifications),
  // Plugin khusus NUBSEN (unduh langsung ke folder Unduhan via MediaStore).
  // registerPlugin bersifat malas: aman dipanggil di web, tapi hanya dipakai
  // ketika diAplikasi() true.
  Nubsen: () => import('@capacitor/core').then((m) => m.registerPlugin('Nubsen')),
}

const cache = new Map()

export function muatPlugin(nama) {
  const ambil = pemuat[nama]
  if (!ambil) return Promise.reject(new Error(`Plugin ${nama} tidak dikenal.`))
  if (!cache.has(nama)) cache.set(nama, ambil())
  return cache.get(nama).catch(async (e) => {
    // Chunk plugin gagal dimuat (bundel basi setelah deploy) — bersihkan cache &
    // muat ulang sekali; bila tetap gagal, lempar ulang agar UI bisa memberi tahu.
    cache.delete(nama)
    const { pulihkanBundel } = await import('./pulihkan')
    const memuatUlang = await pulihkanBundel()
    if (memuatUlang) {
      throw new Error('Aplikasi sedang diperbarui — coba lagi setelah halaman terbuka.')
    }
    cache.set(nama, ambil())
    return cache.get(nama)
  })
}

// Menutup aplikasi Android — dipanggil LANGSUNG saat tombol Back ditekan di
// Beranda atau layar login, tanpa dialog konfirmasi (lihat App.jsx +
// MainActivity.java). Jalur utama Nubsen.keluar() murni native (tanpa chunk
// dinamis — mustahil gagal karena masalah jaringan); plugin App bawaan hanya
// cadangan.
export async function keluarAplikasi() {
  if (!diAplikasi()) return false
  try {
    const Nubsen = await muatPlugin('Nubsen')
    await Nubsen.keluar()
    return true
  } catch {
    // Cadangan: APK lama tanpa plugin Nubsen.
    try {
      const App = await muatPlugin('App')
      await App.exitApp()
      return true
    } catch {
      return false
    }
  }
}

// Nomor versi aplikasi native (ditampilkan di Profil) — 'web' bila bukan APK.
export async function infoAplikasi() {
  if (!diAplikasi()) return { versi: null, build: null, platform: 'web' }
  try {
    const App = await muatPlugin('App')
    const info = await App.getInfo()
    return { versi: info.version, build: info.build, platform: platform() }
  } catch {
    return { versi: null, build: null, platform: platform() }
  }
}

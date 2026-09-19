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
}

const cache = new Map()

export function muatPlugin(nama) {
  const ambil = pemuat[nama]
  if (!ambil) return Promise.reject(new Error(`Plugin ${nama} tidak dikenal.`))
  if (!cache.has(nama)) cache.set(nama, ambil())
  return cache.get(nama)
}

// Menutup aplikasi Android — dipanggil HANYA setelah user menekan "Keluar" pada
// dialog konfirmasi (lihat hooks/useTombolKembali.js + components/Konfirmasi.jsx).
export async function keluarAplikasi() {
  if (!diAplikasi()) return false
  try {
    const App = await muatPlugin('App')
    await App.exitApp()
    return true
  } catch {
    return false
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

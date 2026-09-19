// Pemulihan otomatis saat bundel basi.
//
// Latar: aplikasi Android memuat halaman dari https://nubsen.vercel.app dan Service
// Worker meng-cache aset. Bila perangkat sempat luring/di dalam masa deploy, WebView
// bisa menjalankan bundel LAMA yang chunk dinamisnya (PDF/Excel/pustaka plugin)
// sudah dihapus Vercel setelah deploy baru → setiap import() dinamis gagal dengan
// "failed to fetch dynamically imported module". Fungsi ini membersihkan seluruh
// cache SW lalu memuat ulang halaman SEKALI — setelah itu semua chunk baru terjangkau.
const KUNCI_SESI = 'absenku.pulihkan'

export async function pulihkanBundel() {
  try {
    if (sessionStorage.getItem(KUNCI_SESI)) return false // sudah pernah — jangan berputar
    sessionStorage.setItem(KUNCI_SESI, '1')
  } catch {
    // Penyimpanan diblokir (mode privat) — tetap coba bersih-bersih di bawah.
  }
  // Luring: memuat ulang percuma (chunk baru juga tak terjangkau) — biarkan pemanggil
  // menampilkan pesan yang jelas sebagai gantinya.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    try { sessionStorage.removeItem(KUNCI_SESI) } catch { /* abaikan */ }
    return false
  }
  try {
    const daftar = (await caches?.keys?.()) ?? []
    await Promise.all(daftar.filter((k) => k.startsWith('absenku-')).map((k) => caches.delete(k)))
  } catch {
    // Tidak ada Cache API — lanjut.
  }
  try {
    const daftar = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(daftar.map((sw) => sw.unregister()))
  } catch {
    // Tanpa Service Worker — lanjut.
  }
  setTimeout(() => location.replace(location.href), 120)
  return true // halaman akan memuat ulang
}

export function terakhirGagalMuat(e) {
  return /failed to fetch dynamically imported|dynamically imported module|importing a module/i.test(
    String(e?.message || e),
  )
}

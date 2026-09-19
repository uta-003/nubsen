import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { tutupTeratas } from './utils/kembali'
import './index.css'

// Jembatan tombol Back native → React: MainActivity memanggil fungsi ini lewat
// evaluateJavascript setiap tombol Back HP ditekan. Mengembalikan '1' bila web
// menangani sendiri (tutup modal → kembali ke Beranda → tampilkan dialog keluar
// versi web yang estetik); '' bila web belum siap — native lalu menampilkan
// dialog cadangannya. Fungsi detail (__nubsenHandleBack) dipasang oleh App.jsx
// sehingga SELALU membaca state halaman terbaru.
window.__nubsenBack = () => {
  try {
    if (typeof window.__nubsenHandleBack === 'function') {
      return String(window.__nubsenHandleBack() || '')
    }
    return tutupTeratas() ? '1' : ''
  } catch {
    return ''
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

// Registrasi Service Worker — hanya di PWA/peramban. DI APLIKASI ANDROID (Capacitor)
// SW justru BERBAHAYA: ia menyimpan bundel di cache dan menyajikannya walau APK
// sudah diperbarui — inilah sebab perbaikan lama "tidak pernah jalan" di HP
// (HP menjalankan bundel basi dari cache SW). Aset APK sudah lokal, jadi tidak
// perlu offline-cache tambahan apa pun.
if ('serviceWorker' in navigator && import.meta.env.PROD && !window.Capacitor) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW opsional — aplikasi tetap berjalan tanpa dukungan offline */
    })
  })
}


import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { tutupTeratas } from './utils/kembali'
import './index.css'

// Jembatan tombol Back native → React: MainActivity memanggil fungsi ini lewat
// evaluateJavascript saat tombol Back HP ditekan. Mengembalikan '1' bila ada
// modal/sheet yang berhasil ditutup, '' bila tidak (native lalu menampilkan
// dialog konfirmasi keluar). Didefinisikan SEBELUM render React supaya sudah
// ada walau web masih memuat — tidak bergantung pada jembatan Capacitor.
window.__nubsenTutupModal = () => {
  try {
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

// Registrasi Service Worker (hanya di build produksi agar tidak mengganggu HMR dev).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW opsional — aplikasi tetap berjalan tanpa dukungan offline */
    })
  })
}

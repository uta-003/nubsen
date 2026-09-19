import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import * as api from '../api'
import { diAplikasi } from '../utils/native'
import { tampilkanNotifikasi } from '../utils/notif'

const KUNCI_TERLIHAT = 'absenku.notif.terlihat'

// Notifikasi yang layak muncul sebagai pemberitahuan peramban (OS): perubahan
// jadwal, pengumuman penting, serta KEPUTUSAN pengajuan (izin/cuti & lembur
// disetujui/ditolak) — bukan konfirmasi pengiriman milik user sendiri.
const layakPemberitahuan = (n) =>
  n.jenis === 'jadwal' || n.jenis === 'penting' || /disetujui|ditolak/i.test(n.judul || '')

// Tampilkan pemberitahuan di layar HP.
//  • Aplikasi Android: WebView tidak mengimplementasikan Notification API →
//    semua notifikasi dialirkan ke plugin LocalNotifications (heads-up + getar
//    + ikon status bar), jadi SEMUA notifikasi NUBSEN tampil di layar.
//  • Peramban: via Service Worker bila tersedia (jalan juga saat tab di latar
//    belakang), fallback ke Notification halaman (mode dev tanpa SW).
async function kirimPemberitahuan(n) {
  const body = [n.judul, n.pesan].filter(Boolean).join('\n')
  if (diAplikasi()) {
    try {
      await tampilkanNotifikasi({ id: n.id ?? Date.now(), judul: 'NUBSEN', pesan: body, jenis: n.jenis })
      return
    } catch { /* jatuh ke jalur peramban */ }
  }
  const opsi = {
    body,
    icon: '/logo-icon.png',
    badge: '/icons/icon-192.png',
    tag: `notif-${n.id}`, // dedupe: notifikasi yang sama tak menumpuk
    data: { url: `${self.location.origin}/#notifikasi` },
  }
  try {
    if (navigator.serviceWorker) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.showNotification('NUBSEN', opsi)
        return
      }
    }
  } catch { /* SW tidak siap — jatuh ke fallback halaman */ }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('NUBSEN', { body, tag: opsi.tag })
  }
}

// Lonceng notifikasi dengan badge jumlah belum dibaca.
// Sinkron INSTAN lewat event 'absenku:notif' (dipicu halaman Notifikasi saat dibaca),
// plus polling cadangan tiap 30 detik untuk notifikasi baru dari admin.
// Notifikasi BARU bertipe 'jadwal'/'penting' juga muncul sebagai pemberitahuan
// peramban (lihat kirimPemberitahuan) — posisi baca terakhir disimpan lokal.
export default function NotifikasiBell({ onClick }) {
  const [belum, setBelum] = useState(0)

  useEffect(() => {
    let hidup = true
    const cek = () =>
      api
        .getNotifikasi()
        .then((d) => {
          if (!hidup) return
          setBelum(d.belumDibaca)
          // ---- Pemberitahuan peramban untuk item baru (sejak cek terakhir) ----
          const items = d.items || []
          if (items.length === 0) return
          const idMaks = Math.max(...items.map((n) => n.id))
          let terlihat = 0
          try { terlihat = Number(localStorage.getItem(KUNCI_TERLIHAT) || 0) } catch { /* abaikan */ }
          const baru = items.filter((n) => n.id > terlihat && layakPemberitahuan(n))
          try { localStorage.setItem(KUNCI_TERLIHAT, String(Math.max(terlihat, idMaks))) } catch { /* abaikan */ }
          if (terlihat === 0) return // kunjungan pertama: jangan banjir notifikasi lama
          for (const n of baru.slice(0, 3)) kirimPemberitahuan(n)
        })
        .catch(() => {})
    const onSinkron = (e) => setBelum(e.detail?.belumDibaca ?? 0)
    cek()
    window.addEventListener('absenku:notif', onSinkron)
    // Pemicu pemeriksaan manual (uji/probe atau pembaruan lain) tanpa menunggu 30 dtk.
    window.addEventListener('absenku:cek-notif', cek)
    const t = setInterval(cek, 30000)
    return () => {
      hidup = false
      clearInterval(t)
      window.removeEventListener('absenku:notif', onSinkron)
      window.removeEventListener('absenku:cek-notif', cek)
    }
  }, [])

  return (
    <button
      onClick={onClick}
      className="relative grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white/80 text-slate-600 shadow-sm backdrop-blur transition active:scale-90 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300"
      aria-label={`Notifikasi (${belum} belum dibaca)`}
    >
      <Bell size={20} />
      {belum > 0 && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow">
          {belum > 9 ? '9+' : belum}
        </span>
      )}
    </button>
  )
}

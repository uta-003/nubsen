import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import * as api from '../api'

// Lonceng notifikasi dengan badge jumlah belum dibaca.
// Sinkron INSTAN lewat event 'absenku:notif' (dipicu halaman Notifikasi saat dibaca),
// plus polling cadangan tiap 30 detik untuk notifikasi baru dari admin.
export default function NotifikasiBell({ onClick }) {
  const [belum, setBelum] = useState(0)

  useEffect(() => {
    let hidup = true
    const cek = () =>
      api
        .getNotifikasi()
        .then((d) => hidup && setBelum(d.belumDibaca))
        .catch(() => {})
    const onSinkron = (e) => setBelum(e.detail?.belumDibaca ?? 0)
    cek()
    window.addEventListener('absenku:notif', onSinkron)
    const t = setInterval(cek, 30000)
    return () => {
      hidup = false
      clearInterval(t)
      window.removeEventListener('absenku:notif', onSinkron)
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

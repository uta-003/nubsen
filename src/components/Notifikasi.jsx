import { useEffect, useState } from 'react'
import {
  Bell, Info, CalendarPlus, Clock4, CalendarCheck2, CheckCheck, Loader2, Megaphone, AlertTriangle, CalendarClock,
} from 'lucide-react'
import { getNotifikasi, tandaiNotifikasiDibaca } from '../api'

const JENIS = {
  pengumuman: { Icon: Megaphone, warna: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400', label: 'Pengumuman' },
  penting: { Icon: AlertTriangle, warna: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400', label: 'Penting' },
  info: { Icon: Info, warna: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', label: 'Info' },
  jadwal: { Icon: CalendarClock, warna: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400', label: 'Jadwal' },
  lembur: { Icon: Clock4, warna: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400', label: 'Lembur' },
  izin: { Icon: CalendarPlus, warna: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400', label: 'Izin / Cuti' },
  absensi: { Icon: CalendarCheck2, warna: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
}

const formatWaktu = (s) => {
  try {
    return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('id-ID', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return s
  }
}

// Kotak masuk notifikasi — bersumber dari backend (admin & sistem).
export default function Notifikasi() {
  const [items, setItems] = useState([])
  const [belum, setBelum] = useState(0)
  const [memuat, setMemuat] = useState(true)
  const [memproses, setMemproses] = useState(false)

  const muat = () =>
    getNotifikasi()
      .then((d) => {
        setItems(d.items)
        setBelum(d.belumDibaca)
        // Beri tahu lonceng di header agar badge langsung sinkron (tanpa menunggu polling 30 dtk)
        window.dispatchEvent(new CustomEvent('absenku:notif', { detail: { belumDibaca: d.belumDibaca } }))
      })
      .catch(() => {})
      .finally(() => setMemuat(false))

  useEffect(() => {
    muat()
    // Periksa notifikasi/pengumuman baru dari admin setiap 30 detik.
    const t = setInterval(muat, 30000)
    return () => clearInterval(t)
  }, [])

  const tandai = async () => {
    setMemproses(true)
    // OPTIMISTIK: hilangkan badge & highlight merah seketika, sinkron ke server di belakang
    setBelum(0)
    setItems((arr) => arr.map((n) => ({ ...n, dibaca: true })))
    window.dispatchEvent(new CustomEvent('absenku:notif', { detail: { belumDibaca: 0 } }))
    try {
      await tandaiNotifikasiDibaca()
      await muat()
    } finally {
      setMemproses(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-extrabold tracking-tight">
            <Bell size={18} className="text-indigo-500" /> Notifikasi
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {belum > 0 ? `${belum} belum dibaca` : 'Semua sudah dibaca ✅'}
          </p>
        </div>
        {belum > 0 && (
          <button
            onClick={tandai}
            disabled={memproses}
            className="flex items-center gap-1.5 rounded-2xl bg-indigo-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/30 transition active:scale-95 disabled:opacity-50"
          >
            {memproses ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={14} />} Tandai Dibaca
          </button>
        )}
      </div>

      {memuat ? (
        <p className="text-xs text-slate-400">Memuat…</p>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-3xl bg-indigo-50 text-indigo-400 dark:bg-indigo-500/10">
            <Bell size={26} />
          </span>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Belum ada notifikasi</p>
          <p className="max-w-[16rem] text-xs leading-relaxed text-slate-400">
            Pengumuman dari admin serta update izin &amp; lembur Anda akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          {items.map((n) => {
            const { Icon, warna, label } = JENIS[n.jenis] || JENIS.info
            const penting = n.jenis === 'penting'
            return (
              <div
                key={n.id}
                className={`card flex items-start gap-3 p-4 ${
                  !n.dibaca
                    ? penting
                      ? 'ring-1 ring-rose-200 dark:ring-rose-500/30'
                      : 'ring-1 ring-indigo-200 dark:ring-indigo-500/30'
                    : 'opacity-75'
                }`}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${warna}`}>
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  {label && (
                    <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${warna}`}>
                      {label}
                    </span>
                  )}
                  <p className={`text-sm ${n.dibaca ? 'font-semibold text-slate-600 dark:text-slate-300' : 'font-bold'}`}>
                    {n.judul}
                  </p>
                  {n.pesan && <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{n.pesan}</p>}
                  <p className="mt-1 text-[10px] text-slate-400">{formatWaktu(n.dibuat)}</p>
                </div>
                {!n.dibaca && (
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${penting ? 'bg-rose-500' : 'bg-indigo-500'}`} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import {
  Megaphone, Info, AlertTriangle, Loader2, RefreshCw, SearchX, Check, CheckCheck, CalendarClock, Bell, ChevronRight,
} from 'lucide-react'
import { getNotifikasi, tandaiNotifikasiDibaca } from '../api'

const JENIS = {
  pengumuman: { Icon: Megaphone, warna: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400', label: 'Pengumuman' },
  penting: { Icon: AlertTriangle, warna: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400', label: 'Penting' },
  jadwal: { Icon: CalendarClock, warna: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400', label: 'Jadwal' },
  info: { Icon: Info, warna: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', label: 'Info' },
}

const formatWaktu = (s) => {
  try {
    return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('id-ID', {
      dateStyle: 'long', timeStyle: 'short',
    })
  } catch {
    return s
  }
}

// Feed Pengumuman — khusus kabar perusahaan (jenis pengumuman/penting/info/jadwal).
// Setiap kartu bisa DITANDAI DIBACA sendiri (tombol centang), plus tombol
// "Tandai Semua" di header. Badge lonceng notifikasi TIDAK terpengaruh —
// keduanya kini kategori terpisah.
export default function Pengumuman({ onBukaNotifikasi }) {
  const [items, setItems] = useState([])
  const [belum, setBelum] = useState(0)
  const [memuat, setMemuat] = useState(true)
  const [penyaring, setPenyaring] = useState('semua')
  const [memproses, setMemproses] = useState(null) // id item yang sedang ditandai | 'semua'

  const muat = () =>
    getNotifikasi()
      .then((d) => {
        setItems(d.pengumuman)
        setBelum(d.belumDibacaPengumuman)
        // Badge megafon (App) + lonceng (kategori berbeda) tetap sinkron.
        window.dispatchEvent(new CustomEvent('absenku:pengumuman', { detail: { belumDibaca: d.belumDibacaPengumuman } }))
        window.dispatchEvent(new CustomEvent('absenku:notif', { detail: { belumDibaca: d.belumDibaca } }))
      })
      .catch(() => {})
      .finally(() => setMemuat(false))

  useEffect(() => {
    muat()
    const t = setInterval(muat, 30000)
    return () => clearInterval(t)
  }, [])

  const tandaiSatu = async (id) => {
    if (memproses != null) return
    setMemproses(id)
    // Optimistik: tandai di UI seketika, server menyusul.
    setItems((arr) => arr.map((n) => (n.id === id ? { ...n, dibaca: true } : n)))
    setBelum((b) => Math.max(0, b - 1))
    try {
      await tandaiNotifikasiDibaca({ id })
    } finally {
      setMemproses(null)
      muat()
    }
  }

  const tandaiSemua = async () => {
    if (memproses != null || belum === 0) return
    setMemproses('semua')
    setItems((arr) => arr.map((n) => ({ ...n, dibaca: true })))
    setBelum(0)
    try {
      await tandaiNotifikasiDibaca({ pengumuman: true })
    } finally {
      setMemproses(null)
      muat()
    }
  }

  const terfilter = items.filter((n) => penyaring === 'semua' || n.jenis === penyaring)

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-extrabold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/30">
              <Megaphone size={17} />
            </span>
            Pengumuman
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {belum > 0 ? `${belum} belum dibaca` : 'Semua sudah dibaca ✅'}
          </p>
        </div>
        {belum > 0 && (
          <button
            onClick={tandaiSemua}
            disabled={memproses != null}
            className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/30 transition active:scale-95 disabled:opacity-50"
          >
            {memproses === 'semua' ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={14} />} Tandai Semua
          </button>
        )}
      </div>

      {/* Pengarah lintas menu: hasil pengajuan pribadi ada di 🔔 Notifikasi. */}
      {onBukaNotifikasi && (
        <button
          type="button"
          onClick={onBukaNotifikasi}
          className="mb-3 flex w-full items-center gap-2.5 rounded-2xl border border-indigo-200/70 bg-gradient-to-r from-indigo-50 to-fuchsia-50 p-3 text-left transition active:scale-[0.99] dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-fuchsia-500/5"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-md shadow-indigo-500/30">
            <Bell size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-indigo-800 dark:text-indigo-200">Mencari hasil pengajuan Anda?</span>
            <span className="block text-[11px] text-indigo-700/80 dark:text-indigo-300/70">
              Persetujuan izin, lembur, absensi, dan gaji ada di menu Notifikasi
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-indigo-500" />
        </button>
      )}

      {/* Penyaring jenis */}
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        {[
          ['semua', 'Semua'],
          ['pengumuman', 'Pengumuman'],
          ['penting', 'Penting'],
          ['jadwal', 'Jadwal'],
          ['info', 'Info'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setPenyaring(id)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition active:scale-95 ${
              penyaring === id
                ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30'
                : 'border border-slate-200 bg-white/80 text-slate-500 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={muat}
          className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white/80 text-slate-500 backdrop-blur transition active:scale-90 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300"
          aria-label="Muat ulang"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {memuat ? (
        <div className="card flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" /> Memuat pengumuman…
        </div>
      ) : terfilter.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-3xl bg-amber-50 text-amber-400 dark:bg-amber-500/10">
            <SearchX size={26} />
          </span>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Belum ada pengumuman</p>
          <p className="max-w-[16rem] text-xs leading-relaxed text-slate-400">
            Pengumuman, jadwal, dan kabar penting dari perusahaan akan tampil di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          {terfilter.map((n, i) => {
            const { Icon, warna, label } = JENIS[n.jenis] || JENIS.info
            const penting = n.jenis === 'penting'
            return (
              <div
                key={n.id}
                className={`card animate-rise flex items-start gap-3 p-4 transition ${penting ? 'ring-1 ring-rose-200 dark:ring-rose-500/30' : ''} ${n.dibaca ? 'opacity-70' : ''}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${warna}`}>
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${warna}`}>
                      {label}
                    </span>
                    {!n.dibaca && (
                      <span className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-2 py-0.5 text-[9px] font-bold text-white">
                        BARU
                      </span>
                    )}
                  </div>
                  <p className={`text-sm ${n.dibaca ? 'font-semibold text-slate-600 dark:text-slate-300' : 'font-bold'}`}>
                    {n.judul}
                  </p>
                  {n.pesan && (
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {n.pesan}
                    </p>
                  )}
                  <p className="mt-1.5 text-[10px] font-semibold text-slate-400">{formatWaktu(n.dibuat)}</p>
                </div>
                {/* Tandai satu sebagai dibaca — hanya bila belum dibaca */}
                {!n.dibaca && (
                  <button
                    onClick={() => tandaiSatu(n.id)}
                    disabled={memproses != null}
                    title="Tandai sudah dibaca"
                    aria-label="Tandai sudah dibaca"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 transition active:scale-90 disabled:opacity-40 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                  >
                    {memproses === n.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

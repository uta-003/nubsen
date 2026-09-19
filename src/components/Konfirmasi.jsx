import { useState } from 'react'
import { TriangleAlert, X } from 'lucide-react'
import { usePenutupKembali } from '../hooks/useTombolKembali'

// Dialog konfirmasi seragam (dipakai untuk keluar aplikasi, logout, dsb.).
// - Gaya bottom-sheet di ponsel & tengah layar di sm ke atas, sama seperti modal
//   lain (Bantuan/RiwayatDetail) supaya bahasa visualnya konsisten.
// - Tombol Back Android ikut menutup dialog ini (usePenutupKembali).
// - `onYa` boleh async: tombol menampilkan status "Memproses…" dan tidak bisa
//   ditekan dua kali.
const NADA = {
  bahaya: {
    ikon: 'bg-gradient-to-br from-rose-500 to-red-600 text-white',
    glow: 'bg-rose-500',
    tombol: 'bg-gradient-to-r from-rose-500 to-red-600 shadow-rose-500/30',
  },
  peringatan: {
    ikon: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white',
    glow: 'bg-amber-500',
    tombol: 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-amber-500/30',
  },
  info: {
    ikon: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white',
    glow: 'bg-indigo-500',
    tombol: 'bg-gradient-to-r from-indigo-500 to-violet-600 shadow-indigo-500/30',
  },
}

export default function Konfirmasi({
  open,
  judul = 'Lanjutkan?',
  pesan,
  labelYa = 'Ya, lanjutkan',
  labelTidak = 'Batal',
  nada = 'info',
  Ikon = TriangleAlert,
  onYa,
  onTidak,
  catatan,
}) {
  const [proses, setProses] = useState(false)
  usePenutupKembali(!!open, () => !proses && onTidak?.())

  if (!open) return null
  const gaya = NADA[nada] || NADA.info

  const ya = async () => {
    if (proses) return
    setProses(true)
    try {
      await onYa?.()
    } finally {
      setProses(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex animate-fade-in items-end justify-center bg-black/70 px-3 pb-0 sm:items-center sm:px-4"
      onClick={() => !proses && onTidak?.()}
      role="dialog"
      aria-modal="true"
      aria-label={judul}
    >
      <div
        className="w-full max-w-sm animate-slide-up rounded-t-[2rem] bg-white p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-2xl dark:bg-slate-900 sm:rounded-[2rem] sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${gaya.ikon}`}>
              <Ikon size={20} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold leading-tight">{judul}</h3>
              {pesan && (
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{pesan}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => !proses && onTidak?.()}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90 dark:bg-slate-800"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {catatan && (
          <p className="mb-4 rounded-2xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
            {catatan}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => !proses && onTidak?.()} disabled={proses} className="btn-ghost flex-1 !py-3 text-sm disabled:opacity-50">
            {labelTidak}
          </button>
          <button
            type="button"
            onClick={ya}
            disabled={proses}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition active:scale-95 disabled:opacity-60 ${gaya.tombol}`}
          >
            {proses ? 'Memproses…' : labelYa}
          </button>
        </div>
      </div>
    </div>
  )
}
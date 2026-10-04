import {
  X, Megaphone, Info, AlertTriangle, CalendarClock, Clock4, Brush, CalendarPlus,
  CalendarCheck2, Wallet, Check, Loader2, CheckCheck,
} from 'lucide-react'
import { usePenutupKembali } from '../hooks/useTombolKembali'

// Peta jenis pesan (gabungan Pengumuman + Notifikasi) — ikon & warna seragam
// agar kartu & lembar detail selalu tampil konsisten.
const JENIS = {
  pengumuman: { Icon: Megaphone, warna: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400', label: 'Pengumuman' },
  penting: { Icon: AlertTriangle, warna: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400', label: 'Penting' },
  jadwal: { Icon: CalendarClock, warna: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400', label: 'Jadwal' },
  info: { Icon: Info, warna: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', label: 'Info' },
  lembur: { Icon: Clock4, warna: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400', label: 'Lembur' },
  piket: { Icon: Brush, warna: 'bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400', label: 'Piket' },
  izin: { Icon: CalendarPlus, warna: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400', label: 'Izin / Cuti' },
  absensi: { Icon: CalendarCheck2, warna: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400', label: 'Absensi' },
  gaji: { Icon: Wallet, warna: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400', label: 'Gaji' },
  peringatan: { Icon: AlertTriangle, warna: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400', label: 'Peringatan' },
}

const formatWaktu = (s) => {
  try {
    return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('id-ID', {
      dateStyle: 'full', timeStyle: 'short',
    })
  } catch {
    return s
  }
}

// Lembar DETAIL satu pesan (pengumuman maupun notifikasi) — dibuka saat kartu
// diketik. Menampilkan judul, isi lengkap, waktu, jenis, dan status baca.
// `onTandai` (opsional) memunculkan tombol "Tandai sudah dibaca".
export default function PesanDetail({ item, onClose, onTandai, memproses = false }) {
  usePenutupKembali(!!item, onClose)
  if (!item) return null
  const { Icon, warna, label } = JENIS[item.jenis] || JENIS.info
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[86vh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-2xl dark:bg-slate-900 sm:rounded-[2rem] sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${warna}`}>
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${warna}`}>
              {label}
            </span>
            <h3 className="mt-1.5 text-base font-extrabold leading-snug">{item.judul}</h3>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        {item.pesan ? (
          <p className="whitespace-pre-line rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
            {item.pesan}
          </p>
        ) : (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-400 dark:bg-slate-800/70">
            Tidak ada isi pesan.
          </p>
        )}

        <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <Clock4 size={12} /> {formatWaktu(item.dibuat)}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          {item.dibaca ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCheck size={13} /> Sudah dibaca
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3 py-1.5 text-[11px] font-bold text-white">
              Belum dibaca
            </span>
          )}
          {onTandai && !item.dibaca && (
            <button
              onClick={onTandai}
              disabled={memproses}
              className="btn-primary !px-4 !py-2.5 !text-xs disabled:opacity-50"
            >
              {memproses ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Tandai sudah dibaca
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

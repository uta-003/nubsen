import { CalendarPlus, Clock4, Brush } from 'lucide-react'
import Izin from './Izin'
import Lembur from './Lembur'
import Piket from './Piket'

// Halaman "Pengajuan" — Izin/Cuti, Lembur & Piket digabung dalam SATU tab
// bottom-nav. Pemilih sub-halaman bergaya segmen kaca dengan indikator gradasi
// mengglide.
export default function Pengajuan({ jenis = 'izin', onJenis, onSubmit, sisaCuti = null, toast }) {
  const PILIHAN = [
    { id: 'izin', label: 'Izin / Cuti', Icon: CalendarPlus },
    { id: 'lembur', label: 'Lembur', Icon: Clock4 },
    { id: 'piket', label: 'Piket', Icon: Brush },
  ]

  return (
    <div>
      {/* Segmen kaca: pil aktif bergradasi & berkilau, meluncur halus saat berganti */}
      <div
        className="mb-4 grid grid-cols-3 gap-1 rounded-[1.4rem] border border-white/50 bg-white/70 p-1.5 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70"
        role="tablist"
        aria-label="Jenis pengajuan"
      >
        {PILIHAN.map(({ id, label, Icon }) => {
          const aktif = jenis === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={aktif}
              onClick={() => !aktif && onJenis?.(id)}
              className={`relative flex items-center justify-center gap-1.5 overflow-hidden rounded-[1rem] py-2.5 text-xs font-bold transition-all duration-300 active:scale-[0.97] ${
                aktif
                  ? 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={16} className="shrink-0" /> {label}
            </button>
          )
        })}
      </div>

      {/* Izin, Lembur & Piket masing-masing sudah punya akar animate-fade-in, jadi
          saat sub-halaman berganti komponen lama dicopot & baru masuk dengan animasi. */}
      {jenis === 'lembur'
        ? <Lembur toast={toast} />
        : jenis === 'piket'
          ? <Piket toast={toast} />
          : <Izin onSubmit={onSubmit} sisaCuti={sisaCuti} toast={toast} />}
    </div>
  )
}
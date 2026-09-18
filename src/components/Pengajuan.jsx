import { CalendarPlus, Clock4 } from 'lucide-react'
import Izin from './Izin'
import Lembur from './Lembur'

// Halaman "Pengajuan" — Izin/Cuti & Lembur digabung dalam SATU tab bottom-nav
// supaya bar navigasi tetap 4 item (Beranda, Pengajuan, Riwayat, Profil) dan
// lapang di ponsel sempit. Pemilih sub-halaman (pill) dipegang App (state
// `jenisPengajuan`) agar pintasan izin di Beranda bisa membuka langsung formulir
// Izin, dan hash lama #izin / #lembur tetap berfungsi.
export default function Pengajuan({ jenis = 'izin', onJenis, onSubmit, sisaCuti = null, toast }) {
  const PILIHAN = [
    { id: 'izin', label: 'Izin / Cuti', Icon: CalendarPlus },
    { id: 'lembur', label: 'Lembur', Icon: Clock4 },
  ]

  return (
    <div>
      {/* Pemilih sub-halaman — gaya sama dengan navigasi pekan di kartu Statistik */}
      <div
        className="mb-4 flex gap-1 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800"
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
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition active:scale-[0.97] ${
                aktif
                  ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={16} className="shrink-0" /> {label}
            </button>
          )
        })}
      </div>

      {/* Izin & Lembur masing-masing sudah punya akar animate-fade-in, jadi saat
          sub-halaman berganti komponen lama dicopot & baru masuk dengan animasi. */}
      {jenis === 'lembur' ? <Lembur toast={toast} /> : <Izin onSubmit={onSubmit} sisaCuti={sisaCuti} toast={toast} />}
    </div>
  )
}
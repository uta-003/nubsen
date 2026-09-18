import { Home, CalendarPlus, History, User } from 'lucide-react'

// Navigasi bawah aplikasi karyawan — TETAP 4 tab (Beranda, Pengajuan, Riwayat,
// Profil) supaya bar-nya lapang & estetik di ponsel sempit (320–360 px). Izin/Cuti
// dan Lembur digabung menjadi SATU tab "Pengajuan" — pemilih sub-halamannya ada
// di dalam halaman (Pengajuan.jsx). Panel Admin tidak jadi tab di sini; pintu
// masuknya lewat tombol perisai di header aplikasi.
// v2: tanpa lapisan pembatas — konten berhenti di atas nav via padding halaman.
export default function BottomNav({ active, onChange }) {
  const items = [
    { id: 'dashboard', label: 'Beranda', Icon: Home },
    { id: 'pengajuan', label: 'Pengajuan', Icon: CalendarPlus },
    { id: 'riwayat', label: 'Riwayat', Icon: History },
    { id: 'profil', label: 'Profil', Icon: User },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40">
      {/* Pembatas bawah: strip selebar layar penuh, warnanya = latar aplikasi
          (slate-100 / slate-950) sehingga menyatu dengan halaman — bukan kotak.
          Fade pendek 0.75rem di atasnya membuat batas terlihat halus. Konten yang
          discroll tertutup total: tidak terlihat di belakang maupun di samping pill. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0">
        <div className="h-3 bg-gradient-to-b from-transparent to-slate-100 dark:to-slate-950" />
        <div className="h-[5.75rem] bg-slate-100 dark:bg-slate-950" />
      </div>
      <div className="relative mx-auto max-w-md px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:px-4">
        <div className="flex items-stretch rounded-3xl border border-slate-200/80 bg-white p-1 shadow-soft dark:border-slate-700/70 dark:bg-slate-900 sm:p-1.5">
        {items.map(({ id, label, Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-0.5 py-1.5 text-[9px] font-semibold leading-none transition sm:text-[10px] ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition sm:h-9 sm:w-9 ${
                  isActive
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/40'
                    : 'bg-transparent'
                }`}
              >
                <Icon size={17} />
              </span>
              <span className="w-full truncate text-center">{label}</span>
            </button>
          )
        })}
        </div>
      </div>
    </nav>
  )
}

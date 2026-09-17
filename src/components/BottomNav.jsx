import { Home, CalendarPlus, History, User, Shield, Clock4 } from 'lucide-react'

// Navigasi bawah dinamis: Lembur selalu ada; tab Admin hanya untuk is_admin.
export default function BottomNav({ active, onChange, isAdmin = false }) {
  const items = [
    { id: 'dashboard', label: 'Beranda', Icon: Home },
    { id: 'izin', label: 'Izin', Icon: CalendarPlus },
    { id: 'lembur', label: 'Lembur', Icon: Clock4 },
    { id: 'riwayat', label: 'Riwayat', Icon: History },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', Icon: Shield }] : []),
    { id: 'profil', label: 'Profil', Icon: User },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <div className="flex items-center justify-around rounded-3xl border border-white/60 bg-white/90 px-1.5 py-2 shadow-soft backdrop-blur-lg dark:border-slate-700/60 dark:bg-slate-900/90">
        {items.map(({ id, label, Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex flex-col items-center gap-0.5 rounded-2xl px-2.5 py-1.5 text-[10px] font-semibold transition ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-xl transition ${
                  isActive
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/40'
                    : 'bg-transparent'
                }`}
              >
                <Icon size={18} />
              </span>
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

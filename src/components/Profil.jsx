import { useMemo, useState } from 'react'
import { Briefcase, Building2, Mail, Phone, MapPinned, BadgeCheck, Award, Plane, LogOut, HelpCircle, ChevronRight } from 'lucide-react'
import { USER_DEFAULT } from '../hooks/useAbsensi'
import Bantuan from './Bantuan'

export default function Profil({ user = USER_DEFAULT, history, onLogout }) {
  const [bantuanOpen, setBantuanOpen] = useState(false)
  const stats = useMemo(() => {
    const s = { Hadir: 0, Terlambat: 0, Izin: 0, Alpha: 0 }
    history.forEach((h) => { if (s[h.status] !== undefined) s[h.status]++ })
    return s
  }, [history])

  const inisial = user.nama
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const items = [
    { Icon: Mail, label: 'Email', value: user.email },
    { Icon: Phone, label: 'Telepon', value: user.telepon },
    { Icon: MapPinned, label: 'Lokasi Kerja', value: user.lokasiKerja },
  ]

  return (
    <div className="animate-fade-in">
      {/* Kartu identitas */}
      <div className="card mb-4 overflow-hidden !p-0">
        <div className="h-24 bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600" />
        <div className="-mt-12 px-5 pb-5">
          <div className="grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-extrabold text-white shadow-lg shadow-indigo-500/40 ring-4 ring-white dark:ring-slate-900">
            {inisial}
          </div>
          <h1 className="mt-3 text-lg font-extrabold tracking-tight">{user.nama}</h1>
          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <BadgeCheck size={14} className="text-emerald-500" /> NIP {user.nip} • Karyawan Aktif
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              <Briefcase size={13} /> {user.jabatan}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
              <Building2 size={13} /> Dept. {user.departemen}
            </span>
          </div>
        </div>
      </div>

      {/* Statistik kehadiran */}
      <div className="card mb-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Award size={16} className="text-amber-500" /> Rekap Kehadiran
        </h2>
        <div className="grid grid-cols-4 gap-2 text-center">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-xl font-extrabold">{v}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{k}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sisa cuti tahunan */}
      <div className="card mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
            <Plane size={16} className="text-sky-500" /> Sisa Cuti Tahunan
          </h2>
          <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
            {user.sisaCuti ?? 12} hari
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all"
            style={{ width: `${Math.min(100, ((user.sisaCuti ?? 12) / (user.cutiTahunan ?? 12)) * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Kuota {user.cutiTahunan ?? 12} hari/tahun • terpakai {(user.cutiTahunan ?? 12) - (user.sisaCuti ?? 12)} hari
        </p>
      </div>

      {/* Detail kontak */}
      <div className="card space-y-3">
        {items.map(({ Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              <Icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="truncate text-sm font-semibold">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pusat bantuan */}
      <button
        onClick={() => setBantuanOpen(true)}
        className="mt-4 flex w-full items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-left transition active:scale-[0.98] dark:border-indigo-500/30 dark:bg-indigo-500/10"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
            <HelpCircle size={18} />
          </span>
          <div>
            <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Pusat Bantuan</p>
            <p className="text-[11px] text-indigo-500/80 dark:text-indigo-400/80">Cara absen, izin, lembur, dan FAQ lainnya</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-indigo-400" />
      </button>
      <Bantuan open={bantuanOpen} onClose={() => setBantuanOpen(false)} />

      <button
        onClick={onLogout}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 py-3.5 text-sm font-bold text-rose-600 transition active:scale-[0.98] dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
      >
        <LogOut size={17} /> Keluar dari NUBSEN
      </button>

      <p className="mt-5 text-center text-[11px] text-slate-400">
        NUBSEN v2.0 • Login sesi aman • data tersimpan di server SQLite
      </p>
    </div>
  )
}


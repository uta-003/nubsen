import { BarChart3, Flame } from 'lucide-react'
import { hitungStreak, tujuhHariTerakhir } from '../utils/statistik'

const WARNA_BAR = {
  Hadir: 'bg-gradient-to-t from-emerald-600 to-emerald-400',
  Terlambat: 'bg-gradient-to-t from-amber-600 to-amber-400',
  Izin: 'bg-gradient-to-t from-sky-600 to-sky-400',
  Alpha: 'bg-gradient-to-t from-rose-600 to-rose-400',
}

// Kartu statistik mingguan: streak 🔥 + grafik batang 7 hari terakhir.
export default function KartuStatistik({ history = [] }) {
  const streak = hitungStreak(history)
  const minggu = tujuhHariTerakhir(history)
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
          <BarChart3 size={16} className="text-indigo-500" /> Statistik Mingguan
        </h2>
        <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
          <Flame size={13} /> {streak} hari beruntun
        </span>
      </div>
      <div className="flex h-24 items-end justify-between gap-1.5">
        {minggu.map(({ tanggal, label, record }) => (
          <div key={tanggal} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div className="flex h-full w-full items-end justify-center">
              {record && record.status ? (
                <div
                  title={`${tanggal} — ${record.status}${record.checkIn && record.checkIn !== '-' ? ` (${record.checkIn})` : ''}`}
                  className={`w-4 rounded-t-lg ${WARNA_BAR[record.status] || 'bg-slate-400'}`}
                  style={{ height: record.status === 'Izin' || record.status === 'Alpha' ? '55%' : '100%' }}
                />
              ) : (
                <div className="h-1.5 w-4 rounded bg-slate-200 dark:bg-slate-700" />
              )}
            </div>
            <span className="text-[10px] font-semibold text-slate-400">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium text-slate-400">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Hadir</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-500" /> Terlambat</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-sky-500" /> Izin</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-500" /> Alpha</span>
      </div>
    </div>
  )
}

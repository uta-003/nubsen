const STYLES = {
  Hadir: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  Terlambat: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  Izin: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  // Izin datang terlambat/siang: tetap MASUK kerja → gaji harian & uang makan dibayar.
  'Izin Terlambat': 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  Alpha: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  // Jam absen tidak wajar → menunggu koreksi admin, bukan dihitung Hadir.
  'Perlu Tinjauan': 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
}

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        STYLES[status] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      {status || 'Belum Absen'}
    </span>
  )
}

import { useState } from 'react'
import { ChevronLeft, ChevronRight, PartyPopper } from 'lucide-react'
import { bulanIndo, toISODate } from '../utils/date'
import { namaLibur, liburBulan } from '../utils/liburIndonesia'

const WARNA_TITIK = {
  Hadir: 'bg-emerald-500',
  Terlambat: 'bg-amber-500',
  Izin: 'bg-sky-500',
  Alpha: 'bg-rose-500',
}

// Kalender kehadiran bulanan + kalender Indonesia (libur nasional & tanggal merah).
export default function KalenderBulan({ history = [], onSelect }) {
  const [geser, setGeser] = useState(0) // 0 = bulan ini, -1 = bulan lalu, dst.
  const basis = new Date()
  basis.setDate(1)
  basis.setMonth(basis.getMonth() + geser)
  const tahun = basis.getFullYear()
  const bulan = basis.getMonth()
  const mulaiHari = new Date(tahun, bulan, 1).getDay() // 0 = Minggu
  const jumlahHari = new Date(tahun, bulan + 1, 0).getDate()
  const perTanggal = new Map(history.map((h) => [h.tanggal, h]))
  const hariIniIso = toISODate(new Date())
  const sel = [...Array(mulaiHari).fill(null), ...Array.from({ length: jumlahHari }, (_, i) => i + 1)]
  const iso = (d) => `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const libur = liburBulan(tahun, bulan)

  return (
    <div className="card animate-fade-in">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setGeser((g) => g - 1)}
          className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500 transition active:scale-90 dark:bg-slate-800 dark:text-slate-300"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft size={17} />
        </button>
        <h2
          onClick={() => geser !== 0 && setGeser(0)}
          title={geser !== 0 ? 'Kembali ke bulan ini' : undefined}
          className={`text-sm font-bold ${geser !== 0 ? 'cursor-pointer underline decoration-dotted underline-offset-4' : ''}`}
        >
          {bulanIndo[bulan]} {tahun}
        </h2>
        <button
          onClick={() => setGeser((g) => g + 1)}
          disabled={geser >= 12}
          className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500 transition active:scale-90 disabled:opacity-30 dark:bg-slate-800 dark:text-slate-300"
          aria-label="Bulan berikutnya"
        >
          <ChevronRight size={17} />
        </button>
      </div>

      {/* Banner libur bulan ini (kalender Indonesia) */}
      {libur.length > 0 && (
        <div className="mb-3 space-y-1 rounded-2xl bg-rose-50 p-3 dark:bg-rose-500/10">
          {libur.slice(0, 4).map((l) => (
            <p key={l.tanggal} className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-300">
              <PartyPopper size={12} className="shrink-0" />
              {Number(l.tanggal.slice(8))} {bulanIndo[bulan].slice(0, 3)} — {l.nama}
            </p>
          ))}
          {libur.length > 4 && (
            <p className="pl-5 text-[10px] text-rose-400">+{libur.length - 4} libur lainnya bulan ini</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400">
        {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((h, i) => (
          <span key={i} className={`py-1 ${i === 0 ? 'text-rose-400' : ''}`}>
            {h}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {sel.map((d, i) => {
          if (d === null) return <span key={'kosong' + i} />
          const tgl = iso(d)
          const rec = perTanggal.get(tgl)
          const hariIni = tgl === hariIniIso
          const namaL = namaLibur(tgl)
          const akhirPekan = i % 7 === 0 // kolom Minggu
          const merah = !!namaL || akhirPekan
          const label = namaL || (rec ? `${tgl} — ${rec.status}` : tgl)
          return (
            <button
              key={tgl}
              onClick={() => rec && onSelect?.(rec)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-semibold ${
                rec
                  ? 'cursor-pointer bg-slate-100 transition hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-slate-700'
                  : ''
              } ${hariIni ? 'ring-2 ring-indigo-500' : ''} ${merah ? 'text-rose-500 dark:text-rose-400' : ''}`}
              title={label}
            >
              {d}
              <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${rec && WARNA_TITIK[rec.status] ? WARNA_TITIK[rec.status] : 'bg-transparent'}`} />
              {namaL && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-rose-400" />}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-medium text-slate-400">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Hadir</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-500" /> Terlambat</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-sky-500" /> Izin</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-500" /> Alpha</span>
        <span className="flex items-center gap-1 text-rose-400"><i className="h-2 w-2 rounded-full bg-rose-400" /> Libur Nasional</span>
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-400">
        Merah = Minggu/libur nasional &amp; cuti bersama (kalender Indonesia). Ketuk tanggal bertitik untuk detail kehadiran.
      </p>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Timer, Coffee } from 'lucide-react'

// Widget Timer Kerja: stopwatch live sejak check-in hari ini — besar & menonjol,
// dengan progres menuju jam pulang. Tampil hanya bila sudah check-in & belum check-out.
export default function TimerKerja({ today, jamPulang = '17:00' }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const info = useMemo(() => {
    if (!today?.checkIn || today?.checkOut) return null
    const [h, m] = today.checkIn.split(':').map(Number)
    const mulai = h * 3600 + m * 60
    const kini = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
    const kerja = Math.max(0, kini - mulai)
    const [pj, pm] = jamPulang.split(':').map(Number)
    const pulang = pj * 3600 + pm * 60
    const sisa = Math.max(0, pulang - kini)
    const total = Math.max(1, pulang - mulai)
    return { kerja, sisa, persen: Math.min(100, Math.round((kerja / total) * 100)) }
  }, [now, today, jamPulang])

  if (!info) return null

  const p2 = (n) => String(n).padStart(2, '0')
  const jam = Math.floor(info.kerja / 3600)
  const menit = Math.floor((info.kerja % 3600) / 60)
  const detik = info.kerja % 60

  return (
    <div className="card animate-rise relative overflow-hidden !p-0">
      <div className="relative bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 p-4 text-white">
        <span aria-hidden className="pointer-events-none absolute -right-6 -top-10 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/20 backdrop-blur">
              <Timer size={20} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/75">Sedang Bekerja</p>
              <p className="font-mono text-2xl font-extrabold leading-tight tabular-nums">
                {p2(jam)}:{p2(menit)}<span className="text-base text-white/70">:{p2(detik)}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-1 text-[11px] font-bold text-white/90">
              <Coffee size={12} /> pulang {jamPulang}
            </p>
            <p className="font-mono text-sm font-bold text-white/75 tabular-nums">
              sisa {p2(Math.floor(info.sisa / 3600))}:{p2(Math.floor((info.sisa % 3600) / 60))}
            </p>
          </div>
        </div>
        {/* Bar progres menuju jam pulang */}
        <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white/95 transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.max(2, info.persen)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

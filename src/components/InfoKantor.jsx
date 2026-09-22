import { useState } from 'react'
import { Building2, MapPin, Navigation, Route, ExternalLink, Copy, Check } from 'lucide-react'
import { KANTOR, statusGeofence } from '../utils/geo'

// Kartu Info Kantor: identitas kantor + peta OpenStreetMap (iframe embed,
// tanpa API key) + jarak live pengguna ke kantor + tombol arah & salin alamat.
export default function InfoKantor({ lokasi = null }) {
  const [tersalin, setTersalin] = useState(false)

  const g = lokasi ? statusGeofence(lokasi.lat, lokasi.lon) : null
  const jarak = g ? g.jarak : null

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(`${KANTOR.nama} — ${KANTOR.alamat} (https://maps.google.com/?q=${KANTOR.lat},${KANTOR.lon})`)
      setTersalin(true)
      setTimeout(() => setTersalin(false), 2000)
    } catch { /* clipboard ditolak */ }
  }

  return (
    <div className="card animate-rise overflow-hidden !p-0">
      {/* Kepala kartu — gradasi hangat */}
      <div className="relative overflow-hidden bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-600 px-5 py-4 text-white">
        <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur">
            <Building2 size={20} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold">{KANTOR.nama}</p>
            <p className="truncate text-[11px] text-white/85">{KANTOR.alamat}</p>
          </div>
        </div>
      </div>

      {/* Peta OpenStreetMap (embed, tanpa API key) — tinggi responsif */}
      <div className="relative h-52 w-full border-y border-slate-100 dark:border-slate-800">
        <iframe
          title={`Peta ${KANTOR.nama}`}
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${KANTOR.lon + 0.004},${KANTOR.lat - 0.002},${KANTOR.lon - 0.004},${KANTOR.lat + 0.002}&layer=mapnik&marker=${KANTOR.lat},${KANTOR.lon}`}
          className="h-full w-full"
          loading="lazy"
        />
        {/* Radius geofence 20 m terlalu kecil terlihat dari peta kota — badge info */}
        <span className="absolute left-3 top-3 rounded-full border border-white/30 bg-slate-900/80 px-3 py-1 text-[10px] font-bold text-white backdrop-blur">
          📍 Radius absen ±{KANTOR.radiusM} m
        </span>
      </div>

      {/* Aksi: jarak live + arah + salin */}
      <div className="flex items-center gap-2 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          {jarak != null ? (
            <>
              <p className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Route size={13} className="text-indigo-500" />
                {jarak <= KANTOR.radiusM
                  ? `Anda di area kantor • ±${jarak} m`
                  : `±${jarak} m dari kantor`}
              </p>
              <p className={`text-[10px] font-semibold ${g.diLuarArea ? 'text-amber-500' : 'text-emerald-500'}`}>
                {g.diLuarArea ? '⚠️ Di luar radius absen — absen tetap tercatat, ditandai' : '✓ Boleh absen di sini'}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-400">Izinkan lokasi untuk melihat jarak ke kantor</p>
          )}
        </div>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${KANTOR.lat},${KANTOR.lon}`}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/30 transition active:scale-95"
        >
          <Navigation size={13} /> Arah
        </a>
        <button
          onClick={salin}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/80 text-slate-500 transition active:scale-90 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300"
          aria-label="Salin alamat kantor"
        >
          {tersalin ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  )
}

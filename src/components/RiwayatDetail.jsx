import { X, MapPin, Paperclip, Info, ExternalLink, Camera, ShieldAlert, ShieldCheck } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { formatTanggalLengkap, durasiKerja } from '../utils/date'
import { assetUrl } from '../api'

// Modal detail satu catatan riwayat: selfie, lokasi + Google Maps, geofence, lampiran.
export default function RiwayatDetail({ rec, onClose }) {
  if (!rec) return null
  const penuh = rec.checkIn && rec.checkOut && rec.checkIn !== '-' && rec.checkOut !== '-'
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-[2rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="font-extrabold">{formatTanggalLengkap(new Date(rec.tanggal))}</h3>
            <p className="text-xs text-slate-400">Detail kehadiran</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={rec.status} />
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Tutup"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Jam Masuk</p>
            <p className="font-mono text-xl font-bold">{rec.checkIn || '—'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Jam Pulang</p>
            <p className="font-mono text-xl font-bold">{rec.checkOut || '—'}</p>
          </div>
        </div>
        {penuh && (
          <p className="mt-2 text-right text-xs font-semibold text-indigo-500">
            Total kerja: {durasiKerja(rec.checkIn, rec.checkOut)}
          </p>
        )}

        {rec.keterangan && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <Info size={14} className="mt-0.5 shrink-0" /> {rec.keterangan}
          </p>
        )}
        {rec.lampiran && (
          <a
            href={assetUrl(rec.lampiran)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:underline"
          >
            <Paperclip size={13} /> Lihat lampiran
          </a>
        )}

        {rec.lokasi && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
              <MapPin size={14} className="text-indigo-500" /> Lokasi Absen
            </p>
            <p className="mt-1 font-mono text-xs">
              {rec.lokasi.lat}, {rec.lokasi.lon}
            </p>
            {rec.lokasi.alamat && <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{rec.lokasi.alamat}</p>}
            {rec.diLuarArea != null && (
              <span
                className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  rec.diLuarArea
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                }`}
              >
                {rec.diLuarArea ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                {rec.diLuarArea ? `Di luar area kantor (±${rec.jarak} m)` : `Di area kantor (±${rec.jarak} m)`}
              </span>
            )}
            <a
              href={`https://www.google.com/maps?q=${rec.lokasi.lat},${rec.lokasi.lon}`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-3 w-full !py-2.5 text-xs"
            >
              <ExternalLink size={14} /> Buka di Google Maps
            </a>
          </div>
        )}

        {rec.selfie && (
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
              <Camera size={14} className="text-indigo-500" /> Foto Selfie
            </p>
            <img src={assetUrl(rec.selfie)} alt="Selfie absensi" className="w-full rounded-2xl object-cover" />
          </div>
        )}
      </div>
    </div>
  )
}



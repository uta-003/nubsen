import { X, MapPin, Paperclip, Info, ExternalLink, Camera, ShieldAlert, ShieldCheck, LogIn, LogOut } from 'lucide-react'
import { usePenutupKembali } from '../hooks/useTombolKembali'
import StatusBadge from './StatusBadge'
import { formatTanggalLengkap, durasiKerja } from '../utils/date'
import { assetUrl } from '../api'

// Satu blok absen (masuk ATAU pulang): jam, foto selfie, lokasi + geofence + Maps.
function BlokAbsen({ masuk, jam, lokasi, selfie, diLuarArea, jarak }) {
  const Label = masuk ? LogIn : LogOut
  return (
    <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
      <div className="flex items-center justify-between">
        <p className={`flex items-center gap-1.5 text-xs font-bold ${masuk ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
          <Label size={14} /> {masuk ? 'Absen Masuk' : 'Absen Pulang'}
        </p>
        <p className="font-mono text-base font-bold">{jam || '—'}</p>
      </div>

      {lokasi && (
        <>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <MapPin size={12} className="text-indigo-500" /> Lokasi
          </p>
          <p className="mt-0.5 font-mono text-xs">
            {lokasi.lat}, {lokasi.lon}
          </p>
          {lokasi.alamat && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{lokasi.alamat}</p>}
          {diLuarArea != null && (
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                diLuarArea
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
              }`}
            >
              {diLuarArea ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
              {diLuarArea ? `Di luar area kantor (±${jarak} m)` : `Di area kantor (±${jarak} m)`}
            </span>
          )}
          <a
            href={`https://www.google.com/maps?q=${lokasi.lat},${lokasi.lon}`}
            target="_blank"
            rel="noreferrer"
            className="btn-primary mt-3 w-full !py-2.5 text-xs"
          >
            <ExternalLink size={14} /> Buka di Google Maps
          </a>
        </>
      )}

      {selfie && (
        <div className="mt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
            <Camera size={13} className="text-indigo-500" /> Foto Selfie {masuk ? 'Masuk' : 'Pulang'}
          </p>
          <img src={assetUrl(selfie)} alt={`Selfie absen ${masuk ? 'masuk' : 'pulang'}`} className="w-full rounded-2xl object-cover" />
        </div>
      )}
    </div>
  )
}

// Modal detail: jam masuk & pulang masing-masing dengan detail lengkap —
// foto selfie, koordinat + alamat, status geofence, dan tautan Google Maps.
// Data masuk & pulang tersimpan TERPISAH di server (kolom khusus masing-masing).
export default function RiwayatDetail({ rec, onClose }) {
  // Tombol Back Android menutup modal ini lebih dulu (lihat utils/kembali.js).
  usePenutupKembali(!!rec, onClose)
  if (!rec) return null
  const penuh = rec.checkIn && rec.checkOut && rec.checkIn !== '-' && rec.checkOut !== '-'
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-2xl dark:bg-slate-900 sm:rounded-[2rem] sm:pb-5"
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

        {/* Data absen masuk: lokasi + geofence + foto (kolom khusus masuk di server) */}
        {rec.checkIn && rec.checkIn !== '-' && (
          <BlokAbsen masuk jam={rec.checkIn} lokasi={rec.lokasi} selfie={rec.selfie} diLuarArea={rec.diLuarArea} jarak={rec.jarak} />
        )}
        {/* Data absen pulang: kolom terpisah — foto & lokasi pulang tidak menimpa masuk */}
        {rec.checkOut && rec.checkOut !== '-' && (
          <BlokAbsen jam={rec.checkOut} lokasi={rec.lokasiPulang} selfie={rec.selfiePulang} diLuarArea={rec.diLuarAreaPulang} jarak={rec.jarakPulang} />
        )}
      </div>
    </div>
  )
}



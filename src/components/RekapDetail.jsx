import { X, CalendarDays, ChevronRight, Clock4, Inbox } from 'lucide-react'
import { usePenutupKembali } from '../hooks/useTombolKembali'
import StatusBadge from './StatusBadge'
import { formatTanggalLengkap } from '../utils/date'
import { detailLibur } from '../utils/liburIndonesia'

// Lembar DETAIL satu kategori rekap kehadiran (Hadir / Terlambat / Datang
// Terlambat / Izin / Alpha) sesuai PERIODE yang sedang dipilih di profil.
// Tiap baris bisa diketuk untuk membuka detail absensi penuh (RiwayatDetail).
export default function RekapDetail({ kategori, records = [], onClose, onBuka }) {
  usePenutupKembali(!!kategori, onClose)
  if (!kategori) return null

  const urut = [...records].sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)))

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-2xl dark:bg-slate-900 sm:rounded-[2rem] sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold">Rekap {kategori}</h3>
            <p className="text-xs text-slate-400">{urut.length} catatan pada periode ini</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        {urut.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-3xl bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600">
              <Inbox size={26} />
            </span>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Belum ada catatan</p>
            <p className="text-xs text-slate-400">Tidak ada data {kategori} pada periode yang dipilih.</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {urut.map((h) => {
              const libur = detailLibur(h.tanggal)
              const bisaBuka = typeof onBuka === 'function' && h.sumber !== 'izin'
              const Tag = bisaBuka ? 'button' : 'div'
              return (
                <li key={`${h.tanggal}-${h.status}-${h.keterangan || ''}`}>
                  <Tag
                    {...(bisaBuka ? { type: 'button', onClick: () => onBuka(h) } : {})}
                    className={`flex w-full animate-rise items-center gap-3 rounded-2xl bg-slate-50 p-3.5 text-left transition dark:bg-slate-800/70 ${bisaBuka ? 'active:scale-[0.99] hover:bg-slate-100 dark:hover:bg-slate-800' : ''}`}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-indigo-500 shadow-sm dark:bg-slate-900 dark:text-indigo-300">
                      <CalendarDays size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{formatTanggalLengkap(new Date(h.tanggal))}</span>
                      {libur && (
                        <span className="mt-0.5 block truncate text-[11px] font-semibold text-rose-500 dark:text-rose-400">
                          {libur.nama}
                        </span>
                      )}
                      <span className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        <Clock4 size={11} /> {h.checkIn || '—'} – {h.checkOut || '—'}
                      </span>
                      {h.keterangan && (
                        <span className="mt-0.5 block truncate text-[11px] text-slate-400">{h.keterangan}</span>
                      )}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={h.status} />
                      {bisaBuka && <ChevronRight size={15} className="text-indigo-400" />}
                    </span>
                  </Tag>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

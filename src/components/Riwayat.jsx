import { useMemo, useState } from 'react'
import { History as HistoryIcon, Filter, MapPin, Paperclip, Info, Download, ChevronRight } from 'lucide-react'
import { formatTanggalLengkap } from '../utils/date'
import { assetUrl } from '../api'
import StatusBadge from './StatusBadge'
import RiwayatDetail from './RiwayatDetail'
import KalenderBulan from './KalenderBulan'

const STATUS_LIST = ['Semua', 'Hadir', 'Terlambat', 'Izin', 'Alpha']

export default function Riwayat({ history }) {
  const [status, setStatus] = useState('Semua')
  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('daftar') // 'daftar' | 'kalender'

  const data = useMemo(
    () =>
      history
        .filter((h) => (status === 'Semua' ? true : h.status === status))
        .filter((h) => (dari ? h.tanggal >= dari : true))
        .filter((h) => (sampai ? h.tanggal <= sampai : true))
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    [history, status, dari, sampai],
  )

  // Unduh data sesuai filter aktif sebagai CSV (pemisah ';' ramah Excel id-ID).
  const exportCSV = () => {
    const baris = [
      ['Tanggal', 'Masuk', 'Pulang', 'Status', 'Keterangan', 'Lampiran'],
      ...data.map((h) => [
        h.tanggal,
        h.checkIn || '-',
        h.checkOut || '-',
        h.status,
        (h.keterangan || '').replace(/[\r\n;]+/g, ' '),
        h.lampiran || '',
      ]),
    ]
    const csv = '\ufeff' + baris.map((r) => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'riwayat-absensi.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Riwayat Absensi</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{data.length} catatan ditemukan</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 rounded-2xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-110 active:scale-95"
        >
          <Download size={14} /> CSV
        </button>
      </div>

      {/* Rekap cepat sesuai filter aktif */}
      <div className="mb-4 grid grid-cols-4 gap-2 text-center">
        {['Hadir', 'Terlambat', 'Izin', 'Alpha'].map((s) => (
          <div key={s} className="rounded-2xl bg-white p-2.5 shadow-soft dark:bg-slate-900">
            <p className="text-lg font-extrabold">{data.filter((h) => h.status === s).length}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s}</p>
          </div>
        ))}
      </div>

      {/* Tab: Daftar / Kalender */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/70 p-1 dark:bg-slate-800">
        {[
          ['daftar', '📋 Daftar'],
          ['kalender', '🗓️ Kalender'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-xl py-2 text-xs font-bold transition ${
              tab === id
                ? 'bg-white text-indigo-600 shadow dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'daftar' ? (
        <>
      {/* Filter */}
      <div className="card mb-4 space-y-3">
        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Filter size={15} className="text-indigo-500" /> Filter
        </div>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {STATUS_LIST.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                status === s
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Dari</label>
            <input type="date" className="input" value={dari} onChange={(e) => setDari(e.target.value)} />
          </div>
          <div>
            <label className="label">Sampai</label>
            <input type="date" className="input" value={sampai} onChange={(e) => setSampai(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Daftar riwayat */}
      {data.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-10 text-center">
          <HistoryIcon size={36} className="text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Tidak ada catatan</p>
          <p className="text-xs text-slate-400">Coba ubah filter status atau rentang tanggal.</p>
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          {data.map((h) => (
            <div
              key={h.tanggal + h.keterangan}
              onClick={() => setDetail(h)}
              className="card cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-1 hover:ring-indigo-200 dark:hover:ring-indigo-500/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{formatTanggalLengkap(new Date(h.tanggal))}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                    Masuk {h.checkIn} • Pulang {h.checkOut}
                  </p>
                  {h.keterangan && (
                    <p className="mt-1.5 flex items-start gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <Info size={12} className="mt-0.5 shrink-0" /> {h.keterangan}
                    </p>
                  )}
                  {h.lokasi && (
                    <p className="mt-1.5 flex items-start gap-1 text-[11px] text-slate-400">
                      <MapPin size={12} className="mt-0.5 shrink-0" />
                      {h.lokasi.lat}, {h.lokasi.lon}
                      {h.lokasi.alamat ? ` — ${h.lokasi.alamat}` : ''}
                    </p>
                  )}
                  {h.lampiran && (
                    <a
                      href={assetUrl(h.lampiran)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 flex items-center gap-1 text-[11px] text-indigo-500 hover:underline"
                    >
                      <Paperclip size={11} /> Lihat lampiran
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusBadge status={h.status} />
                  <span className="flex items-center text-[10px] font-semibold text-indigo-400">
                    Detail <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

        </>
      ) : (
        <KalenderBulan history={history} onSelect={setDetail} />
      )}

      <RiwayatDetail rec={detail} onClose={() => setDetail(null)} />
    </div>
  )
}


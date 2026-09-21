import { useState } from 'react'
import { BarChart3, Users } from 'lucide-react'
import { formatTanggalLengkap } from '../utils/date'

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
// Urutan tumpukan dari bawah ke atas + warnanya (satu bahasa warna di seluruh app).
const SEGMEN = [
  ['masuk', 'bg-emerald-500'],
  ['izin', 'bg-sky-500'],
  ['alpha', 'bg-rose-500'],
]

// Grafik tren kehadiran 7 hari (panel admin). Skala mengikuti JUMLAH KARYAWAN,
// jadi tinggi batang bermakna: 100% = seluruh karyawan. Batang bertumpuk
// (masuk / izin / alpha), ada kisi skala, label nilai, hari libur ditandai, dan
// detail harian muncul saat batangnya diketuk.
export default function GrafikTren({ tren }) {
  const [pilih, setPilih] = useState(null)

  if (!tren) {
    return (
      <div className="card mt-3">
        <p className="py-12 text-center text-xs text-slate-400">Memuat grafik…</p>
      </div>
    )
  }

  const baris = tren.baris || []
  const total = Math.max(1, tren.totalKaryawan || 1)
  const hariKerja = baris.filter((b) => b.hariKerja).length
  const totalMasuk = baris.reduce((t, b) => t + b.masuk, 0)
  const totalAlpha = baris.reduce((t, b) => t + b.alpha, 0)
  const persen = hariKerja ? Math.round((totalMasuk / (hariKerja * total)) * 100) : 0
  const kosong = baris.every((b) => !b.masuk && !b.izin && !b.alpha)
  const detail = baris.find((b) => b.tanggal === pilih) || null
  const pct = (n) => `${Math.min(100, (n / total) * 100)}%`

  return (
    <div className="card mt-3">
      {/* Kepala + ringkasan angka */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
          <BarChart3 size={16} className="shrink-0 text-indigo-500" />
          <span className="truncate">Tren Kehadiran 7 Hari</span>
        </h2>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Users size={12} /> {tren.totalKaryawan ?? '—'} karyawan
        </span>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-indigo-50 py-2.5 dark:bg-indigo-500/10">
          <p className="text-lg font-extrabold leading-none text-indigo-600 dark:text-indigo-300">{persen}%</p>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Kehadiran</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 py-2.5 dark:bg-emerald-500/10">
          <p className="text-lg font-extrabold leading-none text-emerald-600 dark:text-emerald-400">{totalMasuk}</p>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Masuk</p>
        </div>
        <div className="rounded-2xl bg-rose-50 py-2.5 dark:bg-rose-500/10">
          <p className="text-lg font-extrabold leading-none text-rose-600 dark:text-rose-400">{totalAlpha}</p>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Alpha</p>
        </div>
      </div>

      {kosong ? (
        <p className="rounded-2xl bg-slate-50 py-8 text-center text-xs font-semibold text-slate-400 dark:bg-slate-800/60">
          Belum ada aktivitas absensi pada 7 hari terakhir.
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            {/* Sumbu Y — jumlah karyawan */}
            <div className="relative h-32 w-7 shrink-0 text-right text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="absolute right-0 top-0 -translate-y-1/2">{tren.totalKaryawan}</span>
              <span className="absolute right-0 top-1/2 -translate-y-1/2">{Math.round(tren.totalKaryawan / 2)}</span>
              <span className="absolute bottom-0 right-0 translate-y-1/2">0</span>
            </div>

            <div className="relative h-32 min-w-0 flex-1">
              {/* Kisi skala 0% / 50% / 100% */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-x-0 bottom-0 h-px bg-slate-200 dark:bg-slate-700" />
                <div className="absolute inset-x-0 top-1/2 h-px bg-slate-100 dark:bg-slate-800" />
                <div className="absolute inset-x-0 top-0 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

              <div className="relative flex h-full items-end gap-1 sm:gap-1.5">
                {baris.map((b, i) => {
                  const d = new Date(`${b.tanggal}T00:00:00`)
                  const terpilih = pilih === b.tanggal
                  return (
                    <button
                      key={b.tanggal}
                      type="button"
                      onClick={() => setPilih(terpilih ? null : b.tanggal)}
                      aria-pressed={terpilih}
                      title={`${formatTanggalLengkap(d)} — masuk ${b.masuk}, izin ${b.izin}, alpha ${b.alpha}`}
                      className={`flex min-w-0 flex-1 flex-col items-center rounded-xl pb-0.5 pt-0.5 transition ${
                        terpilih ? 'bg-indigo-100/70 dark:bg-indigo-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {/* Label nilai (jumlah masuk) di atas batang */}
                      <span className={`mb-1 text-[11px] font-extrabold leading-none tabular-nums ${b.masuk ? 'text-emerald-600 dark:text-emerald-400' : 'text-transparent'}`}>
                        {b.masuk || '-'}
                      </span>
                      <span
                        className={`bar-anim flex h-full w-full flex-col justify-end overflow-hidden rounded-md ${
                          b.hariKerja ? 'bg-slate-100 dark:bg-slate-800' : 'border border-dashed border-slate-200 dark:border-slate-700'
                        }`}
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        {SEGMEN.map(([kunci, warna]) =>
                          b[kunci] > 0 ? (
                            <span key={kunci} style={{ height: pct(b[kunci]), minHeight: '6px' }} className={`w-full ${warna}`} />
                          ) : null,
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Label hari & tanggal di bawah grafik (sejajar kolom) */}
          <div className="mt-1.5 flex gap-2">
            <span className="w-7 shrink-0" />
            <div className="flex min-w-0 flex-1 gap-1 sm:gap-1.5">
              {baris.map((b) => {
                const d = new Date(`${b.tanggal}T00:00:00`)
                return (
                  <div key={b.tanggal} className="min-w-0 flex-1 text-center">
                    <p className={`truncate text-[11px] font-bold ${b.hariKerja ? 'text-slate-500 dark:text-slate-300' : 'text-rose-500 dark:text-rose-400'}`}>
                      {HARI[d.getDay()]}
                    </p>
                    <p className="text-[10px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">{String(d.getDate()).padStart(2, '0')}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Detail hari terpilih (ketuk batangnya) */}
      {detail && (
        <div className="mt-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-bold">{formatTanggalLengkap(new Date(`${detail.tanggal}T00:00:00`))}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              detail.hariKerja ? 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
            }`}>
              {detail.hariKerja ? 'Hari kerja' : 'Libur'}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2 text-center">
            {[
              ['Masuk', detail.masuk, 'text-emerald-600 dark:text-emerald-400'],
              ['Izin', detail.izin, 'text-sky-600 dark:text-sky-400'],
              ['Alpha', detail.alpha, 'text-rose-600 dark:text-rose-400'],
              ['Belum', Math.max(0, (tren.totalKaryawan || 0) - detail.masuk - detail.izin - detail.alpha), 'text-slate-600 dark:text-slate-300'],
            ].map(([label, angka, warna]) => (
              <div key={label} className="rounded-xl bg-white py-2 dark:bg-slate-900">
                <p className={`text-base font-extrabold leading-none tabular-nums ${warna}`}>{angka}</p>
                <p className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legenda & catatan */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Masuk</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-sky-500" /> Izin</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-500" /> Alpha</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm border border-dashed border-slate-300 dark:border-slate-600" /> Libur</span>
      </div>
      <p className="mt-2.5 text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        Tinggi batang = jumlah karyawan dari total <b>{tren.totalKaryawan ?? '—'}</b>. Ketuk batang untuk detail harian.
      </p>
    </div>
  )
}
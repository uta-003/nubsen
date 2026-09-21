import { useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight, Flame, PartyPopper, Clock3, Target } from 'lucide-react'
import { dataPekan, hitungStreak, HARI_KERJA_DEFAULT } from '../utils/statistik'
import { bulanIndo } from '../utils/date'
import { JADWAL_DEFAULT } from '../hooks/useAbsensi'

const WARNA_BAR = {
  Hadir: 'bg-gradient-to-t from-emerald-600 to-emerald-400',
  Terlambat: 'bg-gradient-to-t from-amber-600 to-amber-400',
  Izin: 'bg-gradient-to-t from-sky-500 to-sky-400',
  Alpha: 'bg-gradient-to-t from-rose-500 to-rose-400',
}
const WARNA_ANGKA = {
  Hadir: 'text-emerald-600 dark:text-emerald-400',
  Terlambat: 'text-amber-600 dark:text-amber-400',
  Izin: 'text-sky-600 dark:text-sky-400',
  Alpha: 'text-rose-600 dark:text-rose-400',
}
const WARNA_TITIK = {
  Hadir: 'bg-emerald-500',
  Terlambat: 'bg-amber-500',
  Izin: 'bg-sky-500',
  Alpha: 'bg-rose-500',
}
const STATUS_REKAP = ['Hadir', 'Terlambat', 'Izin', 'Alpha']
const GESER_MIN = -26 // batas mundur ± 6 bulan riwayat absensi
const GESER_MAKS = 0 // pekan depan belum ada catatan → tidak bisa dilampaui
const JAM_SKALA = 10 // skala grafik jam kerja (10 jam = batas atas)
const JAM_TARGET = 8 // garis target durasi kerja harian

// Durasi kerja (jam desimal) dari jam masuk → pulang; null bila belum lengkap.
function jamKerja(rec) {
  const keMenit = (t) => {
    const cocok = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''))
    return cocok ? Number(cocok[1]) * 60 + Number(cocok[2]) : null
  }
  const a = keMenit(rec?.checkIn)
  const b = keMenit(rec?.checkOut)
  if (a == null || b == null || b <= a) return null
  return (b - a) / 60
}

const jamTeks = (jam) => {
  if (!jam) return '—'
  const total = Math.round(jam * 60)
  return `${Math.floor(total / 60)}j ${String(total % 60).padStart(2, '0')}m`
}

// Kartu statistik mingguan (Senin → Minggu): streak, rekap status, komposisi
// pekan, grafik JAM KERJA per hari (dengan garis target 8 jam), daftar tanggal
// merah, dan detail per hari saat batangnya diketuk.
export default function KartuStatistik({ history = [], jadwal = JADWAL_DEFAULT }) {
  const [geser, setGeser] = useState(0)
  const [pilih, setPilih] = useState(null)
  const hariKerja = jadwal?.hariKerja?.length ? jadwal.hariKerja : HARI_KERJA_DEFAULT
  const pekan = dataPekan(history, { geser, hariKerja })
  const streak = hitungStreak(history)
  const r = pekan.rekap
  const detail = pekan.hari.find((d) => d.tanggal === pilih) || null

  // Total & rata-rata jam kerja pekan terpilih (hanya hari kerja).
  const jamHarian = pekan.hari.map((d) => (d.hariKerja ? jamKerja(d.record) : null))
  const totalJam = jamHarian.reduce((t, j) => t + (j || 0), 0)
  const hariAdaJam = jamHarian.filter((j) => j && j > 0).length
  const rataJam = hariAdaJam ? totalJam / hariAdaJam : 0

  // Komposisi pekan: porsi tiap status dari seluruh catatan pekan ini.
  const totalStatus = Math.max(1, r.Hadir + r.Terlambat + r.Izin + r.Alpha)
  const porsi = (n) => `${(n / totalStatus) * 100}%`

  const judulHari = (d) => {
    const tgl = `${d.hari}, ${d.tgl} ${bulanIndo[Number(d.tanggal.slice(5, 7)) - 1]} ${d.tanggal.slice(0, 4)}`
    const libur = d.libur ? ` — ${d.libur.nama}` : ''
    const rec = d.record?.status
      ? ` — ${d.record.status}${d.record.checkIn && d.record.checkIn !== '-' ? ` (${d.record.checkIn}–${d.record.checkOut || '…'})` : ''}`
      : ''
    return `${tgl}${rec}${libur}`
  }

  return (
    <div className="card">
      {/* Kepala kartu */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
          <BarChart3 size={16} className="shrink-0 text-indigo-500" />
          <span className="truncate">Statistik Mingguan</span>
        </h2>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
          <Flame size={13} /> {streak} hari beruntun
        </span>
      </div>

      {/* Navigasi pekan (Senin → Minggu) */}
      <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setGeser((g) => Math.max(GESER_MIN, g - 1))}
          disabled={geser <= GESER_MIN}
          aria-label="Pekan sebelumnya"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-slate-500 transition active:scale-90 disabled:opacity-30 dark:bg-slate-900 dark:text-slate-300"
        >
          <ChevronLeft size={16} />
        </button>
        <button type="button" onClick={() => setGeser(0)} className="min-w-0 text-center">
          <span className={`block truncate text-xs font-bold ${geser !== 0 ? 'underline decoration-dotted underline-offset-4' : ''}`}>
            {pekan.label}
          </span>
          <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {pekan.nama}
            {geser !== 0 ? ' · ketuk untuk kembali' : ''}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setGeser((g) => Math.min(GESER_MAKS, g + 1))}
          disabled={geser >= GESER_MAKS}
          aria-label="Pekan berikutnya"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-slate-500 transition active:scale-90 disabled:opacity-30 dark:bg-slate-900 dark:text-slate-300"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Rekap status pekan terpilih */}
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {STATUS_REKAP.map((s) => (
          <div key={s} className="min-w-0 rounded-2xl bg-slate-50 py-2 dark:bg-slate-800/60">
            <p className={`text-base font-extrabold leading-none ${WARNA_ANGKA[s]}`}>{r[s]}</p>
            <p className="mt-1 truncate text-[9px] font-semibold uppercase tracking-wide text-slate-400">{s}</p>
          </div>
        ))}
      </div>

      {/* Komposisi pekan — satu batang bertumpuk, sekali pandang terbaca */}
      <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {STATUS_REKAP.map((s) =>
          r[s] > 0 ? <span key={s} className={`${WARNA_TITIK[s]} h-full`} style={{ width: porsi(r[s]) }} title={`${s}: ${r[s]} hari`} /> : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-400">
        <span>
          {r.masuk} dari {r.hariKerja} hari kerja · <b className="text-indigo-500 dark:text-indigo-400">{r.persen}% kehadiran</b>
        </span>
        <span className="flex items-center gap-1">
          <Clock3 size={11} /> total {jamTeks(totalJam)} · rata-rata {jamTeks(rataJam)}/hari
        </span>
      </div>

      {/* Grafik jam kerja per hari — garis putus-putus = target 8 jam */}
      <div className="relative mt-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28">
          <div className="absolute inset-x-0 bottom-0 h-px bg-slate-200 dark:bg-slate-700" />
          <div className="absolute inset-x-0 border-t border-dashed border-slate-200 dark:border-slate-700" style={{ bottom: '50%' }} />
          <div className="absolute inset-x-0 border-t border-dashed border-indigo-300 dark:border-indigo-500/40" style={{ bottom: `${(JAM_TARGET / JAM_SKALA) * 100}%` }}>
            <span className="absolute -top-3.5 right-0 flex items-center gap-0.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-300">
              <Target size={9} /> {JAM_TARGET} jam
            </span>
          </div>
        </div>

        <div className="relative flex items-end gap-1">
          {pekan.hari.map((d, i) => {
            const jam = jamKerja(d.record)
            const status = d.record?.status
            const tinggi = jam ? Math.min(100, (jam / JAM_SKALA) * 100) : 0
            const terpilih = pilih === d.tanggal
            return (
              <button
                key={d.tanggal}
                type="button"
                onClick={() => setPilih(terpilih ? null : d.tanggal)}
                title={judulHari(d)}
                aria-pressed={terpilih}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl pb-1 pt-1.5 transition ${
                  terpilih ? 'bg-indigo-100/70 dark:bg-indigo-500/20' : d.hariIni ? 'bg-indigo-50/70 dark:bg-indigo-500/10' : ''
                }`}
              >
                <span className={`text-[9px] font-bold leading-none ${jam ? 'text-slate-500 dark:text-slate-300' : 'text-transparent'}`}>
                  {jam ? jamTeks(jam) : '--'}
                </span>
                <span className="flex h-28 w-full items-end justify-center">
                  {jam ? (
                    <span
                      className={`bar-anim w-4 rounded-t-lg ${WARNA_BAR[status] || 'bg-slate-400'}`}
                      style={{ height: `${tinggi}%`, animationDelay: `${i * 60}ms` }}
                    />
                  ) : status === 'Izin' || status === 'Alpha' ? (
                    <span className={`bar-anim h-2 w-4 rounded-full ${WARNA_BAR[status]}`} style={{ animationDelay: `${i * 60}ms` }} />
                  ) : (
                    <span className={`h-1.5 w-4 rounded ${d.libur ? 'bg-rose-300 dark:bg-rose-500/50' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  )}
                </span>
                <span className={`text-[10px] font-semibold leading-none ${
                  d.libur || d.akhirPekan ? 'text-rose-500 dark:text-rose-400' : d.hariIni ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                }`}
                >
                  {d.namaPendek}
                </span>
                <span className={`text-[10px] font-bold leading-none ${d.hariIni ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-500'}`}>
                  {d.tgl}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail hari terpilih (ketuk batangnya) */}
      {detail && (
        <div className="mt-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs font-bold">{judulHari(detail)}</p>
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {detail.record?.status || (detail.libur ? 'Libur' : detail.hariKerja ? 'Belum ada' : 'Non-kerja')}
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            <span>Masuk {detail.record?.checkIn || '—'}</span>
            <span>Pulang {detail.record?.checkOut || '—'}</span>
            <span>Durasi {jamTeks(jamKerja(detail.record))}</span>
          </p>
          {detail.record?.keterangan && (
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{detail.record.keterangan}</p>
          )}
        </div>
      )}

      {/* Tanggal merah pada pekan terpilih (kalender Indonesia) */}
      {pekan.libur.length > 0 && (
        <div className="mt-3 space-y-1 rounded-2xl bg-rose-50 p-2.5 dark:bg-rose-500/10">
          {pekan.libur.map((l) => (
            <p key={l.tanggal} className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-300">
              <PartyPopper size={12} className="shrink-0" />
              <span>{l.hariKe} {bulanIndo[l.bulan].slice(0, 3)} — {l.nama}</span>
              <span className="rounded-full bg-rose-200/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
                {l.jenis === 'cuti' ? 'Cuti bersama' : 'Libur nasional'}
              </span>
            </p>
          ))}
        </div>
      )}

      {!pekan.adaData && (
        <p className="mt-3 rounded-2xl bg-slate-50 py-2 text-center text-[11px] font-semibold text-slate-400 dark:bg-slate-800/60">
          Belum ada catatan absensi pada pekan ini.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium text-slate-400">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Hadir</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-500" /> Terlambat</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-sky-500" /> Izin</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-500" /> Alpha</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-300 dark:bg-rose-500/50" /> Libur / cuti bersama</span>
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-400">
        Tinggi batang = <b>durasi kerja</b> (target {JAM_TARGET} jam). Pekan <b>Senin – Minggu</b>; tanggal merah &amp;
        cuti bersama tidak dihitung hari kerja. Ketuk batang untuk melihat detail harian.
      </p>
    </div>
  )
}
import { useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight, Flame, PartyPopper } from 'lucide-react'
import { dataPekan, hitungStreak, HARI_KERJA_DEFAULT } from '../utils/statistik'
import { bulanIndo } from '../utils/date'
import { JADWAL_DEFAULT } from '../hooks/useAbsensi'

const WARNA_BAR = {
  Hadir: 'bg-gradient-to-t from-emerald-600 to-emerald-400',
  Terlambat: 'bg-gradient-to-t from-amber-600 to-amber-400',
  Izin: 'bg-gradient-to-t from-sky-600 to-sky-400',
  Alpha: 'bg-gradient-to-t from-rose-600 to-rose-400',
}
const WARNA_ANGKA = {
  Hadir: 'text-emerald-600 dark:text-emerald-400',
  Terlambat: 'text-amber-600 dark:text-amber-400',
  Izin: 'text-sky-600 dark:text-sky-400',
  Alpha: 'text-rose-600 dark:text-rose-400',
}
const STATUS_REKAP = ['Hadir', 'Terlambat', 'Izin', 'Alpha']
const GESER_MIN = -26 // batas mundur ± 6 bulan riwayat absensi
const GESER_MAKS = 0 // pekan depan belum ada catatan → tidak bisa dilampaui

// Kartu statistik mingguan: streak 🔥 + grafik batang SATU PEKAN utuh
// (Senin → Minggu) lengkap dengan tanggal tiap hari, rekap pekan, dan daftar
// tanggal merah (libur nasional & cuti bersama) pada pekan tersebut.
export default function KartuStatistik({ history = [], jadwal = JADWAL_DEFAULT }) {
  const [geser, setGeser] = useState(0)
  const hariKerja = jadwal?.hariKerja?.length ? jadwal.hariKerja : HARI_KERJA_DEFAULT
  const pekan = dataPekan(history, { geser, hariKerja })
  const streak = hitungStreak(history)

  const judulHari = (d) => {
    const tgl = `${d.hari}, ${d.tgl} ${bulanIndo[Number(d.tanggal.slice(5, 7)) - 1]} ${d.tanggal.slice(0, 4)}`
    const libur = d.libur ? ` — ${d.libur.nama}` : ''
    const absen = d.record?.status
      ? ` — ${d.record.status}${d.record.checkIn && d.record.checkIn !== '-' ? ` (${d.record.checkIn})` : ''}`
      : ''
    return `${tgl}${absen}${libur}`
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
          <BarChart3 size={16} className="shrink-0 text-indigo-500" />
          <span className="truncate">Statistik Mingguan</span>
        </h2>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
          <Flame size={13} /> {streak} hari beruntun
        </span>
      </div>

      {/* Navigasi pekan — SATU pekan per tampilan (Senin s/d Minggu) */}
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
          <span className="block truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
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

      {/* Rekap pekan terpilih */}
      <div className="mb-2 grid grid-cols-4 gap-1.5 text-center">
        {STATUS_REKAP.map((s) => (
          <div key={s} className="min-w-0 rounded-2xl bg-slate-50 py-2.5 dark:bg-slate-800/60">
            <p className={`text-lg font-extrabold leading-none ${WARNA_ANGKA[s]}`}>{pekan.rekap[s]}</p>
            <p className="mt-1.5 truncate text-xs font-bold leading-tight text-slate-600 dark:text-slate-300">{s}</p>
          </div>
        ))}
      </div>
      <p className="mb-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
        {pekan.rekap.masuk} dari {pekan.rekap.hariKerja} hari kerja ·{' '}
        <b className="text-indigo-600 dark:text-indigo-400">{pekan.rekap.persen}% kehadiran</b>
      </p>

      {/* Batang per hari: Senin → Minggu, nomor tanggal di bawah tiap batang */}
      <div className="flex items-end justify-between gap-1">
        {pekan.hari.map((d, i) => (
          <div
            key={d.tanggal}
            title={judulHari(d)}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl pb-1 pt-1.5 ${
              d.hariIni ? 'bg-indigo-50/70 dark:bg-indigo-500/10' : ''
            }`}
          >
            <div className="flex h-20 w-full items-end justify-center">
              {d.record?.status ? (
                <div
                  className={`bar-anim w-4 rounded-t-lg ${WARNA_BAR[d.record.status] || 'bg-slate-400'}`}
                  style={{
                    height: d.record.status === 'Izin' || d.record.status === 'Alpha' ? '55%' : '100%',
                    animationDelay: `${i * 60}ms`,
                  }}
                />
              ) : (
                <div
                  className={`h-1.5 w-4 rounded ${
                    d.libur ? 'bg-rose-300 dark:bg-rose-500/50' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              )}
            </div>
            <span
              className={`text-xs font-bold leading-none ${
                d.libur || d.akhirPekan
                  ? 'text-rose-500 dark:text-rose-400'
                  : d.hariIni
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {d.namaPendek}
            </span>
            <span
              className={`text-[11px] font-bold leading-none tabular-nums ${
                d.hariIni ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {d.tgl}
            </span>
          </div>
        ))}
      </div>

      {/* Tanggal merah pada pekan terpilih (kalender Indonesia) */}
      {pekan.libur.length > 0 && (
        <div className="mt-3 space-y-1 rounded-2xl bg-rose-50 p-2.5 dark:bg-rose-500/10">
          {pekan.libur.map((l) => (
            <p
              key={l.tanggal}
              className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-300"
            >
              <PartyPopper size={12} className="shrink-0" />
              <span>
                {l.hariKe} {bulanIndo[l.bulan].slice(0, 3)} — {l.nama}
              </span>
              <span className="rounded-full bg-rose-200/70 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
                {l.jenis === 'cuti' ? 'Cuti bersama' : 'Libur nasional'}
              </span>
            </p>
          ))}
        </div>
      )}

      {!pekan.adaData && (
        <p className="mt-3 rounded-2xl bg-slate-50 py-2.5 text-center text-xs font-semibold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          Belum ada catatan absensi pada pekan ini.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Hadir</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-500" /> Terlambat</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-sky-500" /> Izin</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-500" /> Alpha</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-300 dark:bg-rose-500/50" /> Libur / cuti bersama</span>
      </div>
      <p className="mt-2.5 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Pekan dihitung <b>Senin – Minggu</b>; tanggal merah &amp; cuti bersama tidak dihitung sebagai hari kerja.
      </p>
    </div>
  )
}

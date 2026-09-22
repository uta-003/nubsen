import { useMemo, useState } from 'react'
import { History as HistoryIcon, Filter, MapPin, Paperclip, Info, Download, ChevronRight, PartyPopper, Loader2, Camera, UserX } from 'lucide-react'
import { formatTanggalLengkap, formatTanggalPendek, hariIndo } from '../utils/date'
import { detailLibur } from '../utils/liburIndonesia'
import { assetUrl } from '../api'
import { MIME, buatCSV } from '../utils/berkas'
import { unduhBerkas, pesanHasilUnduh } from '../utils/unduh'
import StatusBadge from './StatusBadge'
import RiwayatDetail from './RiwayatDetail'
import KalenderBulan from './KalenderBulan'

const STATUS_LIST = ['Semua', 'Hadir', 'Terlambat', 'Izin', 'Alpha']
// Warna angka rekap & aksen kiri kartu per status — hierarki visual instan.
const WARNA_REKAP = {
  Hadir: 'text-emerald-600 dark:text-emerald-400',
  Terlambat: 'text-amber-600 dark:text-amber-400',
  Izin: 'text-sky-600 dark:text-sky-400',
  Alpha: 'text-rose-600 dark:text-rose-400',
}
const AKSEN_REKAP = {
  Hadir: 'bg-emerald-500',
  Terlambat: 'bg-amber-500',
  Izin: 'bg-sky-500',
  Alpha: 'bg-rose-500',
}

// Tanggal 'YYYY-MM-DD' → 'dd/mm/yyyy' — format tabel Indonesia yang langsung
// terbaca rapi saat CSV dibuka di Excel (bukan 'YYYY-MM-DD' beralur teknis).
const tanggalCsv = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso || ''
  const dua = (n) => String(n).padStart(2, '0')
  return `${dua(d.getDate())}/${dua(d.getMonth() + 1)}/${d.getFullYear()}`
}

// Durasi kerja dari jam 'HH:MM' masuk → pulang, ringkas ('7j 45m'); '-'
// bila salah satu kosong atau jamnya tidak wajar (pulang ≤ masuk).
const durasiCsv = (masuk, pulang) => {
  const keMenit = (t) => {
    const cocok = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''))
    return cocok ? Number(cocok[1]) * 60 + Number(cocok[2]) : null
  }
  const a = keMenit(masuk)
  const b = keMenit(pulang)
  if (a == null || b == null || b <= a) return '-'
  return `${Math.floor((b - a) / 60)}j ${(b - a) % 60}m`
}

export default function Riwayat({ history, toast }) {
  const [status, setStatus] = useState('Semua')
  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('daftar') // 'daftar' | 'kalender'

  // Baris turunan pengajuan izin (sumber 'izin') dikeluarkan dari seluruh
  // riwayat bottom-nav — tab ini KHUSUS riwayat absensi. Riwayat pengajuan
  // izin/cuti (semua jenis & status) ada di halaman Pengajuan → Izin/Cuti.
  const absensi = useMemo(() => history.filter((h) => h.sumber !== 'izin'), [history])

  const data = useMemo(
    () =>
      absensi
        .filter((h) => (status === 'Semua' ? true : h.status === status))
        .filter((h) => (dari ? h.tanggal >= dari : true))
        .filter((h) => (sampai ? h.tanggal <= sampai : true))
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    [absensi, status, dari, sampai],
  )

  // Unduh data sesuai filter aktif sebagai CSV. Dipusatkan di utils/unduh.js
  // supaya berfungsi DUA jalur: peramban (Blob + <a download>) dan aplikasi
  // Android (WebView tidak punya UI unduhan untuk blob: → berkas ditulis ke
  // Cache lalu dibuka lewat lembar "Bagikan/Simpan").
  const [mengunduh, setMengunduh] = useState(false)

  const exportCSV = async () => {
    if (!data.length || mengunduh) return
    setMengunduh(true)
    try {
      // Layout "kekinian": blok judul + meta periode + rekap, baris kosong
      // pemisah, lalu tabel dengan kolom tambahan (No, Hari, Durasi, Hari
      // Libur, Lokasi). Tetap CSV ';' + BOM ramah Excel Indonesia.
      const sekarang = new Date()
      const dua = (n) => String(n).padStart(2, '0')
      const jamUnduh = `${dua(sekarang.getDate())}/${dua(sekarang.getMonth() + 1)}/${sekarang.getFullYear()} ${dua(sekarang.getHours())}:${dua(sekarang.getMinutes())}`
      const rekap = ['Hadir', 'Terlambat', 'Izin', 'Alpha']
        .map((s) => `${s} ${data.filter((h) => h.status === s).length}`)
        .join(' • ')
      const baris = [
        ['RIWAYAT ABSENSI — NUBSEN'],
        [`Periode: ${dari ? formatTanggalPendek(dari) : 'semua'} s.d. ${sampai ? formatTanggalPendek(sampai) : 'hari ini'}   •   ${data.length} catatan   •   Diunduh ${jamUnduh}`],
        [`Rekap: ${rekap}`],
        [],
        ['No', 'Tanggal', 'Hari', 'Masuk', 'Pulang', 'Durasi', 'Status', 'Hari Libur', 'Lokasi', 'Keterangan', 'Lampiran'],
        ...data.map((h, i) => {
          const d = new Date(h.tanggal)
          const libur = detailLibur(h.tanggal)
          return [
            i + 1,
            tanggalCsv(h.tanggal),
            hariIndo[d.getDay()],
            h.checkIn || '-',
            h.checkOut || '-',
            durasiCsv(h.checkIn, h.checkOut),
            h.status,
            libur?.nama || '',
            h.lokasi ? `${h.lokasi.lat}, ${h.lokasi.lon}${h.lokasi.alamat ? ` — ${h.lokasi.alamat}` : ''}` : '',
            h.keterangan || '',
            h.lampiran || '',
          ]
        }),
        [],
        ['Dibuat otomatis oleh NUBSEN — pemisah titik koma agar tabel langsung rapi di Excel.'],
      ]
      const hasil = await unduhBerkas({
        nama: `riwayat-absensi-${dari || 'awal'}-sd-${sampai || 'terbaru'}.csv`,
        isi: buatCSV(baris),
        mime: MIME.csv,
        judul: 'Riwayat Absensi NUBSEN',
      })
      toast?.(pesanHasilUnduh(hasil, 'CSV riwayat'), 'success')
    } catch (e) {
      toast?.(e.message || 'CSV gagal disiapkan.', 'error')
    } finally {
      setMengunduh(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 text-xl font-extrabold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-lg shadow-indigo-500/30">
              <HistoryIcon size={17} />
            </span>
            Riwayat
          </h1>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{data.length} catatan ditemukan</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={!data.length || mengunduh}
          title={data.length ? 'Unduh CSV sesuai filter' : 'Tidak ada data untuk diunduh'}
          className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:active:scale-100"
        >
          {mengunduh ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} CSV
        </button>
      </div>

      {/* Rekap cepat sesuai filter aktif — kartu kaca dengan aksen bar warna status */}
      <div className="mb-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        {['Hadir', 'Terlambat', 'Izin', 'Alpha'].map((s, i) => (
          <div
            key={s}
            className="animate-rise relative min-w-0 overflow-hidden rounded-2xl border border-white/60 bg-white/85 p-2.5 pt-3 shadow-card backdrop-blur-xl dark:border-white/[.06] dark:bg-slate-900/70"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${AKSEN_REKAP[s]}`} />
            <p className={`text-xl font-extrabold leading-none tabular-nums ${WARNA_REKAP[s]}`}>{data.filter((h) => h.status === s).length}</p>
            <p className="mt-1 flex items-center justify-center gap-1 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {s}
            </p>
          </div>
        ))}
      </div>

      {/* Tab: Daftar / Kalender — segmen kaca */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-[1.4rem] border border-white/50 bg-white/70 p-1.5 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
        {[
          ['daftar', '📋 Daftar'],
          ['kalender', '🗓️ Kalender'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-[1rem] py-2.5 text-xs font-bold transition-all duration-300 ${
              tab === id
                ? 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30'
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
      {/* Filter status: dibiarkan membungkus (wrap) agar semua pilihan tetap
          terlihat di layar ponsel sempit — tidak ada chip yang terpotong. */}
      <div className="flex flex-wrap gap-2">
        {STATUS_LIST.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
              status === s
                ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-md shadow-indigo-500/30'
                : 'border border-slate-200 bg-white/80 text-slate-500 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400'
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
        <div className="card animate-rise flex flex-col items-center gap-2 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-3xl bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600">
            <HistoryIcon size={26} />
          </span>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Tidak ada catatan</p>
          <p className="text-xs text-slate-400">Coba ubah filter status atau rentang tanggal.</p>
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          {data.map((h, i) => (
            <div
              key={h.tanggal + h.keterangan}
              onClick={() => setDetail(h)}
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
              className="card animate-rise relative cursor-pointer overflow-hidden p-4 pl-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-1 hover:ring-indigo-200 dark:hover:ring-indigo-500/30"
            >
              <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${AKSEN_REKAP[h.status] || 'bg-slate-300 dark:bg-slate-600'}`} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{formatTanggalLengkap(new Date(h.tanggal))}</p>
                  {detailLibur(h.tanggal) && (
                    <p className="mt-0.5 flex items-start gap-1 text-[11px] font-semibold text-rose-500 dark:text-rose-400">
                      <PartyPopper size={11} className="mt-0.5 shrink-0" /> {detailLibur(h.tanggal).nama}
                    </p>
                  )}
                  {h.status === 'Alpha' ? (
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-rose-500 dark:text-rose-400">
                      <UserX size={12} className="shrink-0" /> Tanpa absen masuk &amp; pulang — Alpha otomatis
                    </p>
                  ) : (
                    <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                      Masuk {h.checkIn} • Pulang {h.checkOut}
                    </p>
                  )}
                  {h.keterangan && h.status !== 'Alpha' && (
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
                  {(h.adaSelfie || h.adaSelfiePulang) && (
                    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      <Camera size={11} /> Foto
                    </span>
                  )}
                  {h.hariLibur && (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                      🌴 Hari libur
                    </span>
                  )}
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
        <KalenderBulan history={absensi} onSelect={setDetail} />
      )}

      <RiwayatDetail rec={detail} onClose={() => setDetail(null)} />
    </div>
  )
}


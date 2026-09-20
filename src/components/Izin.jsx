import { useEffect, useRef, useState } from 'react'
import {
  CalendarPlus, Paperclip, Send, CheckCircle2, Trash2, FileText, Thermometer, Plane, Sparkles,
  Hourglass, XCircle, Clock4, ListChecks, Info, Loader2,
} from 'lucide-react'
import { getLeaves, getLampiranIzin } from '../api'
import { toISODate, formatTanggalPendek } from '../utils/date'
import PratinjauLampiran from './PratinjauLampiran'

const JENIS = ['Izin', 'Sakit', 'Cuti Tahunan', 'Cuti Khusus']
// Ikon + warna per jenis pengajuan — chip berwarna di tombol pilihan.
const IKON_JENIS = {
  Izin: { Icon: FileText, chip: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400' },
  Sakit: { Icon: Thermometer, chip: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400' },
  'Cuti Tahunan': { Icon: Plane, chip: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400' },
  'Cuti Khusus': { Icon: Sparkles, chip: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400' },
}
// Chip status pengajuan pada riwayat — gaya sama dengan riwayat pengajuan lembur.
const CHIP = {
  Menunggu: { kelas: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400', aksen: 'bg-amber-400', Icon: Hourglass },
  Disetujui: { kelas: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', aksen: 'bg-emerald-500', Icon: CheckCircle2 },
  Ditolak: { kelas: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400', aksen: 'bg-rose-500', Icon: XCircle },
}

// Waktu pengajuan ringkas untuk kartu riwayat ("12 Sep, 14.30").
const formatWaktu = (s) => {
  try {
    return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('id-ID', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return s
  }
}

export default function Izin({ onSubmit, sisaCuti = null }) {
  const fileRef = useRef(null)
  const [form, setForm] = useState({
    jenis: 'Izin',
    mulai: toISODate(),
    selesai: toISODate(),
    keterangan: '',
  })
  const [lampiran, setLampiran] = useState(null)
  const [berhasil, setBerhasil] = useState(false)
  // ---- Riwayat pengajuan (semua jenis & status) — sejajar dengan halaman Lembur ----
  const [data, setData] = useState([]) // hasil GET /api/leaves (semua pengajuan sendiri)
  const [tambahan, setTambahan] = useState([]) // entri optimistik saat luring (belum terkirim)
  const [memuat, setMemuat] = useState(true)
  // Pratinjau lampiran — isi berkas diambil dari server saat tombol ditekan saja,
  // sehingga daftar pengajuan tetap ringan (tanpa base64).
  const [pratinjau, setPratinjau] = useState(null)

  const bukaLampiran = async (l) => {
    setPratinjau({ buka: true, judul: `Lampiran ${l.jenis} — ${formatTanggalPendek(l.mulai)}`, memuat: true, isi: null, galat: null })
    try {
      const d = await getLampiranIzin(l.id)
      setPratinjau((s) => ({ ...s, isi: d.lampiran, memuat: false }))
    } catch (e) {
      setPratinjau((s) => ({ ...s, memuat: false, galat: e.message }))
    }
  }

  const muat = () =>
    getLeaves()
      .then((rows) => {
        setData(Array.isArray(rows) ? rows : [])
        setTambahan([]) // antrean luring kini terwakili data resmi dari server
      })
      .catch(() => { /* luring: pertahankan daftar lama + entri optimistik */ })
      .finally(() => setMemuat(false))

  useEffect(() => {
    muat()
    // Setelah antrean luring tersinkron ke server, segarkan daftar riwayat.
    const onSinkron = () => muat()
    window.addEventListener('absenku:tersinkron', onSinkron)
    return () => window.removeEventListener('absenku:tersinkron', onSinkron)
  }, [])

  // Gabungan data server + entri optimistik luring, terbaru di atas.
  const gabungan = [...tambahan, ...data].sort((a, b) =>
    String(b.mulai || '').localeCompare(String(a.mulai || '')),
  )

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (form.selesai < form.mulai) {
      alert('Tanggal selesai tidak boleh sebelum tanggal mulai.')
      return
    }
    if (!form.keterangan.trim()) {
      alert('Mohon isi keterangan pengajuan.')
      return
    }
    const isi = { ...form, lampiran }
    const r = await onSubmit(isi)
    if (r?.luring) {
      // Optimistik: tampil sebagai Menunggu berpenanda luring; begitu antrean
      // tersinkron, entri ini tergantikan data resmi dari server (via event).
      setTambahan((arr) => [
        ...arr,
        { ...isi, lampiran: null, status: 'Menunggu', luring: true, id: `luring-${Date.now()}` },
      ])
    }
    setBerhasil(true)
    setForm({ jenis: 'Izin', mulai: toISODate(), selesai: toISODate(), keterangan: '' })
    setLampiran(null)
    if (fileRef.current) fileRef.current.value = ''
    setTimeout(() => setBerhasil(false), 3000)
    if (!r?.luring) muat() // online: tarik ulang agar pengajuan baru langsung terlihat
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <h1 className="text-xl font-extrabold tracking-tight">Pengajuan Izin / Cuti</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ajukan ketidakhadiran dengan lampiran pendukung.
        </p>
      </div>

      {berhasil && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-100 p-3.5 text-sm font-semibold text-emerald-700 animate-slide-up dark:bg-emerald-500/15 dark:text-emerald-400">
          <CheckCircle2 size={18} /> Pengajuan berhasil dikirim!
        </div>
      )}

      <form onSubmit={submit} className="card animate-rise space-y-4" style={{ animationDelay: '50ms' }}>
        <div>
          <label className="label">Jenis Pengajuan</label>
          <div className="grid grid-cols-2 gap-2">
            {JENIS.map((j, i) => {
              const { Icon, chip } = IKON_JENIS[j]
              const aktif = form.jenis === j
              return (
                <button
                  key={j}
                  type="button"
                  onClick={() => set('jenis', j)}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className={`animate-rise flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition active:scale-95 ${
                    aktif
                      ? 'border-transparent bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30'
                      : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${aktif ? 'bg-white/20 text-white' : chip}`}>
                    <Icon size={14} />
                  </span>
                  <span className="truncate">{j}</span>
                </button>
              )
            })}
          </div>
        </div>

        {form.jenis.startsWith('Cuti') && sisaCuti != null && (
          <div className="animate-rise flex items-center gap-3 rounded-2xl bg-sky-50 p-3.5 dark:bg-sky-500/10" style={{ animationDelay: '120ms' }}>
            <span className="animate-floaty grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-sky-500 shadow-sm dark:bg-sky-500/20">
              <Plane size={18} />
            </span>
            <p className="text-xs leading-relaxed text-sky-700 dark:text-sky-400">
              Sisa cuti tahunan Anda: <b>{sisaCuti} hari</b> — akan otomatis dipotong setelah disetujui.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Dari Tanggal</label>
            <input type="date" className="input" value={form.mulai} onChange={(e) => set('mulai', e.target.value)} />
          </div>
          <div>
            <label className="label">Sampai Tanggal</label>
            <input type="date" className="input" value={form.selesai} onChange={(e) => set('selesai', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Keterangan</label>
          <textarea
            className="input min-h-24 resize-none"
            placeholder="Contoh: Demam tinggi, akan melampirkan surat dokter…"
            value={form.keterangan}
            onChange={(e) => set('keterangan', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Lampiran (opsional)</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setLampiran(e.target.files?.[0] || null)}
            className="hidden"
            id="file-lampiran"
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost flex-1">
              <Paperclip size={17} /> Pilih File
            </button>
            {lampiran && (
              <button
                type="button"
                onClick={() => { setLampiran(null); if (fileRef.current) fileRef.current.value = '' }}
                className="grid h-11 w-11 place-items-center rounded-2xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                aria-label="Hapus lampiran"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
          {lampiran && (
            <p className="mt-2 truncate rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              📎 {lampiran.name} ({Math.round(lampiran.size / 1024)} KB)
            </p>
          )}
        </div>

        <button type="submit" className="btn-primary w-full">
          <Send size={17} /> Kirim Pengajuan
        </button>
      </form>

      {/* ---- Riwayat Pengajuan: semua jenis (Izin, Sakit, Cuti Tahunan, Cuti Khusus) ---- */}
      <div className="mb-3 mt-6 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
        <ListChecks size={16} className="text-indigo-500" /> Riwayat Pengajuan ({gabungan.length})
      </div>

      {memuat ? (
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 size={13} className="animate-spin" /> Memuat…
        </p>
      ) : gabungan.length === 0 ? (
        <div className="card animate-rise flex flex-col items-center gap-2 py-10 text-center">
          <span className="animate-floaty grid h-14 w-14 place-items-center rounded-3xl bg-sky-50 text-sky-400 dark:bg-sky-500/10">
            <CalendarPlus size={26} />
          </span>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Belum ada pengajuan izin/cuti</p>
          <p className="text-xs text-slate-400">Form di atas siap dipakai — ajukan izin pertamamu.</p>
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          {gabungan.map((l, i) => {
            const { Icon: IkonJenis, chip } = IKON_JENIS[l.jenis] || IKON_JENIS.Izin
            const { Icon: IkonStatus, kelas, aksen } = CHIP[l.status] || CHIP.Menunggu
            const rentang =
              l.selesai && l.selesai !== l.mulai
                ? `${formatTanggalPendek(l.mulai)} – ${formatTanggalPendek(l.selesai)}`
                : formatTanggalPendek(l.mulai)
            return (
              <div
                key={l.id}
                style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                className="card animate-rise relative overflow-hidden p-4 pl-5"
              >
                <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${aksen}`} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${chip}`}>
                        <IkonJenis size={14} />
                      </span>
                      <p className="truncate text-sm font-bold">{l.jenis}</p>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{rentang}</p>
                    {l.keterangan && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{l.keterangan}</p>}
                    <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                      <Clock4 size={11} /> Diajukan {l.dibuat ? formatWaktu(l.dibuat) : 'baru saja'}
                    </p>
                    {l.status === 'Ditolak' && l.alasanTolak && (
                      <p className="mt-1.5 rounded-xl bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold leading-relaxed text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                        💬 {l.alasanTolak}
                      </p>
                    )}
                    {l.luring && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        ⏳ Menunggu sinkron (luring)
                      </span>
                    )}
                    {l.adaLampiran && !l.luring && (
                      <button
                        type="button"
                        onClick={() => bukaLampiran(l)}
                        className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 transition active:scale-95 dark:bg-indigo-500/15 dark:text-indigo-300"
                      >
                        <Paperclip size={11} /> Lihat lampiran
                      </button>
                    )}
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${kelas}`}>
                    <IkonStatus size={12} /> {l.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="animate-rise mt-4 flex items-start gap-3 rounded-3xl bg-indigo-50 p-4 text-xs leading-relaxed text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300" style={{ animationDelay: '180ms' }}>
        <Info size={18} className="shrink-0" />
        <p>
          Pengajuan yang tanggalnya mencakup hari ini otomatis mengubah status kehadiranmu menjadi
          <b> Izin</b>. Semua pengajuan (Izin, Sakit, Cuti Tahunan, Cuti Khusus) tercatat di
          <b> Riwayat Pengajuan</b> di atas — dan kamu akan menerima <b>notifikasi</b> begitu admin
          menyetujui atau menolaknya.
        </p>
      </div>

      {/* Pratinjau lampiran pengajuan (gambar/PDF) */}
      <PratinjauLampiran
        {...(pratinjau || {})}
        onClose={() => setPratinjau(null)}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Clock4, Send, Hourglass, CheckCircle2, XCircle } from 'lucide-react'
import { getLembur, buatLembur } from '../api'
import { toISODate, formatTanggalPendek } from '../utils/date'
import { tambahAntrean, adalahGalatJaringan } from '../utils/luring'

const CHIP = {
  Menunggu: { kelas: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400', aksen: 'bg-amber-400', Icon: Hourglass },
  Disetujui: { kelas: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', aksen: 'bg-emerald-500', Icon: CheckCircle2 },
  Ditolak: { kelas: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400', aksen: 'bg-rose-500', Icon: XCircle },
}

const durasi = (a, b) => {
  const [h1, m1] = a.split(':').map(Number)
  const [h2, m2] = b.split(':').map(Number)
  const t = h2 * 60 + m2 - (h1 * 60 + m1)
  return `${Math.floor(t / 60)} jam ${t % 60} mnt`
}

// Waktu pengajuan ringkas untuk kartu riwayat ("12 Sep, 14.30") — sejajar
// dengan riwayat pengajuan izin/cuti.
const formatWaktu = (s) => {
  try {
    return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('id-ID', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return s
  }
}

// Halaman pengajuan lembur + riwayat pengajuan sendiri.
export default function Lembur({ toast }) {
  const [form, setForm] = useState({ tanggal: toISODate(), jam_mulai: '18:00', jam_selesai: '20:00', keterangan: '' })
  const [data, setData] = useState([])
  const [memuat, setMemuat] = useState(true)
  const [proses, setProses] = useState(false)

  const muat = () =>
    getLembur()
      .then(setData)
      .catch((e) => toast?.(e.message, 'error'))
      .finally(() => setMemuat(false))

  useEffect(() => {
    muat()
    // Setelah antrean luring tersinkron ke server, segarkan riwayat lembur.
    const onSinkron = () => muat()
    window.addEventListener('absenku:tersinkron', onSinkron)
    return () => window.removeEventListener('absenku:tersinkron', onSinkron)
  }, [])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setProses(true)
    try {
      await buatLembur(form)
      toast?.('Pengajuan lembur terkirim — menunggu persetujuan admin ⏱️')
      setForm((f) => ({ ...f, keterangan: '' }))
      muat()
    } catch (err) {
      // Luring: lembur ikut mengantre (payload JSON murni — aman disimpan).
      if (adalahGalatJaringan(err)) {
        tambahAntrean('lembur', form)
        toast?.('📴 Luring — lembur disimpan di perangkat, dikirim otomatis saat online', 'warn')
      } else {
        toast?.(err.message, 'error')
      }
    } finally {
      setProses(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <h1 className="text-xl font-extrabold tracking-tight">Pengajuan Lembur</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ajukan lembur, admin akan menyetujui lewat notifikasi.
        </p>
      </div>

      <form onSubmit={submit} className="card space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Tanggal</label>
            <input type="date" className="input" value={form.tanggal} onChange={(e) => set('tanggal', e.target.value)} />
          </div>
          <div>
            <label className="label">Mulai</label>
            <input type="time" className="input" value={form.jam_mulai} onChange={(e) => set('jam_mulai', e.target.value)} />
          </div>
          <div>
            <label className="label">Selesai</label>
            <input type="time" className="input" value={form.jam_selesai} onChange={(e) => set('jam_selesai', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Keterangan</label>
          <textarea
            className="input min-h-20 resize-none"
            placeholder="Contoh: Menyelesaikan rilis fitur checkout…"
            value={form.keterangan}
            onChange={(e) => set('keterangan', e.target.value)}
          />
        </div>

        <button type="submit" disabled={proses} className="btn-primary w-full">
          <Send size={17} /> {proses ? 'Mengirim…' : 'Kirim Pengajuan'}
        </button>
      </form>

      <div className="mb-3 mt-6 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
        <Clock4 size={16} className="text-indigo-500" /> Riwayat Pengajuan ({data.length})
      </div>

      {memuat ? (
        <p className="text-xs text-slate-400">Memuat…</p>
      ) : data.length === 0 ? (
        <div className="card animate-rise flex flex-col items-center gap-2 py-10 text-center">
          <span className="animate-floaty grid h-14 w-14 place-items-center rounded-3xl bg-indigo-50 text-indigo-400 dark:bg-indigo-500/10">
            <Clock4 size={26} />
          </span>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Belum ada pengajuan lembur</p>
          <p className="text-xs text-slate-400">Form di atas siap dipakai — ajukan lembur pertamamu.</p>
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          {data.map((l, i) => {
            const { Icon, kelas, aksen } = CHIP[l.status] || CHIP.Menunggu
            return (
              <div
                key={l.id}
                style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                className="card animate-rise relative overflow-hidden p-4 pl-5"
              >
                <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${aksen}`} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{formatTanggalPendek(l.tanggal)}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {l.jamMulai} – {l.jamSelesai} • {durasi(l.jamMulai, l.jamSelesai)}
                    </p>
                    {l.keterangan && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{l.keterangan}</p>}
                    <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                      <Clock4 size={11} /> Diajukan {l.dibuat ? formatWaktu(l.dibuat) : 'baru saja'}
                    </p>
                    {l.status === 'Ditolak' && l.alasanTolak && (
                      <p className="mt-1.5 rounded-xl bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold leading-relaxed text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                        💬 {l.alasanTolak}
                      </p>
                    )}
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${kelas}`}>
                    <Icon size={12} /> {l.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

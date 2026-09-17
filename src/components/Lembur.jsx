import { useEffect, useState } from 'react'
import { Clock4, Send, Hourglass, CheckCircle2, XCircle } from 'lucide-react'
import { getLembur, buatLembur } from '../api'
import { toISODate, formatTanggalPendek } from '../utils/date'

const CHIP = {
  Menunggu: { kelas: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400', Icon: Hourglass },
  Disetujui: { kelas: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', Icon: CheckCircle2 },
  Ditolak: { kelas: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400', Icon: XCircle },
}

const durasi = (a, b) => {
  const [h1, m1] = a.split(':').map(Number)
  const [h2, m2] = b.split(':').map(Number)
  const t = h2 * 60 + m2 - (h1 * 60 + m1)
  return `${Math.floor(t / 60)} jam ${t % 60} mnt`
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
      toast?.(err.message, 'error')
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
        <div className="grid grid-cols-3 gap-3">
          <div>
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
        <p className="card py-8 text-center text-xs text-slate-400">Belum ada pengajuan lembur.</p>
      ) : (
        <div className="space-y-3 pb-2">
          {data.map((l) => {
            const { Icon, kelas } = CHIP[l.status] || CHIP.Menunggu
            return (
              <div key={l.id} className="card flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{formatTanggalPendek(l.tanggal)}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {l.jamMulai} – {l.jamSelesai} • {durasi(l.jamMulai, l.jamSelesai)}
                  </p>
                  {l.keterangan && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{l.keterangan}</p>}
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${kelas}`}>
                  <Icon size={12} /> {l.status}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

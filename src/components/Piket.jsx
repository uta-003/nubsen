import { useEffect, useState } from 'react'
import { Brush, Send, Hourglass, CheckCircle2, XCircle, Wallet, Info, Clock4, CalendarDays } from 'lucide-react'
import { getPiket, buatPiket } from '../api'
import { toISODate, formatTanggalPendek } from '../utils/date'
import { tambahAntrean, adalahGalatJaringan } from '../utils/luring'

const CHIP = {
  Menunggu: { kelas: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400', aksen: 'bg-amber-400', Icon: Hourglass },
  Disetujui: { kelas: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', aksen: 'bg-emerald-500', Icon: CheckCircle2 },
  Ditolak: { kelas: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400', aksen: 'bg-rose-500', Icon: XCircle },
}

const rupiah = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString('id-ID')}`

// Waktu pengajuan ringkas untuk kartu riwayat ("12 Sep, 14.30") — sejajar
// dengan riwayat pengajuan izin/cuti & lembur.
const formatWaktu = (s) => {
  try {
    return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('id-ID', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return s
  }
}

// Halaman pengajuan PIKET (tugas jaga tambahan) + riwayat pengajuan sendiri.
// Piket yang DISETUJUI dibayar sebesar BIAYA PIKET yang ditetapkan admin, dan
// otomatis ikut terhitung pada slip gaji periode penggajian terkait — besar
// bayarannya ditampilkan di sini supaya karyawan tahu sebelum mengajukan.
export default function Piket({ toast }) {
  const [form, setForm] = useState({ tanggal: toISODate(), jam_mulai: '', jam_selesai: '', keterangan: '' })
  const [data, setData] = useState([])
  const [biaya, setBiaya] = useState(0)
  const [memuat, setMemuat] = useState(true)
  const [proses, setProses] = useState(false)

  const muat = () =>
    getPiket()
      .then((d) => {
        setData(d?.items || [])
        setBiaya(Number(d?.biaya) || 0)
      })
      .catch((e) => toast?.(e.message, 'error'))
      .finally(() => setMemuat(false))

  useEffect(() => {
    muat()
    // Setelah antrean luring tersinkron ke server, segarkan riwayat piket.
    const onSinkron = () => muat()
    window.addEventListener('absenku:tersinkron', onSinkron)
    return () => window.removeEventListener('absenku:tersinkron', onSinkron)
  }, [])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    // Jam piket OPSIONAL, tetapi bila diisi harus lengkap (aturan yang sama di server).
    if ((form.jam_mulai && !form.jam_selesai) || (!form.jam_mulai && form.jam_selesai)) {
      return toast?.('Isi jam mulai dan jam selesai sekaligus, atau kosongkan keduanya.', 'error')
    }
    setProses(true)
    try {
      await buatPiket(form)
      toast?.('Pengajuan piket terkirim — menunggu persetujuan admin 🧹')
      setForm((f) => ({ ...f, keterangan: '', jam_mulai: '', jam_selesai: '' }))
      muat()
    } catch (err) {
      // Luring: piket ikut mengantre (payload JSON murni — aman disimpan).
      if (adalahGalatJaringan(err)) {
        tambahAntrean('piket', form)
        toast?.('📴 Luring — piket disimpan di perangkat, dikirim otomatis saat online', 'warn')
      } else {
        toast?.(err.message, 'error')
      }
    } finally {
      setProses(false)
    }
  }

  const disetujui = data.filter((p) => p.status === 'Disetujui').length

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <h1 className="text-xl font-extrabold tracking-tight">Pengajuan Piket</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Catat tugas piket/jaga tambahan Anda — admin akan menyetujui lewat notifikasi.
        </p>
      </div>

      {/* Besar bayaran piket = pengaturan admin; ditampilkan sebelum mengajukan. */}
      <p className="mb-4 flex items-start gap-2 rounded-2xl bg-teal-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
        <Wallet size={14} className="mt-0.5 shrink-0" />
        <span>
          {biaya > 0
            ? <>Setiap piket yang <b>disetujui</b> dibayar <b>{rupiah(biaya)}</b> — otomatis ikut terhitung pada slip gaji periode terkait.</>
            : <>Besaran <b>biaya piket</b> belum ditetapkan admin. Pengajuan tetap bisa dikirim; nilainya muncul di slip gaji setelah admin mengaturnya (Admin → Piket).</>}
        </span>
      </p>

      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="label">Tanggal Piket</label>
          <input
            type="date"
            className="input"
            value={form.tanggal}
            onChange={(e) => set('tanggal', e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Jam mulai <span className="text-slate-400">(opsional)</span></label>
            <input type="time" className="input" value={form.jam_mulai} onChange={(e) => set('jam_mulai', e.target.value)} />
          </div>
          <div>
            <label className="label">Jam selesai <span className="text-slate-400">(opsional)</span></label>
            <input type="time" className="input" value={form.jam_selesai} onChange={(e) => set('jam_selesai', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Keterangan</label>
          <textarea
            className="input min-h-20 resize-none"
            placeholder="Contoh: Piket kebersihan aula serbaguna…"
            value={form.keterangan}
            onChange={(e) => set('keterangan', e.target.value)}
          />
        </div>

        <button type="submit" disabled={proses} className="btn-primary w-full">
          <Send size={17} /> {proses ? 'Mengirim…' : 'Kirim Pengajuan'}
        </button>

        <p className="flex items-start gap-2 rounded-2xl bg-slate-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>Satu tanggal hanya boleh punya <b>satu</b> pengajuan yang masih Menunggu/Disetujui agar tidak terhitung dua kali pada gaji.</span>
        </p>
      </form>

      <div className="mb-3 mt-6 flex items-center justify-between gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
        <span className="flex items-center gap-2">
          <Brush size={16} className="text-indigo-500" /> Riwayat Pengajuan ({data.length})
        </span>
        {disetujui > 0 && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            {disetujui} disetujui{biaya > 0 ? ` • ${rupiah(disetujui * biaya)}` : ''}
          </span>
        )}
      </div>

      {memuat ? (
        <p className="text-xs text-slate-400">Memuat…</p>
      ) : data.length === 0 ? (
        <div className="card animate-rise flex flex-col items-center gap-2 py-10 text-center">
          <span className="animate-floaty grid h-14 w-14 place-items-center rounded-3xl bg-indigo-50 text-indigo-400 dark:bg-indigo-500/10">
            <Brush size={26} />
          </span>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Belum ada pengajuan piket</p>
          <p className="text-xs text-slate-400">Form di atas siap dipakai — catat piket pertama Anda.</p>
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          {data.map((p, i) => {
            const { Icon, kelas, aksen } = CHIP[p.status] || CHIP.Menunggu
            return (
              <div
                key={p.id}
                style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                className="card animate-rise relative overflow-hidden p-4 pl-5"
              >
                <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${aksen}`} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{formatTanggalPendek(p.tanggal)}</p>
                    {(p.jamMulai || p.jamSelesai) && (
                      <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                        <Clock4 size={11} /> {p.jamMulai} – {p.jamSelesai}
                      </p>
                    )}
                    {p.keterangan && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{p.keterangan}</p>}
                    <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                      <CalendarDays size={11} /> Diajukan {p.dibuat ? formatWaktu(p.dibuat) : 'baru saja'}
                    </p>
                    {p.status === 'Disetujui' && biaya > 0 && (
                      <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <Wallet size={11} /> Dibayar {rupiah(biaya)}
                      </p>
                    )}
                    {p.status === 'Ditolak' && p.alasanTolak && (
                      <p className="mt-1.5 rounded-xl bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold leading-relaxed text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                        💬 {p.alasanTolak}
                      </p>
                    )}
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${kelas}`}>
                    <Icon size={12} /> {p.status}
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

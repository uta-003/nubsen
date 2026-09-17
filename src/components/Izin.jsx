import { useRef, useState } from 'react'
import { CalendarPlus, Paperclip, Send, CheckCircle2, Trash2 } from 'lucide-react'
import { toISODate } from '../utils/date'

const JENIS = ['Izin', 'Sakit', 'Cuti Tahunan', 'Cuti Khusus']

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

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    if (form.selesai < form.mulai) {
      alert('Tanggal selesai tidak boleh sebelum tanggal mulai.')
      return
    }
    if (!form.keterangan.trim()) {
      alert('Mohon isi keterangan pengajuan.')
      return
    }
    onSubmit({ ...form, lampiran })
    setBerhasil(true)
    setForm({ jenis: 'Izin', mulai: toISODate(), selesai: toISODate(), keterangan: '' })
    setLampiran(null)
    if (fileRef.current) fileRef.current.value = ''
    setTimeout(() => setBerhasil(false), 3000)
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

      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="label">Jenis Pengajuan</label>
          <div className="grid grid-cols-2 gap-2">
            {JENIS.map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => set('jenis', j)}
                className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition active:scale-95 ${
                  form.jenis === j
                    ? 'border-transparent bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {j}
              </button>
            ))}
          </div>
        </div>

        {form.jenis.startsWith('Cuti') && sisaCuti != null && (
          <p className="rounded-2xl bg-sky-50 px-3 py-2.5 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">
            🏖️ Sisa cuti tahunan Anda: {sisaCuti} hari — akan otomatis dipotong setelah disetujui.
          </p>
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

      <div className="mt-4 flex items-start gap-3 rounded-3xl bg-indigo-50 p-4 text-xs leading-relaxed text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
        <CalendarPlus size={18} className="shrink-0" />
        <p>
          Pengajuan yang tanggalnya mencakup hari ini otomatis mengubah status kehadiran Anda menjadi
          <b> Izin</b>. Riwayat pengajuan dapat dipantau di menu <b>Riwayat</b>.
        </p>
      </div>
    </div>
  )
}

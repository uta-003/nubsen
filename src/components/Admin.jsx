import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, Check, X, Send, Megaphone, Users, CheckCheck, LayoutDashboard, Clock, CalendarCheck2, FileText, Timer, Bell } from 'lucide-react'
import * as api from '../api'
import { formatTanggalPendek } from '../utils/date'

// Tab admin: [id, label, ikon] — tampil sebagai grid ikon rapi 4 kolom.
const TABS = [
  ['ringkasan', 'Ringkasan', LayoutDashboard],
  ['jadwal', 'Jadwal', Clock],
  ['karyawan', 'Karyawan', Users],
  ['absensi', 'Absensi', CalendarCheck2],
  ['izin', 'Izin', FileText],
  ['lembur', 'Lembur', Timer],
  ['notifikasi', 'Notifikasi', Bell],
]

// Label & warna jenis notifikasi yang tampil di panel admin.
const JENIS_NOTIF = {
  pengumuman: { label: '📢 Pengumuman', kelas: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  penting: { label: '⚠️ Penting', kelas: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
  info: { label: 'ℹ️ Info', kelas: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  lembur: { label: '⏱️ Lembur', kelas: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' },
  izin: { label: '📄 Izin/Cuti', kelas: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  absensi: { label: '✅ Absensi', kelas: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
}

const CHIP = {
  Menunggu: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  Disetujui: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  Ditolak: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  Hadir: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  Terlambat: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  Izin: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  Alpha: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
}

function Chip({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${CHIP[status] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
      {status}
    </span>
  )
}

function BannerPesan({ pesan }) {
  if (!pesan) return null
  return (
    <p className={`mb-3 rounded-2xl px-3.5 py-2.5 text-xs font-semibold ${pesan.ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400'}`}>
      {pesan.ok ? '✅ ' : '⚠️ '}{pesan.teks}
    </p>
  )
}

// Panel Admin — website backend untuk mengelola seluruh data aplikasi.
export default function Admin({ user, onBack }) {
  const [tab, setTab] = useState('ringkasan')
  const pilihTab = (id) => {
    if (id === tab) return
    try { navigator.vibrate?.(12) } catch { /* tak didukung */ }
    setTab(id)
  }
  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition active:scale-90 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          aria-label="Kembali ke aplikasi"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Panel Admin</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{user?.nama} • akses penuh semua data</p>
        </div>
      </div>

      {/* Tab animasi: grid ikon rapi 4 kolom — semua tab selalu tampil, tidak ada yang tersembunyi.
          Chip masuk bertahap (stagger), tile aktif ber-pop dengan gradasi brand. */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        {TABS.map(([id, label, Icon], i) => {
          const aktif = tab === id
          return (
            <button
              key={id}
              onClick={() => pilihTab(id)}
              style={{ animationDelay: `${i * 40}ms` }}
              className={`animate-fade-in flex flex-col items-center gap-1.5 rounded-2xl border py-3 transition active:scale-95 ${
                aktif
                  ? 'animate-pop border-transparent bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <span
                className={`grid h-8 w-8 place-items-center rounded-xl ${
                  aktif ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-indigo-300'
                }`}
              >
                <Icon size={16} />
              </span>
              <span className="text-[10px] font-bold leading-none">{label}</span>
            </button>
          )
        })}
      </div>

      {/* Konten bertransisi (slide-up) setiap kali tab diganti */}
      <div key={tab} className="animate-slide-up">
        {tab === 'ringkasan' && <Ringkasan />}
        {tab === 'jadwal' && <KelolaJadwal />}
        {tab === 'karyawan' && <KelolaKaryawan />}
        {tab === 'absensi' && <KelolaAbsensi />}
        {tab === 'izin' && <KelolaIzin />}
        {tab === 'lembur' && <KelolaLembur />}
        {tab === 'notifikasi' && <KelolaNotifikasi />}
      </div>
    </div>
  )
}

// Kelola jadwal kerja: jam masuk (batas Terlambat) & jam pulang — tersimpan di server
// dan langsung dipakai seluruh karyawan (status, countdown, pengingat).
function KelolaJadwal() {
  const [form, setForm] = useState({ jamMasukBatas: '', jamPulang: '' })
  const [pesan, setPesan] = useState(null)
  const [simpan, setSimpan] = useState(false)

  useEffect(() => {
    api.adminGetJadwal().then((d) => setForm({ jamMasukBatas: d.jamMasukBatas, jamPulang: d.jamPulang })).catch(() => {})
  }, [])

  const simpanJadwal = async () => {
    setSimpan(true)
    setPesan(null)
    try {
      const d = await api.adminUpdateJadwal(form.jamMasukBatas, form.jamPulang)
      setForm({ jamMasukBatas: d.jamMasukBatas, jamPulang: d.jamPulang })
      setPesan({ ok: true, teks: `Jadwal tersimpan — masuk batas ${d.jamMasukBatas}, pulang ${d.jamPulang}. Semua karyawan langsung memakai jadwal baru.` })
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
    } finally {
      setSimpan(false)
    }
  }

  const ubah = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const siapSimpan = /^([01]\d|2[0-3]):[0-5]\d$/.test(form.jamMasukBatas) && /^([01]\d|2[0-3]):[0-5]\d$/.test(form.jamPulang)

  return (
    <div className="animate-fade-in space-y-4">
      <BannerPesan pesan={pesan} />
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Jam Masuk (Batas)</span>
            <input type="time" value={form.jamMasukBatas} onChange={ubah('jamMasukBatas')} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Jam Pulang</span>
            <input type="time" value={form.jamPulang} onChange={ubah('jamPulang')} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800" />
          </label>
        </div>
        <button onClick={simpanJadwal} disabled={!siapSimpan || simpan} className="btn-primary w-full disabled:opacity-40">
          {simpan ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Jadwal
        </button>
      </div>
      <p className="rounded-3xl bg-indigo-50 p-4 text-xs leading-relaxed text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
        ⏰ <b>Cara kerja:</b> check-in setelah <b>Jam Masuk (Batas)</b> otomatis berstatus <b>Terlambat</b> (dihitung di server,
        tahan manipulasi jam HP). Countdown di Beranda, pengingat notifikasi, dan tulisan &quot;Batas:&quot; langsung mengikuti jadwal ini
        untuk semua karyawan. Format 24 jam HH:MM.
      </p>
    </div>
  )
}

function Ringkasan() {
  const [d, setD] = useState(null)
  useEffect(() => {
    api.adminRingkasan().then(setD).catch(() => {})
  }, [])
  const kartu = [
    ['👥', d?.totalKaryawan, 'Total Karyawan'],
    ['✅', d?.hadirHariIni, 'Hadir Hari Ini'],
    ['📄', d?.izinMenunggu, 'Izin Menunggu'],
    ['⏱️', d?.lemburMenunggu, 'Lembur Menunggu'],
  ]
  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-2 gap-3">
        {kartu.map(([emoji, angka, label]) => (
          <div key={label} className="card text-center">
            <p className="text-2xl">{emoji}</p>
            <p className="mt-1 text-2xl font-extrabold">{angka ?? '—'}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-3xl bg-indigo-50 p-4 text-xs leading-relaxed text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
        💡 Tab <b>Karyawan</b> untuk tambah/edit/hapus akun (termasuk reset PIN), <b>Absensi</b> untuk koreksi manual,
        <b> Izin & Lembur</b> untuk persetujuan, dan <b>Notifikasi</b> untuk mengirim pengumuman ke semua karyawan.
      </p>
    </div>
  )
}
function KelolaKaryawan() {
  const kosong = {
    nama: '', nip: '', jabatan: '', departemen: '', email: '', telepon: '', cutiTahunan: 12, pin: '', isAdmin: false,
  }
  const [data, setData] = useState([])
  const [memuat, setMemuat] = useState(true)
  const [form, setForm] = useState(kosong)
  const [editId, setEditId] = useState(null)
  const [tampilForm, setTampilForm] = useState(false)
  const [proses, setProses] = useState(false)
  const [pesan, setPesan] = useState(null)

  const muat = () => api.adminKaryawan().then(setData).catch(() => {}).finally(() => setMemuat(false))
  useEffect(() => {
    muat()
  }, [])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const simpan = async (e) => {
    e.preventDefault()
    setProses(true)
    try {
      if (editId) {
        await api.adminUbahKaryawan(editId, form)
        setPesan({ ok: true, teks: 'Data karyawan diperbarui.' })
      } else {
        await api.adminTambahKaryawan(form)
        setPesan({ ok: true, teks: 'Karyawan baru ditambahkan (PIN default 123456 bila kosong).' })
      }
      setForm(kosong)
      setEditId(null)
      setTampilForm(false)
      muat()
    } catch (err) {
      setPesan({ ok: false, teks: err.message })
    } finally {
      setProses(false)
    }
  }

  const mulaiEdit = (k) => {
    setEditId(k.id)
    setTampilForm(true)
    setForm({
      nama: k.nama, nip: k.nip || '', jabatan: k.jabatan || '', departemen: k.departemen || '',
      email: k.email, telepon: k.telepon || '', cutiTahunan: k.cutiTahunan, pin: '', isAdmin: k.isAdmin,
    })
    setPesan(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hapus = async (k) => {
    if (!confirm(`Hapus ${k.nama}? Seluruh data absensi/izinya ikut terhapus.`)) return
    try {
      await api.adminHapusKaryawan(k.id)
      setPesan({ ok: true, teks: `${k.nama} dihapus.` })
      muat()
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
    }
  }

  return (
    <div className="animate-fade-in">
      <BannerPesan pesan={pesan} />

      <button
        onClick={() => { setTampilForm(!tampilForm); setEditId(null); setForm(kosong) }}
        className="btn-primary mb-4 w-full"
      >
        <Plus size={16} /> {tampilForm ? 'Tutup Form' : 'Tambah Karyawan'}
      </button>

      {tampilForm && (
        <form onSubmit={simpan} className="card mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Nama *</label><input className="input" value={form.nama} onChange={(e) => set('nama', e.target.value)} required /></div>
            <div><label className="label">NIP</label><input className="input" value={form.nip} onChange={(e) => set('nip', e.target.value)} /></div>
            <div><label className="label">Jabatan</label><input className="input" value={form.jabatan} onChange={(e) => set('jabatan', e.target.value)} /></div>
            <div><label className="label">Departemen</label><input className="input" value={form.departemen} onChange={(e) => set('departemen', e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Email *</label><input type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} required /></div>
            <div><label className="label">Telepon</label><input className="input" value={form.telepon} onChange={(e) => set('telepon', e.target.value)} /></div>
            <div><label className="label">Cuti/Tahun</label><input type="number" min="0" className="input" value={form.cutiTahunan} onChange={(e) => set('cutiTahunan', Number(e.target.value))} /></div>
            <div><label className="label">{editId ? 'PIN Baru (opsional)' : 'PIN (default 123456)'}</label><input className="input" maxLength={6} value={form.pin} onChange={(e) => set('pin', e.target.value.replace(/\D/g, ''))} placeholder="••••••" /></div>
            <label className="flex items-center gap-2 self-end pb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={form.isAdmin} onChange={(e) => set('isAdmin', e.target.checked)} className="h-4 w-4 rounded" /> Jadikan Admin
            </label>
          </div>
          <button type="submit" disabled={proses} className="btn-primary w-full">
            {proses ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {editId ? 'Simpan Perubahan' : 'Tambah Karyawan'}
          </button>
        </form>
      )}

      {memuat ? (
        <p className="text-xs text-slate-400">Memuat…</p>
      ) : (
        <div className="space-y-3 pb-2">
          {data.map((k) => (
            <div key={k.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    {k.nama}
                    {k.isAdmin && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">ADMIN</span>}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{k.jabatan || '—'} • {k.departemen || '—'}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{k.email}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => mulaiEdit(k)} className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600 transition active:scale-90 dark:bg-indigo-500/15 dark:text-indigo-400" aria-label="Edit"><Pencil size={14} /></button>
                  <button onClick={() => hapus(k)} className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-500 transition active:scale-90 dark:bg-rose-500/15" aria-label="Hapus"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
function KelolaAbsensi() {
  const [data, setData] = useState([])
  const [karyawan, setKaryawan] = useState([])
  const [filter, setFilter] = useState({ employeeId: '', dari: '', sampai: '' })
  const [memuat, setMemuat] = useState(true)
  const [edit, setEdit] = useState(null)
  const [pesan, setPesan] = useState(null)

  const muat = (f = filter) => {
    setMemuat(true)
    const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString()
    api.adminAbsensi(q ? `?${q}` : '').then(setData).catch(() => {}).finally(() => setMemuat(false))
  }
  useEffect(() => {
    muat()
    api.adminKaryawan().then(setKaryawan).catch(() => {})
  }, [])

  const simpan = async () => {
    try {
      await api.adminUbahAbsensi(edit.id, { checkIn: edit.checkIn, checkOut: edit.checkOut, status: edit.status })
      setEdit(null)
      setPesan({ ok: true, teks: 'Absensi diperbarui.' })
      muat()
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
    }
  }

  const hapus = async (id) => {
    if (!confirm('Hapus catatan absensi ini?')) return
    try {
      await api.adminHapusAbsensi(id)
      setPesan({ ok: true, teks: 'Catatan absensi dihapus.' })
      muat()
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
    }
  }

  return (
    <div className="animate-fade-in">
      <BannerPesan pesan={pesan} />

      <div className="card mb-4 grid grid-cols-3 gap-2">
        <div><label className="label">Karyawan</label>
          <select className="input !px-3" value={filter.employeeId} onChange={(e) => setFilter((f) => ({ ...f, employeeId: e.target.value }))}>
            <option value="">Semua</option>
            {karyawan.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
          </select>
        </div>
        <div><label className="label">Dari</label><input type="date" className="input !px-3" value={filter.dari} onChange={(e) => setFilter((f) => ({ ...f, dari: e.target.value }))} /></div>
        <div><label className="label">Sampai</label><input type="date" className="input !px-3" value={filter.sampai} onChange={(e) => setFilter((f) => ({ ...f, sampai: e.target.value }))} /></div>
        <button onClick={() => muat()} className="btn-primary col-span-3 !py-2.5">Terapkan Filter</button>
      </div>

      {memuat ? (
        <p className="text-xs text-slate-400">Memuat…</p>
      ) : data.length === 0 ? (
        <p className="card py-8 text-center text-xs text-slate-400">Tidak ada catatan absensi.</p>
      ) : (
        <div className="space-y-3 pb-2">
          {data.map((a) =>
            edit?.id === a.id ? (
              <div key={a.id} className="card space-y-2 p-4 ring-1 ring-indigo-300 dark:ring-indigo-500/40">
                <p className="text-sm font-bold">{a.nama} — {formatTanggalPendek(a.tanggal)}</p>
                <div className="grid grid-cols-3 gap-2">
                  <input type="time" className="input !px-3" value={edit.checkIn || ''} onChange={(e) => setEdit({ ...edit, checkIn: e.target.value })} />
                  <input type="time" className="input !px-3" value={edit.checkOut || ''} onChange={(e) => setEdit({ ...edit, checkOut: e.target.value })} />
                  <select className="input !px-3" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                    {['Hadir', 'Terlambat', 'Izin', 'Alpha'].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={simpan} className="btn-primary flex-1 !py-2.5 text-xs"><Check size={14} /> Simpan</button>
                  <button onClick={() => setEdit(null)} className="btn-ghost !py-2.5 text-xs"><X size={14} /> Batal</button>
                </div>
              </div>
            ) : (
              <div key={a.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{a.nama} <span className="font-normal text-slate-400">• {formatTanggalPendek(a.tanggal)}</span></p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">Masuk {a.checkIn || '—'} • Pulang {a.checkOut || '—'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Chip status={a.status} />
                    <button onClick={() => setEdit({ id: a.id, checkIn: a.checkIn || '', checkOut: a.checkOut || '', status: a.status })} className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600 transition active:scale-90 dark:bg-indigo-500/15 dark:text-indigo-400" aria-label="Edit"><Pencil size={14} /></button>
                    <button onClick={() => hapus(a.id)} className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-500 transition active:scale-90 dark:bg-rose-500/15" aria-label="Hapus"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}
function KelolaIzin() {
  const [data, setData] = useState([])
  const [memuat, setMemuat] = useState(true)
  const [pesan, setPesan] = useState(null)

  const muat = () => api.adminIzin().then(setData).catch(() => {}).finally(() => setMemuat(false))
  useEffect(() => {
    muat()
  }, [])

  const aksi = async (id, status) => {
    try {
      await api.adminStatusIzin(id, status)
      setPesan({ ok: true, teks: `Pengajuan ${status.toLowerCase()} — notifikasi dikirim ke karyawan.` })
      muat()
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
    }
  }

  const hapus = async (id) => {
    if (!confirm('Hapus pengajuan ini?')) return
    try {
      await api.adminHapusIzin(id)
      setPesan({ ok: true, teks: 'Pengajuan dihapus.' })
      muat()
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
    }
  }

  return (
    <div className="animate-fade-in">
      <BannerPesan pesan={pesan} />
      {memuat ? (
        <p className="text-xs text-slate-400">Memuat…</p>
      ) : data.length === 0 ? (
        <p className="card py-8 text-center text-xs text-slate-400">Belum ada pengajuan izin.</p>
      ) : (
        <div className="space-y-3 pb-2">
          {data.map((l) => (
            <div key={l.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{l.nama} <span className="text-xs font-normal text-slate-400">• {l.jenis}</span></p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {formatTanggalPendek(l.mulai)} – {formatTanggalPendek(l.selesai)}
                  </p>
                  {l.keterangan && <p className="mt-1 text-xs text-slate-400">{l.keterangan}</p>}
                  {l.lampiran && (
                    <a
                      href={api.assetUrl(l.lampiran)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-[10px] text-indigo-500 hover:underline"
                    >
                      📎 Lihat lampiran
                    </a>
                  )}
                </div>
                <Chip status={l.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {l.status !== 'Disetujui' && (
                  <button onClick={() => aksi(l.id, 'Disetujui')} className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition active:scale-95">✓ Setujui</button>
                )}
                {l.status !== 'Ditolak' && (
                  <button onClick={() => aksi(l.id, 'Ditolak')} className="flex-1 rounded-xl bg-rose-500 px-3 py-2 text-xs font-bold text-white transition active:scale-95">✕ Tolak</button>
                )}
                <button onClick={() => hapus(l.id)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 transition active:scale-95 dark:bg-slate-800 dark:text-slate-400">Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
function KelolaLembur() {
  const [data, setData] = useState([])
  const [memuat, setMemuat] = useState(true)
  const [pesan, setPesan] = useState(null)

  const muat = () => api.adminLembur().then(setData).catch(() => {}).finally(() => setMemuat(false))
  useEffect(() => {
    muat()
  }, [])

  const aksi = async (id, status) => {
    try {
      await api.adminStatusLembur(id, status)
      setPesan({ ok: true, teks: `Lembur ${status.toLowerCase()} — notifikasi dikirim ke karyawan.` })
      muat()
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
    }
  }

  const hapus = async (id) => {
    if (!confirm('Hapus pengajuan lembur ini?')) return
    try {
      await api.adminHapusLembur(id)
      setPesan({ ok: true, teks: 'Pengajuan dihapus.' })
      muat()
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
    }
  }

  return (
    <div className="animate-fade-in">
      <BannerPesan pesan={pesan} />
      {memuat ? (
        <p className="text-xs text-slate-400">Memuat…</p>
      ) : data.length === 0 ? (
        <p className="card py-8 text-center text-xs text-slate-400">Belum ada pengajuan lembur.</p>
      ) : (
        <div className="space-y-3 pb-2">
          {data.map((o) => (
            <div key={o.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{o.nama} <span className="text-xs font-normal text-slate-400">• {formatTanggalPendek(o.tanggal)}</span></p>
                  <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">{o.jamMulai} – {o.jamSelesai}</p>
                  {o.keterangan && <p className="mt-1 text-xs text-slate-400">{o.keterangan}</p>}
                </div>
                <Chip status={o.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {o.status !== 'Disetujui' && (
                  <button onClick={() => aksi(o.id, 'Disetujui')} className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition active:scale-95">✓ Setujui</button>
                )}
                {o.status !== 'Ditolak' && (
                  <button onClick={() => aksi(o.id, 'Ditolak')} className="flex-1 rounded-xl bg-rose-500 px-3 py-2 text-xs font-bold text-white transition active:scale-95">✕ Tolak</button>
                )}
                <button onClick={() => hapus(o.id)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 transition active:scale-95 dark:bg-slate-800 dark:text-slate-400">Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
function KelolaNotifikasi() {
  const kosong = { employeeId: '', judul: '', pesan: '', jenis: 'pengumuman' }
  const [form, setForm] = useState(kosong)
  const [karyawan, setKaryawan] = useState([])
  const [data, setData] = useState([])
  const [proses, setProses] = useState(false)
  const [pesan, setPesan] = useState(null)
  const [edit, setEdit] = useState(null) // { grupId, judul, pesan, jenis, total }

  const muat = () => api.adminNotifikasi().then(setData).catch(() => {})
  useEffect(() => {
    muat()
    api.adminKaryawan().then(setKaryawan).catch(() => {})
  }, [])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const kirim = async (e) => {
    e.preventDefault()
    setProses(true)
    try {
      const hasil = await api.adminKirimNotifikasi({
        employeeId: form.employeeId ? Number(form.employeeId) : null,
        judul: form.judul,
        pesan: form.pesan,
        jenis: form.jenis,
      })
      const namaTujuan = karyawan.find((k) => String(k.id) === String(form.employeeId))?.nama
      setPesan({
        ok: true,
        teks: form.employeeId
          ? `Notifikasi terkirim ke ${namaTujuan || 'karyawan tersebut'}.`
          : `📢 Pemberitahuan terkirim ke ${hasil.jumlah} karyawan — langsung muncul di menu Notifikasi mereka.`,
      })
      setForm(kosong)
      muat()
    } catch (err) {
      setPesan({ ok: false, teks: err.message })
    } finally {
      setProses(false)
    }
  }

  // Ubah isi pengumuman yang sudah terkirim (semua penerima melihat versi terbaru ini).
  const simpanEdit = async (e) => {
    e.preventDefault()
    setProses(true)
    try {
      await api.adminUbahPengumuman(edit.grupId, { judul: edit.judul, pesan: edit.pesan, jenis: edit.jenis })
      setPesan({ ok: true, teks: 'Pengumuman diperbarui & status baca direset.' })
      setEdit(null)
      muat()
    } catch (err) {
      setPesan({ ok: false, teks: err.message })
    } finally {
      setProses(false)
    }
  }

  const hapusGrup = async (n) => {
    if (!confirm(`Hapus pengumuman ini dari ${n.total} karyawan?`)) return
    try {
      await api.adminHapusPengumuman(n.grupId)
      setPesan({ ok: true, teks: 'Pengumuman dihapus dari semua karyawan.' })
      muat()
    } catch (err) {
      setPesan({ ok: false, teks: err.message })
    }
  }

  const hapus = async (id) => {
    if (!confirm('Hapus notifikasi ini?')) return
    try {
      await api.adminHapusNotifikasi(id)
      muat()
    } catch {
      /* noop */
    }
  }

  return (
    <div className="animate-fade-in">
      <BannerPesan pesan={pesan} />

      <div className="mb-3 flex items-start gap-2 rounded-3xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
        <Megaphone size={16} className="mt-0.5 shrink-0" />
        <span>
          Buat <b>pemberitahuan</b> di sini. Pilih <b>Semua Karyawan</b> agar pengumuman muncul di
          menu <b>🔔 Notifikasi</b> setiap karyawan, lengkap dengan status baca per orang.
        </span>
      </div>

      {edit && (
        <form onSubmit={simpanEdit} className="card mb-4 space-y-3 ring-2 ring-indigo-300 dark:ring-indigo-500/40">
          <p className="text-sm font-bold">✏️ Edit pengumuman • {edit.total} penerima</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Jenis</label>
              <select className="input" value={edit.jenis} onChange={(e) => setEdit((s) => ({ ...s, jenis: e.target.value }))}>
                <option value="pengumuman">📢 Pengumuman</option>
                <option value="penting">⚠️ Penting</option>
                <option value="info">ℹ️ Info</option>
              </select>
            </div>
            <div>
              <label className="label">Judul *</label>
              <input className="input" value={edit.judul} onChange={(e) => setEdit((s) => ({ ...s, judul: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label">Pesan</label>
            <textarea className="input min-h-20 resize-none" value={edit.pesan} onChange={(e) => setEdit((s) => ({ ...s, pesan: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={proses} className="btn-primary flex-1">
              {proses ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Perubahan
            </button>
            <button type="button" onClick={() => setEdit(null)} className="btn-ghost"><X size={16} /> Batal</button>
          </div>
        </form>
      )}

      {!edit && (
        <form onSubmit={kirim} className="card mb-4 space-y-3">
          <div>
            <label className="label">Penerima</label>
            <select className="input" value={form.employeeId} onChange={(e) => set('employeeId', e.target.value)}>
              <option value="">📢 SEMUA KARYAWAN (pemberitahuan)</option>
              {karyawan.map((k) => <option key={k.id} value={k.id}>👤 {k.nama}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Jenis</label>
              <select className="input" value={form.jenis} onChange={(e) => set('jenis', e.target.value)}>
                <option value="pengumuman">📢 Pengumuman</option>
                <option value="penting">⚠️ Penting</option>
                <option value="info">ℹ️ Info</option>
              </select>
            </div>
            <div><label className="label">Judul *</label><input className="input" value={form.judul} onChange={(e) => set('judul', e.target.value)} required placeholder="Contoh: Rapat pagi besok" /></div>
          </div>
          <div><label className="label">Pesan</label>
            <textarea className="input min-h-20 resize-none" value={form.pesan} onChange={(e) => set('pesan', e.target.value)} placeholder="Isi detail pengumuman…" />
          </div>
          <button type="submit" disabled={proses} className="btn-primary w-full">
            {proses ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {form.employeeId ? 'Kirim ke Karyawan Ini' : 'Kirim ke Semua Karyawan'}
          </button>
        </form>
      )}

      <div className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Terkirim ({data.length})</div>
      {data.length === 0 ? (
        <p className="card py-8 text-center text-xs text-slate-400">Belum ada notifikasi terkirim.</p>
      ) : (
        <div className="space-y-3 pb-2">
          {data.map((n) => {
            const jenis = JENIS_NOTIF[n.jenis] || JENIS_NOTIF.info
            const grup = !!n.grupId
            return (
              <div key={n.grupId || n.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${jenis.kelas}`}>{jenis.label}</span>
                      {grup ? (
                        <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                          <Users size={11} /> {n.total} penerima
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">👤 {n.nama}</span>
                      )}
                    </div>
                    <p className="text-sm font-bold">{n.judul}</p>
                    {n.pesan && <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{n.pesan}</p>}
                    {grup ? (
                      <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCheck size={11} /> {n.dibaca}/{n.total} sudah dibaca
                        {n.belumBaca.length > 0 && (
                          <span className="font-normal text-slate-400">• belum: {n.belumBaca.join(', ')}</span>
                        )}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[10px] text-slate-400">{n.dibaca ? '✅ sudah dibaca' : '• belum dibaca'}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {grup && (
                      <button
                        onClick={() => setEdit({ grupId: n.grupId, judul: n.judul, pesan: n.pesan, jenis: n.jenis, total: n.total })}
                        className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600 transition active:scale-90 dark:bg-indigo-500/15 dark:text-indigo-300"
                        aria-label="Edit pengumuman"
                      ><Pencil size={14} /></button>
                    )}
                    <button
                      onClick={() => (grup ? hapusGrup(n) : hapus(n.id))}
                      className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-500 transition active:scale-90 dark:bg-rose-500/15"
                      aria-label="Hapus"
                    ><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}







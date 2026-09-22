import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, Check, X, Send, Megaphone, Users, CheckCheck, LayoutDashboard, Clock, CalendarCheck2, FileText, Timer, Bell, FileSpreadsheet, Download, Filter, RefreshCw, Search, Wallet, CalendarRange, Paperclip, Camera, FileWarning, BarChart3, Building2, ShieldCheck, CheckCircle2, AlertTriangle, Plane, History, FilePlus2, Undo2 } from 'lucide-react'
import { muatPustakaEkspor } from '../utils/ekspor'
import { buatWorkbookLaporan, buatWorkbookGaji, KOLOM_LAPORAN } from '../utils/laporan-excel'
import { MIME } from '../utils/berkas'
import { unduhBerkas, pesanHasilUnduh } from '../utils/unduh'
import * as api from '../api'
import { formatTanggalPendek, toISODate } from '../utils/date'
import ModalTolak from './ModalTolak'
import PratinjauLampiran from './PratinjauLampiran'
import GrafikTren from './GrafikTren'

// Tab admin: [id, label, ikon] — pil menggeser di ponsel, kisi rapi di layar lebar.
const TABS = [
  ['ringkasan', 'Ringkasan', LayoutDashboard],
  ['laporan', 'Laporan', FileSpreadsheet],
  ['gaji', 'Gaji', Wallet],
  ['jadwal', 'Jadwal', Clock],
  ['karyawan', 'Karyawan', Users],
  ['absensi', 'Absensi', CalendarCheck2],
  ['izin', 'Izin', FileText],
  ['lembur', 'Lembur', Timer],
  ['peringatan', 'Peringatan', FileWarning],
  ['riwayatsp', 'Riwayat SP', History],
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
  peringatan: { label: '⚠️ Peringatan', kelas: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
  jadwal: { label: '📅 Jadwal', kelas: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  gaji: { label: '💰 Gaji', kelas: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
}

// Pilihan jenis di form pengiriman. Jenis menentukan HALAMAN tujuan di aplikasi
// karyawan: kategori pengumuman → menu 📢 Pengumuman (kabar perusahaan, punya
// tombol tandai dibaca), kategori personal → menu 🔔 Notifikasi (pesan pribadi).
// Karena itu pilihannya dibatasi oleh Penerima yang dipilih.
const OPSI_PENGUMUMAN = [
  ['pengumuman', '📢 Pengumuman'], ['penting', '⚠️ Penting'], ['jadwal', '📅 Jadwal'], ['info', 'ℹ️ Info'],
]
const OPSI_PERSONAL = [
  ['info', 'ℹ️ Info'], ['absensi', '✅ Absensi'], ['izin', '📄 Izin/Cuti'], ['lembur', '⏱️ Lembur'], ['gaji', '💰 Gaji'],
]

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
  const warna = CHIP[status] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${warna}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  )
}

// Inisial maksimal 2 huruf dari nama karyawan — dipakai avatar di daftar Karyawan.
const inisialDari = (nama) =>
  (nama || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

// Bilah pesan hasil aksi admin — kaca tipis + ikon status, tidak lagi sekadar teks.
function BannerPesan({ pesan }) {
  if (!pesan) return null
  return (
    <div
      role="status"
      className={`animate-rise mb-3 flex items-start gap-2.5 rounded-2xl border p-3 text-xs font-semibold shadow-sm backdrop-blur ${
        pesan.ok
          ? 'border-emerald-200/70 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
          : 'border-rose-200/70 bg-rose-50/90 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300'
      }`}
    >
      <span className={`mt-px shrink-0 ${pesan.ok ? 'text-emerald-500' : 'text-rose-500'}`}>
        {pesan.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      </span>
      <span className="leading-relaxed">{pesan.teks}</span>
    </div>
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
      {/* Kepala panel — bilah gradasi brand dengan pola titik & lencana "Mode Admin" */}
      <div className="aurora relative mb-4 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-4 text-white shadow-xl shadow-indigo-500/25 sm:p-5">
        <span aria-hidden className="absolute -right-10 -top-14 h-36 w-36 rounded-full bg-white/20 blur-2xl" />
        <span aria-hidden className="absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <span aria-hidden className="absolute inset-0 opacity-[0.14] [background-image:radial-gradient(rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={onBack}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/25 bg-white/15 text-white backdrop-blur transition active:scale-90 hover:bg-white/25"
            aria-label="Kembali ke aplikasi"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
              <ShieldCheck size={12} /> Mode Admin
            </p>
            <h1 className="truncate text-lg font-black tracking-tight sm:text-xl">Panel Admin</h1>
            <p className="truncate text-[11px] font-medium text-white/85">{user?.nama} • akses penuh semua data</p>
          </div>
          <span className="hidden shrink-0 rounded-2xl border border-white/25 bg-white/15 px-3 py-2 text-center backdrop-blur sm:block">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-white/70">Ganti menu</span>
            <span className="block text-[11px] font-bold">{TABS.length} tab</span>
          </span>
        </div>
      </div>

      {/* Menu tab: pil menggeser + snap di ponsel, berubah jadi kisi ikon di layar lebar.
          Semua tab selalu tersedia (tidak ada yang tersembunyi di balik menu). */}
      <div className="no-scrollbar mb-4 flex snap-x gap-2 overflow-x-auto px-0.5 pb-1 sm:grid sm:grid-cols-4 sm:gap-2 sm:overflow-visible lg:grid-cols-5">
        {TABS.map(([id, label, Icon], i) => {
          const aktif = tab === id
          return (
            <button
              key={id}
              onClick={() => pilihTab(id)}
              aria-current={aktif ? 'page' : undefined}
              style={{ animationDelay: `${i * 35}ms` }}
              className={`tile-tab animate-fade-in ${
                aktif
                  ? 'animate-pop border-transparent bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30'
                  : 'border-white/60 bg-white/85 text-slate-500 shadow-sm backdrop-blur hover:bg-white dark:border-white/[.06] dark:bg-slate-900/70 dark:text-slate-400 dark:hover:bg-slate-900'
              }`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                  aktif ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600 dark:bg-white/5 dark:text-indigo-300'
                }`}
              >
                <Icon size={16} />
              </span>
              <span className="truncate text-[11px] font-bold sm:w-full sm:text-center sm:text-[10px]">{label}</span>
              {aktif && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white sm:hidden" />}
            </button>
          )
        })}
      </div>

      {/* Konten bertransisi (slide-up) setiap kali tab diganti.
          Kelas `panel-admin` menghidupkan seluruh kartu di dalamnya (gaya di index.css). */}
      <div key={tab} className="panel-admin animate-slide-up">
        {tab === 'ringkasan' && <Ringkasan />}
        {tab === 'laporan' && <Laporan />}
        {tab === 'gaji' && <Gaji />}
        {tab === 'jadwal' && <KelolaJadwal />}
        {tab === 'karyawan' && <KelolaKaryawan />}
        {tab === 'absensi' && <KelolaAbsensi />}
        {tab === 'izin' && <KelolaIzin />}
        {tab === 'lembur' && <KelolaLembur />}
        {tab === 'peringatan' && <KelolaPeringatan />}
        {tab === 'riwayatsp' && <RiwayatPeringatan />}
        {tab === 'notifikasi' && <KelolaNotifikasi />}
      </div>
    </div>
  )
}

// Nama hari untuk pemilih hari kerja (indeks = getDay(): 0 = Minggu).
const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

// Kelola jadwal kerja dengan DUA MODE:
//   • 'biasa' — satu jadwal untuk semua (jam masuk batas + jam pulang + hari kerja)
//   • 'shift' — DUA giliran (Shift 1 & Shift 2); tiap karyawan mengikuti shift yang
//     ditetapkan pada tab Karyawan, dan jam kerjanya otomatis dari shift itu.
// Semua nilai tersimpan di server: status Terlambat, hitung mundur Beranda,
// pengingat, serta perhitungan hari kerja pada laporan/gaji langsung mengikuti.
function KelolaJadwal() {
  const [mode, setMode] = useState('biasa')
  const [form, setForm] = useState({ jamMasukBatas: '', jamPulang: '' })
  const [shift, setShift] = useState({
    1: { nama: '', masuk: '', batas: '', pulang: '' },
    2: { nama: '', masuk: '', batas: '', pulang: '' },
  })
  const [hariKerja, setHariKerja] = useState([])
  const [pesan, setPesan] = useState(null)
  const [simpan, setSimpan] = useState(false)
  // Penugasan shift per karyawan: id → 1 | 2 | null (null = belum ditetapkan,
  // efektifnya ikut Shift 1). `asal` menyimpan nilai dari server agar tombol
  // Simpan hanya mengirim karyawan yang penugasannya benar-benar berubah.
  const [karyawan, setKaryawan] = useState([])
  const [tugasan, setTugasan] = useState({})
  const [asal, setAsal] = useState({})

  useEffect(() => {
    api.adminGetJadwal()
      .then((d) => {
        setMode(d.mode === 'shift' ? 'shift' : 'biasa')
        setForm({ jamMasukBatas: d.jamMasukBatas, jamPulang: d.jamPulang })
        setShift({
          1: { nama: d.shift1?.nama || '', masuk: d.shift1?.masuk || '', batas: d.shift1?.batas || '', pulang: d.shift1?.pulang || '' },
          2: { nama: d.shift2?.nama || '', masuk: d.shift2?.masuk || '', batas: d.shift2?.batas || '', pulang: d.shift2?.pulang || '' },
        })
        setHariKerja(Array.isArray(d.hariKerja) ? d.hariKerja : [1, 2, 3, 4, 5])
      })
      .catch(() => {})
    // Daftar karyawan + penugasan shift saat ini (untuk pemilih multi-karyawan).
    api.adminKaryawan()
      .then((daftar) => {
        setKaryawan(daftar)
        const t = {}
        for (const k of daftar) t[k.id] = k.shift ?? null
        setTugasan(t)
        setAsal({ ...t })
      })
      .catch(() => {})
  }, [])

  const alihTugas = (id, n) =>
    setTugasan((t) => ({ ...t, [id]: t[id] === n ? null : n }))

  const simpanJadwal = async () => {
    setSimpan(true)
    setPesan(null)
    try {
      const d = await api.adminUpdateJadwal({
        mode,
        jamMasukBatas: form.jamMasukBatas,
        jamPulang: form.jamPulang,
        hariKerja,
        shift1: shift[1],
        shift2: shift[2],
      })
      // Terapkan penugasan shift hanya untuk karyawan yang berubah (bulk).
      const berubah = karyawan.filter((k) => (tugasan[k.id] ?? null) !== (asal[k.id] ?? null))
      let gagal = 0
      for (const k of berubah) {
        try {
          await api.adminUbahKaryawan(k.id, { shift: tugasan[k.id] ?? '' })
          setAsal((a) => ({ ...a, [k.id]: tugasan[k.id] ?? null }))
        } catch {
          gagal++
        }
      }
      const soalShift = berubah.length
        ? ` Penugasan shift ${berubah.length - gagal} karyawan diperbarui${gagal ? `, ${gagal} gagal` : ''}.`
        : ''
      setMode(d.mode === 'shift' ? 'shift' : 'biasa')
      const labelHari = (d.hariKerja || hariKerja).map((n) => NAMA_HARI[n]).join(', ')
      // Konfirmasi eksplisit soal broadcast: admin tahu apakah karyawan benar-benar
      // dapat notifikasi perubahan jadwal (tidak dikirim bila tak ada yang berubah).
      const soalNotif = d.notifikasiDikirim
        ? 'Notifikasi perubahan sudah dikirim ke seluruh karyawan.'
        : 'Tidak ada nilai yang berubah, jadi notifikasi tidak dikirim.'
      const ringkas = d.mode === 'shift'
        ? `Mode SHIFT aktif — ${d.shift1.nama} (batas ${d.shift1.batas}, pulang ${d.shift1.pulang}) & ${d.shift2.nama} (batas ${d.shift2.batas}, pulang ${d.shift2.pulang})`
        : `Mode BIASA aktif — masuk batas ${d.jamMasukBatas}, pulang ${d.jamPulang}`
      setPesan({ ok: true, teks: `Jadwal tersimpan — ${ringkas}, hari kerja ${labelHari}.${soalShift} ${soalNotif}` })
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
    } finally {
      setSimpan(false)
    }
  }

  const ubah = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const ubahShift = (nomor, k) => (e) =>
    setShift((s) => ({ ...s, [nomor]: { ...s[nomor], [k]: e.target.value } }))
  const alihHari = (n) =>
    setHariKerja((h) => (h.includes(n) ? h.filter((x) => x !== n) : [...h, n].sort((a, b) => a - b)))
  const jamSah = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '')
  // Mode biasa: jam kantor wajib sah. Mode shift: KEDUA shift wajib lengkap sah.
  const siapSimpan = hariKerja.length > 0 && (mode === 'shift'
    ? [1, 2].every((n) => jamSah(shift[n].masuk) && jamSah(shift[n].batas) && jamSah(shift[n].pulang))
    : jamSah(form.jamMasukBatas) && jamSah(form.jamPulang))

  return (
    <div className="animate-fade-in space-y-4">
      <BannerPesan pesan={pesan} />

      {/* Pemilih MODE jadwal — dua kartu besar yang bisa diketuk */}
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { id: 'biasa', judul: 'Jadwal Kerja Biasa', ket: 'Satu jam kerja yang sama untuk semua karyawan', Icon: Clock },
          { id: 'shift', judul: 'Jadwal Kerja Shift', ket: 'Dua giliran — karyawan mengikuti shift miliknya', Icon: Timer },
        ].map(({ id, judul, ket, Icon }) => {
          const aktif = mode === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              aria-pressed={aktif}
              className={`flex items-start gap-3 rounded-[1.4rem] border p-3.5 text-left transition active:scale-[0.98] ${
                aktif
                  ? 'border-transparent bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30'
                  : 'border-white/60 bg-white/85 text-slate-500 backdrop-blur hover:bg-white dark:border-white/[.06] dark:bg-slate-900/70 dark:text-slate-400'
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                  aktif ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600 dark:bg-white/5 dark:text-indigo-300'
                }`}
              >
                <Icon size={17} />
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-bold ${aktif ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{judul}</span>
                <span className={`block text-[11px] leading-snug ${aktif ? 'text-white/85' : 'text-slate-400'}`}>{ket}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="card space-y-4">
        <h2 className="judul-seksi">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            {mode === 'shift' ? <Timer size={14} /> : <Clock size={14} />}
          </span>
          {mode === 'shift' ? 'Pengaturan Dua Shift' : 'Pengaturan Jam Kerja'}
        </h2>

        {mode === 'biasa' ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Jam Masuk (Batas)</span>
              <input type="time" value={form.jamMasukBatas} onChange={ubah('jamMasukBatas')} className="input !px-3" />
            </label>
            <label className="block">
              <span className="label">Jam Pulang</span>
              <input type="time" value={form.jamPulang} onChange={ubah('jamPulang')} className="input !px-3" />
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="rounded-[1.4rem] border border-indigo-100 bg-indigo-50/40 p-3.5 dark:border-indigo-500/20 dark:bg-indigo-500/[.06]"
              >
                <p className="mb-2.5 flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-[10px] font-black text-white">
                    {n}
                  </span>
                  Shift {n}
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="col-span-2 block">
                    <span className="label">Nama Shift</span>
                    <input
                      className="input !px-3"
                      value={shift[n].nama}
                      onChange={ubahShift(n, 'nama')}
                      placeholder={n === 1 ? 'cth. Shift 1 — Pagi' : 'cth. Shift 2 — Sore'}
                    />
                  </label>
                  <label className="block">
                    <span className="label">Jam Masuk</span>
                    <input type="time" className="input !px-3" value={shift[n].masuk} onChange={ubahShift(n, 'masuk')} />
                  </label>
                  <label className="block">
                    <span className="label">Batas Terlambat</span>
                    <input type="time" className="input !px-3" value={shift[n].batas} onChange={ubahShift(n, 'batas')} />
                  </label>
                  <label className="col-span-2 block sm:col-span-1">
                    <span className="label">Jam Pulang</span>
                    <input type="time" className="input !px-3" value={shift[n].pulang} onChange={ubahShift(n, 'pulang')} />
                  </label>
                </div>
              </div>
            ))}
            {/* Pilih SIAPA SAJA yang masuk tiap shift — centang banyak karyawan
                sekaligus di sini (tidak perlu ke tab Karyawan satu per satu). */}
            <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Karyawan per Shift — centang yang masuk
              </p>
              {karyawan.length === 0 ? (
                <p className="text-xs text-slate-400">Memuat daftar karyawan…</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2].map((n) => (
                    <div key={n} className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-[9px] font-black text-white">
                          {n}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{shift[n].nama || `Shift ${n}`}</span>
                        <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                          {karyawan.filter((k) => tugasan[k.id] === n).length} org
                        </span>
                      </p>
                      <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                        {karyawan.map((k) => {
                          const aktif = tugasan[k.id] === n
                          return (
                            <label
                              key={k.id}
                              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition ${aktif ? 'bg-indigo-100 font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60'}`}
                            >
                              <input
                                type="checkbox"
                                checked={aktif}
                                onChange={() => alihTugas(k.id, n)}
                                className="h-3.5 w-3.5 shrink-0 accent-indigo-600"
                              />
                              <span className="min-w-0 flex-1 truncate">{k.nama}</span>
                              {tugasan[k.id] == null && (
                                <span className="shrink-0 text-[9px] font-semibold text-slate-400">belum</span>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                Tak tercentang di keduanya = <b>belum ditetapkan</b> (otomatis ikut Shift 1). Centang di satu shift
                otomatis mengeluarkan dari shift lainnya. Perubahan tersimpan saat menekan <b>Simpan Jadwal</b>.
              </p>
            </div>
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Hari Kerja</span>
          {/* Tujuh hari dibuat merata satu baris (flex-1 + min-w-0) supaya tetap
              rapi di layar ponsel sempit 320 px tanpa terpotong/berdesakan. */}
          <div className="flex gap-1 sm:gap-1.5">
            {NAMA_HARI.map((nama, n) => (
              <button
                key={nama}
                type="button"
                onClick={() => alihHari(n)}
                aria-pressed={hariKerja.includes(n)}
                className={`h-11 min-w-0 flex-1 rounded-xl px-0 text-[11px] font-bold transition sm:text-xs ${
                  hariKerja.includes(n)
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {nama}
              </button>
            ))}
          </div>
        </div>
        <button onClick={simpanJadwal} disabled={!siapSimpan || simpan} className="btn-primary w-full disabled:opacity-40">
          {simpan ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Jadwal
        </button>
      </div>
      <p className="rounded-3xl bg-indigo-50 p-4 text-xs leading-relaxed text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
        ⏰ <b>Cara kerja:</b> check-in setelah <b>Batas Terlambat</b> otomatis berstatus <b>Terlambat</b> (dihitung di server,
        tahan manipulasi jam HP). Countdown di Beranda, pengingat notifikasi, dan tulisan &quot;Batas:&quot; mengikuti jadwal ini.
        Format 24 jam HH:MM. <b>Jadwal Biasa</b> memakai satu jam kerja untuk semua; <b>Jadwal Shift</b> memakai dua giliran
        sehingga batas terlambat &amp; jam pulang otomatis mengikuti shift masing-masing karyawan (atur shift-nya di tab
        <b> Karyawan</b>). Pilihan <b>Hari Kerja</b> dipakai untuk menghitung hari kerja pada laporan &amp; gaji — pilih
        <b> Sen–Sab</b> bila perusahaan bekerja enam hari.
      </p>

      {/* Identitas perusahaan — dipakai KOP surat peringatan/pemecatan */}
      <IdentitasPerusahaan />

      {/* Hari libur: nasional/cuti bersama (prefill resmi) + khusus yang ditetapkan admin */}
      <KartuHariLibur />
    </div>
  )
}

// ---------- Identitas Perusahaan (tab Jadwal) ----------
// Nama & alamat perusahaan dipakai pada KOP surat peringatan/pemecatan yang
// diterbitkan sistem dan diunduh karyawan sebagai PDF.
function IdentitasPerusahaan() {
  const [form, setForm] = useState({ nama: '', alamat: '' })
  const [proses, setProses] = useState(false)
  const [pesan, setPesan] = useState(null)

  useEffect(() => {
    api.adminPerusahaan().then((p) => setForm({ nama: p?.nama || '', alamat: p?.alamat || '' })).catch(() => {})
  }, [])

  const simpan = async (e) => {
    e.preventDefault()
    setProses(true)
    try {
      const hasil = await api.adminUpdatePerusahaan(form.nama.trim(), form.alamat.trim())
      setForm({ nama: hasil?.nama || form.nama, alamat: hasil?.alamat || form.alamat })
      setPesan({ ok: true, teks: 'Identitas perusahaan tersimpan — dipakai pada KOP surat resmi.' })
    } catch (err) {
      setPesan({ ok: false, teks: err.message })
    } finally {
      setProses(false)
    }
  }

  const siap = form.nama.trim().length >= 2
  return (
    <form onSubmit={simpan} className="card space-y-3">
      <BannerPesan pesan={pesan} />
      <div>
        <h2 className="judul-seksi">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <Building2 size={14} />
          </span>
          Identitas Perusahaan
        </h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
          Tercetak pada KOP surat peringatan/pemecatan yang diterbitkan & diunduh karyawan.
        </p>
      </div>
      <div>
        <label className="label">Nama Perusahaan</label>
        <input
          className="input !px-3"
          placeholder="PT Nubsen Indonesia"
          value={form.nama}
          maxLength={80}
          onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
          required
        />
      </div>
      <div>
        <label className="label">Alamat Perusahaan</label>
        <input
          className="input !px-3"
          placeholder="Kelapa Gading, Jakarta Utara"
          value={form.alamat}
          maxLength={140}
          onChange={(e) => setForm((f) => ({ ...f, alamat: e.target.value }))}
        />
      </div>
      <button type="submit" disabled={!siap || proses} className="btn-primary w-full disabled:opacity-40">
        {proses ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Identitas
      </button>
    </form>
  )
}

// ---------- Kartu Hari Libur (tab Jadwal) ----------
// Hari terdaftar: tidak Alpha otomatis, tidak dihitung hari kerja pada Laporan &
// Gaji, dan absensi di hari itu masuk kategori "Hadir Libur". Perubahan mengirim
// notifikasi broadcast ke semua karyawan.
function KartuHariLibur() {
  const tahun = new Date().getFullYear()
  const [daftar, setDaftar] = useState(null)
  const [form, setForm] = useState({ tanggal: '', nama: '' })
  const [proses, setProses] = useState(false)
  const [pesan, setPesan] = useState(null)

  const muat = () => api.adminLibur({ tahun }).then(setDaftar).catch(() => {})
  useEffect(() => {
    muat()
  }, [])

  const tambah = async (e) => {
    e.preventDefault()
    setProses(true)
    try {
      await api.adminTambahLibur(form.tanggal, form.nama.trim())
      setForm({ tanggal: '', nama: '' })
      setPesan({ ok: true, teks: 'Hari libur ditetapkan — semua karyawan menerima notifikasi.' })
      muat()
    } catch (err) {
      setPesan({ ok: false, teks: err.message })
    } finally {
      setProses(false)
    }
  }

  const hapus = async (l) => {
    if (!confirm(`Batalkan libur ${l.tanggal} — ${l.nama}?`)) return
    try {
      await api.adminHapusLibur(l.tanggal)
      setPesan({ ok: true, teks: 'Hari libur dibatalkan — notifikasi dikirim ke karyawan.' })
      muat()
    } catch (err) {
      setPesan({ ok: false, teks: err.message })
    }
  }

  const siap = /^\d{4}-\d{2}-\d{2}$/.test(form.tanggal) && form.nama.trim().length >= 3

  return (
    <div className="card space-y-3">
      <BannerPesan pesan={pesan} />
      <div>
        <h2 className="judul-seksi">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <CalendarRange size={14} />
          </span>
          Hari Libur
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Hari terdaftar tidak menjadikan karyawan Alpha dan tidak dihitung pada Laporan/Gaji. Daftar {tahun}–{tahun + 1}.
        </p>
      </div>
      <form onSubmit={tambah} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
        <input
          type="date"
          className="input !px-3"
          value={form.tanggal}
          onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
          required
        />
        <input
          className="input !px-3"
          placeholder="Nama libur (mis. Anniversary NUBSEN)"
          value={form.nama}
          maxLength={80}
          onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
          required
        />
        <button type="submit" disabled={!siap || proses} className="btn-primary !px-3 !py-2 text-xs disabled:opacity-40">
          {proses ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Tambah
        </button>
      </form>
      {daftar === null ? (
        <p className="text-xs text-slate-400">Memuat…</p>
      ) : daftar.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 px-3 py-2.5 text-xs text-slate-400 dark:bg-slate-800/60">
          Belum ada hari libur pada {tahun}–{tahun + 1}.
        </p>
      ) : (
        <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {daftar.map((l) => (
            <li key={l.tanggal} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
              <span className="shrink-0 font-mono font-semibold text-slate-500 dark:text-slate-300">{formatTanggalPendek(l.tanggal)}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{l.nama}</span>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                  l.sumber === 'resmi'
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
                    : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'
                }`}
              >
                {l.sumber === 'resmi' ? 'Resmi' : 'Khusus'}
              </span>
              <button
                onClick={() => hapus(l)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-500 transition active:scale-90 dark:bg-rose-500/15"
                aria-label={`Hapus libur ${l.tanggal}`}
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- Tab Peringatan: surat peringatan (SP1–SP3) & pemecatan ----------
// Surat diterbitkan admin → notifikasi otomatis ke karyawan → tampil di kartu
// "Surat Peringatan & Pemecatan" pada menu Profil karyawan terkait.
const JENIS_SURAT = [
  ['SP1', 'SP1', 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'],
  ['SP2', 'SP2', 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300'],
  ['SP3', 'SP3', 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'],
  ['Pemecatan', 'Pemecatan', 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'],
]
const LABEL_SURAT = { SP1: 'Surat Peringatan 1', SP2: 'Surat Peringatan 2', SP3: 'Surat Peringatan 3', Pemecatan: 'Surat Pemecatan' }
const kelasSurat = (jenis) => (JENIS_SURAT.find(([j]) => j === jenis) || JENIS_SURAT[0])[2]

function KelolaPeringatan() {
  const [karyawan, setKaryawan] = useState([])
  const [data, setData] = useState(null)
  const [form, setForm] = useState({ employeeId: '', jenis: 'SP1', tanggal: toISODate(), alasan: '' })
  const [proses, setProses] = useState(false)
  const [pesan, setPesan] = useState(null)

  const muat = () => api.adminPeringatan().then(setData).catch(() => {})
  useEffect(() => {
    muat()
    api.adminKaryawan().then(setKaryawan).catch(() => {})
  }, [])

  const terbitkan = async (e) => {
    e.preventDefault()
    setProses(true)
    try {
      await api.adminBuatPeringatan({ ...form, employeeId: Number(form.employeeId), alasan: form.alasan.trim() })
      setForm((f) => ({ ...f, alasan: '' }))
      setPesan({ ok: true, teks: `${LABEL_SURAT[form.jenis]} diterbitkan — notifikasi terkirim & tampil di Profil karyawan.` })
      muat()
    } catch (err) {
      setPesan({ ok: false, teks: err.message })
    } finally {
      setProses(false)
    }
  }

  const hapus = async (s) => {
    if (!confirm(`Cabut/hapus ${LABEL_SURAT[s.jenis] || s.jenis} (${formatTanggalPendek(s.tanggal)}) atas nama ${s.nama}?`)) return
    try {
      await api.adminHapusPeringatan(s.id)
      setPesan({ ok: true, teks: 'Surat dicabut — karyawan menerima notifikasi pencabutan.' })
      muat()
    } catch (err) {
      setPesan({ ok: false, teks: err.message })
    }
  }

  const hitung = (jenis) => (data || []).filter((s) => s.jenis === jenis).length
  const siap = form.employeeId && form.tanggal && form.alasan.trim().length >= 3

  return (
    <div className="animate-fade-in space-y-4">
      <BannerPesan pesan={pesan} />

      {/* Form terbitkan surat */}
      <form onSubmit={terbitkan} className="card space-y-3">
        <div>
          <h2 className="judul-seksi">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-500/15">
              <FileWarning size={14} />
            </span>
            Terbitkan Surat
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
            SP1 → SP2 → SP3 bertahap; <b>Pemecatan</b> untuk pelanggaran berat. Surat otomatis masuk ke Profil karyawan.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.6fr_1fr]">
          <div>
            <label className="label">Karyawan</label>
            <select className="input !px-3" value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} required>
              <option value="">Pilih karyawan…</option>
              {karyawan.map((k) => (
                <option key={k.id} value={k.id}>{k.nama} — {k.departemen || '-'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tanggal Surat</label>
            <input type="date" className="input !px-3" value={form.tanggal} onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))} required />
          </div>
        </div>
        <div>
          <label className="label">Jenis Surat</label>
          <div className="grid grid-cols-4 gap-1.5">
            {JENIS_SURAT.map(([j, label]) => (
              <button
                key={j}
                type="button"
                onClick={() => setForm((f) => ({ ...f, jenis: j }))}
                aria-pressed={form.jenis === j}
                className={`rounded-xl px-1 py-2.5 text-[11px] font-bold transition active:scale-95 ${
                  form.jenis === j
                    ? `${kelasSurat(j)} ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-slate-950`
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label !mb-0">Alasan / Dasar Surat *</label>
            <span className="text-[10px] font-semibold text-slate-400">{form.alasan.trim().length}/300</span>
          </div>
          <textarea
            className="input mt-1 min-h-20 resize-none text-sm"
            maxLength={300}
            placeholder="Contoh: Terlambat 3 kali dalam sebulan tanpa keterangan."
            value={form.alasan}
            onChange={(e) => setForm((f) => ({ ...f, alasan: e.target.value }))}
            required
          />
        </div>
        <button type="submit" disabled={!siap || proses} className="btn-primary w-full disabled:opacity-40">
          {proses ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {proses ? 'Menerbitkan…' : `Terbitkan ${LABEL_SURAT[form.jenis]}`}
        </button>
      </form>

      {/* Ringkasan jumlah per jenis */}
      <div className="grid grid-cols-4 gap-2">
        {JENIS_SURAT.map(([j, label]) => (
          <div key={j} className="card !p-3 text-center">
            <p className={`text-lg font-extrabold leading-none ${j === 'Pemecatan' ? 'text-rose-600 dark:text-rose-400' : ''}`}>{hitung(j)}</p>
            <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Daftar surat terbitan (terbaru dulu) */}
      {data === null ? (
        <p className="text-xs text-slate-400">Memuat…</p>
      ) : data.length === 0 ? (
        <p className="card py-8 text-center text-xs text-slate-400">Belum ada surat peringatan atau pemecatan.</p>
      ) : (
        <div className="space-y-3 pb-2">
          {data.map((s) => (
            <div key={s.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${kelasSurat(s.jenis)}`}>
                      {LABEL_SURAT[s.jenis] || s.jenis}
                    </span>
                    <p className="truncate text-sm font-bold">{s.nama}</p>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">{s.nomor || '—'}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {formatTanggalPendek(s.tanggal)}
                  </p>
                  {s.alasan && <p className="mt-1 text-xs leading-relaxed text-slate-400">💬 {s.alasan}</p>}
                </div>
                <button
                  onClick={() => hapus(s)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-500 transition active:scale-90 dark:bg-rose-500/15"
                  aria-label="Cabut surat"
                  title="Cabut / hapus surat"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Ringkasan() {
  const [d, setD] = useState(null)
  const [tren, setTren] = useState(null)
  useEffect(() => {
    api.adminRingkasan().then(setD).catch(() => {})
    api.adminTren().then(setTren).catch(() => {})
  }, [])
  // Petak statistik: ikon Lucide + warna aksen (bukan emoji) agar tampil seragam.
  const kartu = [
    { Icon: Users, angka: d?.totalKaryawan, label: 'Total Karyawan', teks: 'text-indigo-600 dark:text-indigo-300', latar: 'bg-indigo-50 dark:bg-indigo-500/15' },
    { Icon: CalendarCheck2, angka: d?.hadirHariIni, label: 'Hadir Hari Ini', teks: 'text-emerald-600 dark:text-emerald-300', latar: 'bg-emerald-50 dark:bg-emerald-500/15' },
    { Icon: FileText, angka: d?.izinMenunggu, label: 'Izin Menunggu', teks: 'text-amber-600 dark:text-amber-300', latar: 'bg-amber-50 dark:bg-amber-500/15' },
    { Icon: Timer, angka: d?.lemburMenunggu, label: 'Lembur Menunggu', teks: 'text-violet-600 dark:text-violet-300', latar: 'bg-violet-50 dark:bg-violet-500/15' },
  ]
  // Grafik tren 7 hari ditangani komponen GrafikTren (skala jumlah karyawan).
  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kartu.map(({ Icon, angka, label, teks, latar }, i) => (
          <div
            key={label}
            style={{ animationDelay: `${i * 60}ms` }}
            className={`stat-tile animate-rise ${teks}`}
          >
            <span className={`relative z-10 grid h-10 w-10 place-items-center rounded-2xl ${latar}`}>
              <Icon size={19} />
            </span>
            <p className="relative z-10 mt-2.5 text-2xl font-black leading-none tabular-nums text-slate-800 dark:text-white sm:text-3xl">
              {angka ?? '—'}
            </p>
            <p className="relative z-10 mt-1 text-[11px] font-bold leading-tight text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Tren kehadiran 7 hari — grafik berskala jumlah karyawan (komponen GrafikTren) */}
      <GrafikTren tren={tren} />

      <div className="mt-4 flex items-start gap-2.5 rounded-[1.5rem] border border-indigo-100 bg-white/85 p-4 text-xs leading-relaxed text-slate-600 shadow-card backdrop-blur-xl dark:border-indigo-500/20 dark:bg-slate-900/70 dark:text-slate-300">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-white shadow-md">
          <ShieldCheck size={15} />
        </span>
        <span>
          <b className="text-slate-800 dark:text-white">Panduan cepat:</b> tab <b>Karyawan</b> untuk tambah/edit/hapus akun
          (termasuk reset PIN), <b>Absensi</b> untuk koreksi manual, <b>Izin</b> &amp; <b>Lembur</b> untuk persetujuan,
          <b> Peringatan</b> untuk surat SP/pemecatan, dan <b>Notifikasi</b> untuk mengirim pengumuman ke semua karyawan.
        </span>
      </div>
    </div>
  )
}
function KelolaKaryawan() {
  const kosong = {
    nama: '', nip: '', jabatan: '', departemen: '', email: '', telepon: '', lokasiKerja: '', cutiTahunan: 12,
    gajiHarian: 0, uangMakan: 0, tarifLembur: 0, pin: '', isAdmin: false,
    // Status kepegawaian — dipilih admin (Karyawan Tetap / Karyawan Kontrak).
    statusKaryawan: 'Karyawan Tetap',
    // Shift kerja ('' | '1' | '2') — dipakai saat jadwal mode 'shift'.
    shift: '',
  }
  const [data, setData] = useState([])
  const [cari, setCari] = useState('')
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
      email: k.email, telepon: k.telepon || '', lokasiKerja: k.lokasiKerja || '', cutiTahunan: k.cutiTahunan,
      gajiHarian: k.gajiHarian ?? 0, uangMakan: k.uangMakan ?? 0, tarifLembur: k.tarifLembur ?? 0, pin: '', isAdmin: k.isAdmin,
      statusKaryawan: k.statusKaryawan || 'Karyawan Tetap',
      shift: k.shift ? String(k.shift) : '',
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
          <h2 className="judul-seksi">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              {editId ? <Pencil size={14} /> : <Plus size={14} />}
            </span>
            {editId ? 'Ubah Data Karyawan' : 'Tambah Karyawan Baru'}
          </h2>
          {/* Satu kolom di ponsel sempit, dua kolom mulai sm — label panjang tidak
              lagi memaksa input menjadi sempit/berdesakan. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="label">Nama *</label><input className="input" value={form.nama} onChange={(e) => set('nama', e.target.value)} required /></div>
            <div><label className="label">NIP</label><input className="input" value={form.nip} onChange={(e) => set('nip', e.target.value)} /></div>
            <div><label className="label">Jabatan</label><input className="input" value={form.jabatan} onChange={(e) => set('jabatan', e.target.value)} /></div>
            <div><label className="label">Departemen</label><input className="input" value={form.departemen} onChange={(e) => set('departemen', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label">Lokasi Kerja</label><input className="input" value={form.lokasiKerja} onChange={(e) => set('lokasiKerja', e.target.value)} placeholder="cth. Kantor Pusat — Kelapa Gading, Jakarta Utara" /></div>
            <div className="sm:col-span-2"><label className="label">Email *</label><input type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} required /></div>
            <div><label className="label">Telepon</label><input className="input" value={form.telepon} onChange={(e) => set('telepon', e.target.value)} /></div>
            <div>
              <label className="label">Status Karyawan</label>
              <select className="input !px-3" value={form.statusKaryawan} onChange={(e) => set('statusKaryawan', e.target.value)}>
                <option value="Karyawan Tetap">Karyawan Tetap</option>
                <option value="Karyawan Kontrak">Karyawan Kontrak</option>
              </select>
            </div>
            <div>
              <label className="label">Shift Kerja</label>
              <select className="input !px-3" value={form.shift} onChange={(e) => set('shift', e.target.value)}>
                <option value="">Tidak ditetapkan (Shift 1)</option>
                <option value="1">Shift 1</option>
                <option value="2">Shift 2</option>
              </select>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                Dipakai saat tab Jadwal memakai mode <b>Shift</b>.
              </p>
            </div>
            <div><label className="label">Cuti/Tahun</label><input type="number" min="0" className="input" value={form.cutiTahunan} onChange={(e) => set('cutiTahunan', Number(e.target.value))} /></div>
            <div><label className="label">Gaji Harian (Rp)</label><input type="number" min="0" className="input" value={form.gajiHarian} onChange={(e) => set('gajiHarian', Number(e.target.value))} placeholder="cth. 150000" /></div>
            <div><label className="label">Uang Makan/Hari (Rp)</label><input type="number" min="0" className="input" value={form.uangMakan} onChange={(e) => set('uangMakan', Number(e.target.value))} placeholder="cth. 20000" /></div>
            <div><label className="label">Tarif Lembur/jam (Rp)</label><input type="number" min="0" className="input" value={form.tarifLembur} onChange={(e) => set('tarifLembur', Number(e.target.value))} placeholder="cth. 25000" /></div>
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
        <>
          {/* Pencarian karyawan — filter nama/email/jabatan/departemen/NIP langsung di klien */}
          <div className="relative mb-2">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              className="input !py-2.5 !pl-10 text-sm"
              placeholder="Cari nama, email, jabatan…"
            />
          </div>
          <p className="mb-2 text-[11px] font-medium text-slate-400">
            {data.filter((k) => [k.nama, k.email, k.jabatan, k.departemen, k.nip, k.lokasiKerja].some((v) => (v || '').toLowerCase().includes(cari.trim().toLowerCase()))).length} dari {data.length} karyawan
          </p>
          <div className="space-y-3 pb-2">
            {data
              .filter((k) => [k.nama, k.email, k.jabatan, k.departemen, k.nip, k.lokasiKerja].some((v) => (v || '').toLowerCase().includes(cari.trim().toLowerCase())))
              .map((k) => (
            <div key={k.id} className="card flex items-start gap-3 p-4">
              {/* Avatar inisial — identitas cepat sebelum membaca detail */}
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-sm font-black text-white shadow-md shadow-indigo-500/25">
                {inisialDari(k.nama)}
              </span>
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold">
                    <span className="truncate">{k.nama}</span>
                    {k.isAdmin && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">ADMIN</span>}
                    {/* Status kepegawaian: hijau = tetap, kuning = kontrak */}
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        k.statusKaryawan === 'Karyawan Kontrak'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                      }`}
                    >
                      {k.statusKaryawan === 'Karyawan Kontrak' ? 'KONTRAK' : 'TETAP'}
                    </span>
                    {k.shift && (
                      <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                        SHIFT {k.shift}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{k.jabatan || '—'} • {k.departemen || '—'}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{k.email}</p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-400">
                    💰 {rupiah(k.gajiHarian)}/hari • makan {rupiah(k.uangMakan)} • lembur {rupiah(k.tarifLembur)}/jam
                  </p>
                  {k.lokasiKerja && (
                    <p className="mt-1 flex min-w-0 items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                      <span className="truncate">{k.lokasiKerja}</span>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => mulaiEdit(k)} className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600 transition active:scale-90 dark:bg-indigo-500/15 dark:text-indigo-400" aria-label="Edit"><Pencil size={14} /></button>
                  <button onClick={() => hapus(k)} className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-500 transition active:scale-90 dark:bg-rose-500/15" aria-label="Hapus"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
            ))}
          </div>
        </>
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
  // Foto selfie dibuka sesuai kebutuhan (daftar absensi tidak membawa base64).
  const [foto, setFoto] = useState(null)

  const bukaFoto = async (rec, jenis) => {
    const judul = `Foto selfie ${jenis === 'pulang' ? 'pulang' : 'masuk'} — ${rec.nama}`
    setFoto({ buka: true, judul, memuat: true, isi: null, galat: null })
    try {
      const d = await api.adminFotoAbsensi(rec.id, jenis)
      setFoto((s) => ({ ...s, isi: d.foto, memuat: false }))
    } catch (e) {
      setFoto((s) => ({ ...s, memuat: false, galat: e.message }))
    }
  }

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

      <div className="card mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1"><label className="label">Karyawan</label>
          <select className="input !px-3" value={filter.employeeId} onChange={(e) => setFilter((f) => ({ ...f, employeeId: e.target.value }))}>
            <option value="">Semua</option>
            {karyawan.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
          </select>
        </div>
        <div><label className="label">Dari</label><input type="date" className="input !px-3" value={filter.dari} onChange={(e) => setFilter((f) => ({ ...f, dari: e.target.value }))} /></div>
        <div><label className="label">Sampai</label><input type="date" className="input !px-3" value={filter.sampai} onChange={(e) => setFilter((f) => ({ ...f, sampai: e.target.value }))} /></div>
        <button onClick={() => muat()} className="btn-primary col-span-2 !py-2.5 sm:col-span-3">Terapkan Filter</button>
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <input type="time" className="input !px-3" value={edit.checkIn || ''} onChange={(e) => setEdit({ ...edit, checkIn: e.target.value })} />
                  <input type="time" className="input !px-3" value={edit.checkOut || ''} onChange={(e) => setEdit({ ...edit, checkOut: e.target.value })} />
                  <select className="input col-span-2 !px-3 sm:col-span-1" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
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
                    {a.adaSelfie && (
                      <button onClick={() => bukaFoto(a, 'masuk')} className="grid h-8 w-8 place-items-center rounded-xl bg-sky-50 text-sky-600 transition active:scale-90 dark:bg-sky-500/15 dark:text-sky-400" aria-label="Foto selfie masuk" title="Foto selfie masuk">
                        <Camera size={14} />
                      </button>
                    )}
                    {a.adaSelfiePulang && (
                      <button onClick={() => bukaFoto(a, 'pulang')} className="grid h-8 w-8 place-items-center rounded-xl bg-violet-50 text-violet-600 transition active:scale-90 dark:bg-violet-500/15 dark:text-violet-400" aria-label="Foto selfie pulang" title="Foto selfie pulang">
                        <Camera size={14} />
                      </button>
                    )}
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

      {/* Pratinjau foto selfie — diambil dari server saat tombol kamera ditekan */}
      <PratinjauLampiran
        {...(foto || {})}
        onClose={() => setFoto(null)}
        toast={(teks, tipe) => setPesan({ ok: tipe !== 'error', teks })}
      />
    </div>
  )
}
function KelolaIzin() {
  const [data, setData] = useState([])
  const [memuat, setMemuat] = useState(true)
  const [pesan, setPesan] = useState(null)
  // Pengajuan yang sedang akan ditolak (barisnya dipakai untuk ringkasan modal).
  const [tolak, setTolak] = useState(null)
  const [proses, setProses] = useState(false)
  // Pratinjau lampiran: isi berkas diambil dari server saat tombol ditekan.
  const [lampiran, setLampiran] = useState(null)

  const muat = () => api.adminIzin().then(setData).catch(() => {}).finally(() => setMemuat(false))
  useEffect(() => {
    muat()
  }, [])

  const bukaLampiran = async (l) => {
    setLampiran({ buka: true, judul: `Lampiran ${l.jenis} — ${l.nama}`, memuat: true, isi: null, galat: null })
    try {
      const d = await api.adminLampiranIzin(l.id)
      setLampiran((s) => ({ ...s, isi: d.lampiran, memuat: false }))
    } catch (e) {
      setLampiran((s) => ({ ...s, memuat: false, galat: e.message }))
    }
  }

  const aksi = async (id, status, alasanTolak = '') => {
    setProses(true)
    try {
      // Respons server berisi baris terbaru → cukup perbarui baris itu di daftar
      // (tanpa memuat ulang seluruh daftar, jadi tombol Setujui/Tolak terasa instan).
      const hasil = await api.adminStatusIzin(id, status, alasanTolak)
      setData((d) => d.map((x) => (x.id === id ? { ...x, ...(hasil || {}), lampiran: null } : x)))
      setPesan({ ok: true, teks: `Pengajuan ${status.toLowerCase()} — notifikasi dikirim ke karyawan.` })
      setTolak(null)
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
      muat()
    } finally {
      setProses(false)
    }
  }

  const hapus = async (id) => {
    if (!confirm('Hapus pengajuan ini?')) return
    try {
      await api.adminHapusIzin(id)
      setData((d) => d.filter((x) => x.id !== id)) // langsung hilang dari daftar
      setPesan({ ok: true, teks: 'Pengajuan dihapus.' })
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
    }
  }

  return (
    <div className="animate-fade-in">
      <BannerPesan pesan={pesan} />

      {/* Modal penolakan (komponen bersama, tampilan dirapikan) — alasan WAJIB,
          terkirim ke notifikasi karyawan dan tampil pada riwayat pengajuannya. */}
      <ModalTolak
        buka={!!tolak}
        jenis="izin"
        nama={tolak?.nama}
        detail={tolak ? `${tolak.jenis} • ${formatTanggalPendek(tolak.mulai)} – ${formatTanggalPendek(tolak.selesai)}${tolak.keterangan ? ` • ${tolak.keterangan}` : ''}` : ''}
        onTutup={() => setTolak(null)}
        onKirim={(teksAlasan) => aksi(tolak.id, 'Ditolak', teksAlasan)}
      />

      {/* Pratinjau lampiran — berkas diambil saat tombol ditekan (daftar tetap ringan) */}
      <PratinjauLampiran
        {...(lampiran || {})}
        onClose={() => setLampiran(null)}
        toast={(teks, tipe) => setPesan({ ok: tipe !== 'error', teks })}
      />

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
                  {l.status === 'Ditolak' && l.alasanTolak && (
                    <p className="mt-1 rounded-xl bg-rose-50 px-2.5 py-1 text-[11px] font-semibold leading-relaxed text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">💬 {l.alasanTolak}</p>
                  )}
                  {l.adaLampiran ? (
                    <button
                      onClick={() => bukaLampiran(l)}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-600 transition active:scale-95 dark:bg-indigo-500/15 dark:text-indigo-300"
                    >
                      <Paperclip size={11} /> Lihat lampiran
                    </button>
                  ) : (
                    <span className="mt-1.5 inline-block text-[10px] text-slate-300 dark:text-slate-600">Tanpa lampiran</span>
                  )}
                </div>
                <Chip status={l.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {l.status !== 'Disetujui' && (
                  <button onClick={() => aksi(l.id, 'Disetujui')} className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition active:scale-95">✓ Setujui</button>
                )}
                {l.status !== 'Ditolak' && (
                  <button onClick={() => setTolak(l)} className="flex-1 rounded-xl bg-rose-500 px-3 py-2 text-xs font-bold text-white transition active:scale-95">✕ Tolak</button>
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
  // Pengajuan lembur yang sedang akan ditolak (barisnya untuk ringkasan modal).
  const [tolak, setTolak] = useState(null)
  const [proses, setProses] = useState(false)

  const muat = () => api.adminLembur().then(setData).catch(() => {}).finally(() => setMemuat(false))
  useEffect(() => {
    muat()
  }, [])

  const aksi = async (id, status, alasanTolak = '') => {
    setProses(true)
    try {
      // Baris terbaru dari server langsung menggantikan baris lama di daftar —
      // tidak ada pemuatan ulang seluruh daftar (respons lebih cepat).
      const hasil = await api.adminStatusLembur(id, status, alasanTolak)
      setData((d) => d.map((x) => (x.id === id ? { ...x, ...(hasil || {}) } : x)))
      setPesan({ ok: true, teks: `Lembur ${status.toLowerCase()} — notifikasi dikirim ke karyawan.` })
      setTolak(null)
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
      muat()
    } finally {
      setProses(false)
    }
  }

  const hapus = async (id) => {
    if (!confirm('Hapus pengajuan lembur ini?')) return
    try {
      await api.adminHapusLembur(id)
      setData((d) => d.filter((x) => x.id !== id)) // langsung hilang dari daftar
      setPesan({ ok: true, teks: 'Pengajuan dihapus.' })
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
    }
  }

  return (
    <div className="animate-fade-in">
      <BannerPesan pesan={pesan} />

      {/* Modal penolakan (komponen bersama) — alasan WAJIB, terkirim ke notifikasi
          karyawan dan tampil pada riwayat pengajuan lemburnya. */}
      <ModalTolak
        buka={!!tolak}
        jenis="lembur"
        nama={tolak?.nama}
        detail={tolak ? `Lembur ${formatTanggalPendek(tolak.tanggal)} • pukul ${tolak.jamMulai}–${tolak.jamSelesai}${tolak.keterangan ? ` • ${tolak.keterangan}` : ''}` : ''}
        onTutup={() => setTolak(null)}
        onKirim={(teksAlasan) => aksi(tolak.id, 'Ditolak', teksAlasan)}
      />

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
                  {o.status === 'Ditolak' && o.alasanTolak && (
                    <p className="mt-1 rounded-xl bg-rose-50 px-2.5 py-1 text-[11px] font-semibold leading-relaxed text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">💬 {o.alasanTolak}</p>
                  )}
                </div>
                <Chip status={o.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {o.status !== 'Disetujui' && (
                  <button onClick={() => aksi(o.id, 'Disetujui')} className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition active:scale-95">✓ Setujui</button>
                )}
                {o.status !== 'Ditolak' && (
                  <button onClick={() => setTolak(o)} className="flex-1 rounded-xl bg-rose-500 px-3 py-2 text-xs font-bold text-white transition active:scale-95">✕ Tolak</button>
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
          Buat <b>pengumuman</b> di sini. Pilih <b>Semua Karyawan</b> agar kabar perusahaan muncul di
          menu <b>📢 Pengumuman</b> setiap karyawan, lengkap dengan status baca per orang (mereka
          bisa menandai sendiri sudah dibaca). Memilih <b>satu karyawan</b> = pesan pribadi yang
          tampil di menu <b>🔔 Notifikasi</b>-nya.
        </span>
      </div>

      {edit && (
        <form onSubmit={simpanEdit} className="card mb-4 space-y-3 ring-2 ring-indigo-300 dark:ring-indigo-500/40">
          <h2 className="judul-seksi">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              <Pencil size={14} />
            </span>
            Edit Pengumuman
            <span className="ml-auto rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              {edit.total} penerima
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Jenis</label>
              <select className="input" value={edit.jenis} onChange={(e) => setEdit((s) => ({ ...s, jenis: e.target.value }))}>
                {OPSI_PENGUMUMAN.map(([j, label]) => (
                  <option key={j} value={j}>{label}</option>
                ))}
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
          <h2 className="judul-seksi">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
              <Megaphone size={14} />
            </span>
            Buat Pengumuman
          </h2>
          <div>
            <label className="label">Penerima</label>
            <select
              className="input"
              value={form.employeeId}
              onChange={(e) => {
                const v = e.target.value
                // Ganti penerima bisa membuat jenis lama tak sah (mis. 'gaji'
                // untuk Semua Karyawan) → balikkan ke default kategori itu.
                setForm((f) => {
                  const opsi = v ? [...OPSI_PENGUMUMAN, ...OPSI_PERSONAL] : OPSI_PENGUMUMAN
                  const tetap = opsi.some(([j]) => j === f.jenis)
                  return { ...f, employeeId: v, jenis: tetap ? f.jenis : (v ? 'info' : 'pengumuman') }
                })
              }}
            >
              <option value="">📢 SEMUA KARYAWAN (pemberitahuan)</option>
              {karyawan.map((k) => <option key={k.id} value={k.id}>👤 {k.nama}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="label">Jenis</label>
              <select className="input" value={form.jenis} onChange={(e) => set('jenis', e.target.value)}>
                {(form.employeeId ? [...OPSI_PENGUMUMAN, ...OPSI_PERSONAL] : OPSI_PENGUMUMAN).map(([j, label]) => (
                  <option key={j} value={j}>{label}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                {form.employeeId
                  ? 'Pesan pribadi → muncul di menu 🔔 Notifikasi karyawan itu.'
                  : 'Kabar perusahaan → muncul di menu 📢 Pengumuman semua karyawan.'}
              </p>
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






// Tab Gaji — penghitung gaji per karyawan & per hari: gaji harian + uang makan
// (HANYA hari masuk tepat waktu — Terlambat tidak dapat uang makan) + lembur
// Disetujui. Tarif tiap karyawan diedit langsung di tabel (tersimpan ke database)
// dan semua hitungan dihitung ulang seketika. Admin juga menetapkan PERIODE
// PENGGAJIAN di sini — periode aktif itulah yang muncul sebagai slip gaji di
// aplikasi karyawan (menu Profil → Slip Gaji).
const rupiah = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString('id-ID')}`

// Hitung ulang satu baris gaji dari angka kehadiran + tarif saat ini.
// Aturan uang makan: hanya hari masuk TEPAT WAKTU (Hadir + Hadir Libur) yang
// dapat uang makan — hari Terlambat tetap dibayar gaji harian tanpa uang makan.
function hitungBarisGaji(r) {
  const hariDibayar = r.hadir + r.terlambat + r.hadirLibur + r.izin + r.sakit + r.cuti
  const hariMakan = r.hadir + r.hadirLibur
  const tanpaUangMakan = r.terlambat
  const subGaji = Math.round(hariDibayar * (Number(r.gajiHarian) || 0))
  const subMakan = Math.round(hariMakan * (Number(r.uangMakan) || 0))
  const subLembur = Math.round((r.lembur || 0) * (Number(r.tarifLembur) || 0))
  return {
    ...r, hariDibayar, hariMakan, tanpaUangMakan,
    potonganUangMakan: Math.round(tanpaUangMakan * (Number(r.uangMakan) || 0)),
    subGaji, subMakan, subLembur, total: subGaji + subMakan + subLembur,
  }
}

function Gaji() {
  const hariIniISO = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const [dari, setDari] = useState(`${hariIniISO().slice(0, 7)}-01`) // default: awal bulan berjalan
  const [sampai, setSampai] = useState(hariIniISO)
  const [dept, setDept] = useState('')
  const [daftarDept, setDaftarDept] = useState([])
  const [data, setData] = useState(null)
  const [memuat, setMemuat] = useState(true)
  const [pesan, setPesan] = useState(null)
  const [ekspor, setEkspor] = useState(false)
  // Periode penggajian (dipakai slip gaji di aplikasi karyawan).
  const [periode, setPeriode] = useState([])
  const [namaPeriode, setNamaPeriode] = useState('')
  const [prosesPeriode, setProsesPeriode] = useState(false)

  const muat = () => {
    setMemuat(true)
    setPesan(null)
    api.adminGaji({ dari, sampai, departemen: dept || undefined })
      .then((d) => setData({ ...d, baris: (d.baris || []).map(hitungBarisGaji) }))
      .catch((e) => setPesan({ ok: false, teks: e.message }))
      .finally(() => setMemuat(false))
  }

  useEffect(() => {
    api.adminKaryawan()
      .then((list) => setDaftarDept([...new Set(list.map((k) => k.departemen || '-'))].filter(Boolean).sort()))
      .catch(() => {})
    api.adminPeriodeGaji().then(setPeriode).catch(() => {})
    muat()
  }, [])

  const adaData = !!data?.baris?.length
  const totalKeseluruhan = data ? data.baris.reduce((t, r) => t + r.total, 0) : 0
  const periodeAktif = periode.find((p) => p.aktif) || null

  // ---------- Periode penggajian ----------
  // Menetapkan/mengaktifkan periode langsung mengirim notifikasi ke semua
  // karyawan bahwa slip gajinya sudah bisa dibuka di menu Profil.
  const tetapkanPeriode = async () => {
    setProsesPeriode(true)
    try {
      const p = await api.adminTetapkanPeriodeGaji({ nama: namaPeriode.trim() || undefined, dari, sampai })
      setNamaPeriode('')
      setPeriode(await api.adminPeriodeGaji())
      setPesan({ ok: true, teks: `Periode "${p.nama}" ditetapkan & aktif — slip gaji karyawan diperbarui (notifikasi terkirim).` })
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
    } finally {
      setProsesPeriode(false)
    }
  }
  const aktifkanPeriode = async (id) => {
    setProsesPeriode(true)
    try {
      const p = await api.adminAktifkanPeriodeGaji(id)
      setPeriode(await api.adminPeriodeGaji())
      setPesan({ ok: true, teks: `Periode "${p.nama}" kini aktif di slip gaji karyawan.` })
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
    } finally {
      setProsesPeriode(false)
    }
  }
  const hapusPeriode = async (p) => {
    if (!confirm(`Hapus periode "${p.nama}"? Slip gaji karyawan pada periode ini tidak lagi bisa dipilih.`)) return
    setProsesPeriode(true)
    try {
      await api.adminHapusPeriodeGaji(p.id)
      setPeriode(await api.adminPeriodeGaji())
      setPesan({ ok: true, teks: `Periode "${p.nama}" dihapus.` })
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
    } finally {
      setProsesPeriode(false)
    }
  }

  // Edit tarif di tabel: perubahan dihitung ulang seketika (onChange); tersimpan
  // ke server saat kolom ditinggalkan (onBlur). Bila gagal, daftar dimuat ulang.
  const ubahTarifLokal = (id, kolom, nilai) => {
    setData((d) => (d ? { ...d, baris: d.baris.map((r) => (r.id === id ? hitungBarisGaji({ ...r, [kolom]: nilai }) : r)) } : d))
  }
  const simpanTarif = async (id, kolom, nilai) => {
    try {
      await api.adminUbahKaryawan(id, { [kolom]: Math.max(0, Number(nilai) || 0) })
      setPesan({ ok: true, teks: 'Tarif disimpan — hitungan gaji diperbarui.' })
    } catch (e) {
      setPesan({ ok: false, teks: e.message })
      muat()
    }
  }

  const eksporExcelGaji = async () => {
    if (!adaData) return
    setEkspor(true)
    try {
      const { ExcelJS } = await muatPustakaEkspor()
      const wb = await buatWorkbookGaji(data, ExcelJS)
      const array = await wb.xlsx.writeBuffer()
      const hasil = await unduhBerkas({
        nama: `laporan-gaji-${data.dari}_sd_${data.sampai}.xlsx`,
        isi: new Blob([array], { type: MIME.xlsx }),
        mime: MIME.xlsx,
        judul: 'Penghitung Gaji NUBSEN',
      })
      const jumlahSheet = new Set(data.baris.map((r) => r.departemen)).size + 1
      setPesan({ ok: true, teks: pesanHasilUnduh(hasil, `Excel (${jumlahSheet} sheet)`) })
    } catch (e) {
      setPesan({ ok: false, teks: `Gagal membuat Excel: ${e.message}` })
    } finally {
      setEkspor(false)
    }
  }

  const kolomTarif = [
    ['gajiHarian', 'Gaji/hari'],
    ['uangMakan', 'Makan/hari'],
    ['tarifLembur', 'Lembur/jam'],
  ]

  return (
    <div className="animate-fade-in">
      <BannerPesan pesan={pesan} />

      <div className="card mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div><label className="label">Dari</label><input type="date" className="input !px-3" value={dari} onChange={(e) => setDari(e.target.value)} /></div>
        <div><label className="label">Sampai</label><input type="date" className="input !px-3" value={sampai} onChange={(e) => setSampai(e.target.value)} /></div>
        <div><label className="label">Departemen</label>
          <select className="input !px-3" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">Semua</option>
            {daftarDept.map((d) => <option key={d} value={d === '-' ? '' : d}>{d}</option>)}
          </select>
        </div>
        <button onClick={muat} disabled={memuat} className="btn-primary col-span-2 !py-2.5 sm:col-span-1">
          {memuat ? <Loader2 size={16} className="animate-spin" /> : <Filter size={16} />} Tampilkan
        </button>
      </div>

      {/* Periode penggajian — admin menetapkan periode; slip gaji karyawan (menu
          Profil) menampilkan periode yang AKTIF beserta rinciannya. */}
      <div className="card mb-4">
        <h2 className="judul-seksi mb-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <CalendarRange size={14} />
          </span>
          Periode Penggajian
        </h2>
        <p className="mb-3 rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {periodeAktif ? (
            <>
              Aktif sekarang: <b>{periodeAktif.nama}</b> ({formatTanggalPendek(periodeAktif.dari)} – {formatTanggalPendek(periodeAktif.sampai)}) —
              slip gaji karyawan memakai periode ini.
            </>
          ) : (
            <>Belum ada periode aktif — slip gaji karyawan masih kosong. Tetapkan periode di bawah.</>
          )}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">Nama Periode (opsional)</label>
            <input
              className="input !py-2.5 text-sm"
              value={namaPeriode}
              onChange={(e) => setNamaPeriode(e.target.value)}
              placeholder="otomatis, mis. Gaji September 2026"
            />
          </div>
          <button onClick={tetapkanPeriode} disabled={prosesPeriode} className="btn-primary self-end !py-2.5 sm:self-end">
            {prosesPeriode ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Tetapkan {formatTanggalPendek(dari)}–{formatTanggalPendek(sampai)}
          </button>
        </div>
        {periode.length > 0 && (
          <ul className="mt-3 space-y-2">
            {periode.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                    {p.nama}
                    {p.aktif && <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">AKTIF</span>}
                  </p>
                  <p className="text-[10px] text-slate-400">{formatTanggalPendek(p.dari)} – {formatTanggalPendek(p.sampai)}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {!p.aktif && (
                    <button onClick={() => aktifkanPeriode(p.id)} disabled={prosesPeriode} className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600 transition active:scale-90 disabled:opacity-40 dark:bg-emerald-500/15 dark:text-emerald-400" aria-label="Aktifkan periode">
                      <Check size={14} />
                    </button>
                  )}
                  <button onClick={() => hapusPeriode(p)} disabled={prosesPeriode} className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-500 transition active:scale-90 disabled:opacity-40 dark:bg-rose-500/15" aria-label="Hapus periode">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* KPI ringkasan gaji periode terpilih */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['💰', data?.ringkasan?.subGaji, 'Gaji'],
          ['🍱', data?.ringkasan?.subMakan, 'Uang Makan'],
          ['⏱️', data?.ringkasan?.subLembur, 'Lembur'],
          ['🧾', data?.ringkasan?.total, 'TOTAL GAJI'],
        ].map(([emoji, angka, label]) => (
          <div key={label} className="card text-center">
            <p className="text-xl">{emoji}</p>
            <p className="mt-1 text-sm font-extrabold">{angka != null ? rupiah(angka) : '—'}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {(data?.ringkasan?.tanpaUangMakan ?? 0) > 0 && (
        <p className="mb-4 rounded-3xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          ⚠️ <b>{data.ringkasan.tanpaUangMakan} hari Terlambat</b> tidak mendapat uang makan — potongan uang makan
          periode ini <b>{rupiah(data.ringkasan.potonganUangMakan)}</b> (gaji hariannya tetap dibayar).
        </p>
      )}

      {memuat && !adaData ? (
        <p className="card flex items-center justify-center gap-2 py-8 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Memuat penghitung gaji…</p>
      ) : !adaData ? (
        <p className="card py-8 text-center text-xs text-slate-400">
          Belum ada data pada filter ini — ubah periode/departemen lalu tekan Tampilkan.
        </p>
      ) : (
        <>
          <div className="card tabel-geser !p-0">
            <table className="tabel-modern min-w-[960px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:border-slate-800">
                  <th className="px-3 py-2.5">Karyawan</th>
                  <th className="px-2 py-2.5 text-center">Hari Dibayar</th>
                  <th className="px-2 py-2.5 text-center">Hari Makan</th>
                  <th className="px-2 py-2.5 text-center" title="Hari Terlambat — gaji harian tetap dibayar, tetapi uang makan tidak diberikan">Telat ⚠️</th>
                  <th className="px-2 py-2.5 text-center">Lembur</th>
                  <th className="px-2 py-2.5 text-center">Gaji/hari</th>
                  <th className="px-2 py-2.5 text-center">Makan/hari</th>
                  <th className="px-2 py-2.5 text-center">Lembur/jam</th>
                  <th className="px-2 py-2.5 text-right">Gaji</th>
                  <th className="px-2 py-2.5 text-right">Uang Makan</th>
                  <th className="px-2 py-2.5 text-right">Lembur</th>
                  <th className="px-3 py-2.5 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {data.baris.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                    <td className="px-3 py-2.5">
                      <p className="font-bold text-slate-700 dark:text-slate-200">{r.nama}</p>
                      <p className="text-[10px] text-slate-400">{r.departemen}</p>
                    </td>
                    <td className="px-2 py-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">{r.hariDibayar}</td>
                    <td className="px-2 py-2.5 text-center text-teal-600 dark:text-teal-400">{r.hariMakan}</td>
                    <td className="px-2 py-2.5 text-center font-semibold text-amber-600 dark:text-amber-400" title={`${r.terlambat} hari terlambat — uang makan hangus ${rupiah(r.potonganUangMakan)}`}>
                      {r.terlambat}
                    </td>
                    <td className="px-2 py-2.5 text-center text-slate-500 dark:text-slate-400">{r.lembur}j</td>
                    {kolomTarif.map(([kolom, label]) => (
                      <td key={kolom} className="px-2 py-2.5 text-center">
                        <input
                          type="number" min="0" inputMode="numeric"
                          aria-label={`${label} — ${r.nama}`}
                          value={r[kolom]}
                          onChange={(e) => ubahTarifLokal(r.id, kolom, e.target.value)}
                          onBlur={(e) => simpanTarif(r.id, kolom, e.target.value)}
                          className="w-20 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-center text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">{rupiah(r.subGaji)}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">{rupiah(r.subMakan)}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">{rupiah(r.subLembur)}</td>
                    <td className="px-3 py-2.5 text-right font-extrabold text-indigo-600 dark:text-indigo-300">{rupiah(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-indigo-100 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                  <td className="px-3 py-2.5 font-bold text-slate-700 dark:text-slate-200">TOTAL</td>
                  <td className="px-2 py-2.5 text-center font-bold">{data.ringkasan.hariDibayar}</td>
                  <td className="px-2 py-2.5 text-center font-bold">{data.ringkasan.hariMakan}</td>
                  <td className="px-2 py-2.5 text-center font-bold text-amber-600 dark:text-amber-400">{data.ringkasan.tanpaUangMakan ?? 0}</td>
                  <td className="px-2 py-2.5 text-center font-bold">{data.ringkasan.lembur}j</td>
                  <td colSpan={3} />
                  <td className="px-2 py-2.5 text-right font-bold">{rupiah(data.ringkasan.subGaji)}</td>
                  <td className="px-2 py-2.5 text-right font-bold">{rupiah(data.ringkasan.subMakan)}</td>
                  <td className="px-2 py-2.5 text-right font-bold">{rupiah(data.ringkasan.subLembur)}</td>
                  <td className="px-3 py-2.5 text-right font-extrabold text-indigo-600 dark:text-indigo-300">{rupiah(totalKeseluruhan)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-1 text-center text-[10px] font-semibold text-slate-400 sm:hidden">← Geser tabel ke samping untuk melihat kolom lain →</p>

          {adaData && (
            <button onClick={eksporExcelGaji} disabled={ekspor} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition active:scale-95 disabled:opacity-40">
              {ekspor ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Export Excel Gaji
            </button>
          )}

          <p className="mt-4 rounded-3xl bg-indigo-50 p-4 text-xs leading-relaxed text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
            🧾 <b>Cara hitung:</b> <b>Hari Dibayar</b> = Hadir + Terlambat + Hadir Libur + Izin + Sakit + Cuti (pengajuan yang tidak ditolak; Alpha tidak dibayar).
            <b> Hari Uang Makan</b> = hanya hari masuk <b>tepat waktu</b> (Hadir + Hadir Libur) — hari <b>Terlambat tidak dapat uang makan</b>.
            <b> Lembur (Rp)</b> = total jam lembur <b>Disetujui</b> × tarif lembur per jam.
            Periode penggajian di atas yang muncul sebagai <b>slip gaji</b> di aplikasi karyawan (Profil → Slip Gaji).
            Ubah tarif langsung di tabel — tersimpan otomatis dan terpakai juga untuk periode berikutnya.
          </p>
        </>
      )}
    </div>
  )
}

// Tab Laporan — rekap kehadiran per karyawan pada satu periode, lengkap dengan
// export Excel bergaya modern (utils/laporan-excel.js, ExcelJS: sheet Ringkasan
// + satu sheet per departemen) dan PDF (jsPDF + autoTable).

// Satu baris tabel dari data karyawan (dipakai tabel PDF — % sebagai teks).
function barisLaporan(r) {
  return [r.nama, r.nip, r.jabatan, r.departemen, r.hadir, r.terlambat, r.hadirLibur, r.izin, r.sakit, r.cuti, r.alpha, r.lembur, r.hariKerja, `${r.persen}%`]
}

const namaBerkasLaporan = (data, ekstensi) => `laporan-kehadiran-${data.dari}_sd_${data.sampai}.${ekstensi}`

function Laporan() {
  const hariIniISO = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const [dari, setDari] = useState(`${hariIniISO().slice(0, 7)}-01`) // default: awal bulan berjalan
  const [sampai, setSampai] = useState(hariIniISO)
  const [dept, setDept] = useState('') // '' = semua departemen
  const [daftarDept, setDaftarDept] = useState([])
  const [data, setData] = useState(null)
  const [memuat, setMemuat] = useState(true)
  const [pesan, setPesan] = useState(null)
  const [ekspor, setEkspor] = useState('') // 'xlsx' | 'pdf' saat proses

  const muat = () => {
    setMemuat(true)
    setPesan(null)
    api.adminLaporan({ dari, sampai, departemen: dept || undefined })
      .then(setData)
      .catch((e) => setPesan({ ok: false, teks: e.message }))
      .finally(() => setMemuat(false))
  }

  useEffect(() => {
    api.adminKaryawan()
      .then((list) => setDaftarDept([...new Set(list.map((k) => k.departemen || '-'))].filter(Boolean).sort()))
      .catch(() => {})
    muat()
  }, [])

  const adaData = !!data?.baris?.length
  const kehadiranWarna = (p) =>
    p >= 90 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
      : p >= 75 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
        : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400'

  // ---------- Export Excel (XLSX bergaya modern — ExcelJS) ----------
  const eksporExcel = async () => {
    if (!adaData) return
    setEkspor('xlsx')
    try {
      // Pustaka exceljs dimuat di sini (bukan saat aplikasi dibuka) agar bundel awal ringan.
      const { ExcelJS } = await muatPustakaEkspor()
      const wb = await buatWorkbookLaporan(data, ExcelJS)
      // Workbook ditulis ke ArrayBuffer → Blob → unduhBerkas (unduh peramban
      // di web; berkas langsung ke folder Unduhan HP di aplikasi Android).
      const array = await wb.xlsx.writeBuffer()
      const hasil = await unduhBerkas({
        nama: namaBerkasLaporan(data, 'xlsx'),
        isi: new Blob([array], { type: MIME.xlsx }),
        mime: MIME.xlsx,
        judul: 'Laporan Kehadiran NUBSEN',
      })
      const jumlahSheet = new Set(data.baris.map((r) => r.departemen)).size + 1
      setPesan({ ok: true, teks: pesanHasilUnduh(hasil, `Excel (${jumlahSheet} sheet)`) })
    } catch (e) {
      setPesan({ ok: false, teks: `Gagal membuat Excel: ${e.message}` })
    } finally {
      setEkspor('')
    }
  }

  // ---------- Export PDF ----------
  const eksporPdf = async () => {
    if (!adaData) return
    setEkspor('pdf')
    try {
      // jsPDF + autoTable juga dimuat saat diperlukan saja.
      const { jsPDF, autoTable } = await muatPustakaEkspor()
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      doc.setFontSize(14)
      doc.text('Laporan Kehadiran Karyawan — NUBSEN', 40, 36)
      doc.setFontSize(9)
      doc.setTextColor(90)
      const labelHari = (data.hariKerjaHari || []).map((n) => NAMA_HARI[n]).join('/')
      doc.text(`Periode: ${formatTanggalPendek(data.dari)} s.d. ${formatTanggalPendek(data.sampai)}   •   Hari kerja: ${data.hariKerja} hari${labelHari ? ` (${labelHari})` : ''}   •   Departemen: ${data.departemen || 'Semua'}`, 40, 52)

      autoTable(doc, {
        startY: 66,
        head: [KOLOM_LAPORAN],
        body: data.baris.map(barisLaporan),
        styles: { fontSize: 7, cellPadding: 2.5 },
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [244, 245, 251] },
      })

      // Rekap per departemen (dihitung di server, dikirim sebagai data.rekap).
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 24,
        head: [['Departemen', 'Karyawan', 'Hadir', 'Terlambat', 'Hadir Libur', 'Izin', 'Sakit', 'Cuti', 'Alpha', 'Lembur (jam)', '% Kehadiran']],
        body: (data.rekap || []).map((g) => [g.departemen, g.karyawan, g.hadir, g.terlambat, g.hadirLibur, g.izin, g.sakit, g.cuti, g.alpha, g.lembur, `${g.persen}%`]),
        styles: { fontSize: 7.5, cellPadding: 3 },
        headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold' },
      })

      // doc.save() (triger klik <a download>) juga gagal di WebView Android —
      // output sebagai Blob lalu lewat unduhBerkas yang sama dengan Excel.
      const hasil = await unduhBerkas({
        nama: namaBerkasLaporan(data, 'pdf'),
        isi: doc.output('blob'),
        mime: MIME.pdf,
        judul: 'Laporan Kehadiran NUBSEN',
      })
      setPesan({ ok: true, teks: pesanHasilUnduh(hasil, 'PDF') })
    } catch (e) {
      setPesan({ ok: false, teks: `Gagal membuat PDF: ${e.message}` })
    } finally {
      setEkspor('')
    }
  }

  const clsInput = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800'
  // Ringkasan angka: ikon + warna aksen, konsisten dengan petak statistik Ringkasan.
  const kartu = [
    { Icon: Users, angka: data?.ringkasan?.totalKaryawan, label: 'Karyawan', teks: 'text-indigo-600 dark:text-indigo-300' },
    { Icon: CalendarRange, angka: data?.hariKerja, label: 'Hari Kerja', teks: 'text-slate-600 dark:text-slate-300' },
    { Icon: BarChart3, angka: data?.ringkasan?.persen != null ? `${data.ringkasan.persen}%` : null, label: 'Rata-rata Hadir', teks: 'text-violet-600 dark:text-violet-300' },
    { Icon: CheckCircle2, angka: data?.ringkasan?.hadir, label: 'Hadir', teks: 'text-emerald-600 dark:text-emerald-300' },
    { Icon: Clock, angka: data?.ringkasan?.terlambat, label: 'Terlambat', teks: 'text-amber-600 dark:text-amber-300' },
    { Icon: CalendarCheck2, angka: data?.ringkasan?.hadirLibur, label: 'Hadir Libur', teks: 'text-teal-600 dark:text-teal-300' },
    { Icon: AlertTriangle, angka: data?.ringkasan?.alpha, label: 'Alpha', teks: 'text-rose-600 dark:text-rose-300' },
    { Icon: FileText, angka: data?.ringkasan?.izin, label: 'Izin', teks: 'text-sky-600 dark:text-sky-300' },
    { Icon: Plane, angka: data?.ringkasan?.cuti, label: 'Cuti', teks: 'text-cyan-600 dark:text-cyan-300' },
    { Icon: FileWarning, angka: data?.ringkasan?.sakit, label: 'Sakit', teks: 'text-orange-600 dark:text-orange-300' },
    { Icon: Timer, angka: data?.ringkasan?.lembur, label: 'Jam Lembur', teks: 'text-fuchsia-600 dark:text-fuchsia-300' },
  ]

  return (
    <div className="animate-fade-in space-y-4">
      <BannerPesan pesan={pesan} />

      {/* Filter periode & departemen */}
      <div className="card space-y-3">
        <h2 className="judul-seksi">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <Filter size={14} />
          </span>
          Saring Laporan
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Dari Tanggal</span>
            <input type="date" value={dari} onChange={(e) => setDari(e.target.value)} className={clsInput} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Sampai Tanggal</span>
            <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} className={clsInput} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Departemen</span>
          <select value={dept} onChange={(e) => setDept(e.target.value)} className={clsInput}>
            <option value="">Semua Departemen</option>
            {daftarDept.map((d) => <option key={d} value={d === '-' ? '' : d}>{d}</option>)}
          </select>
        </label>
        <button onClick={muat} disabled={memuat} className="btn-primary w-full disabled:opacity-40">
          {memuat ? <Loader2 size={16} className="animate-spin" /> : <Filter size={16} />} Tampilkan Laporan
        </button>
      </div>

      {/* Ringkasan angka */}
      {adaData && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {kartu.map(({ Icon, angka, label, teks }, i) => (
            <div key={label} style={{ animationDelay: `${i * 35}ms` }} className={`stat-tile animate-rise !p-2.5 text-center ${teks}`}>
              <span className="relative z-10 mx-auto grid h-8 w-8 place-items-center rounded-xl bg-white/70 shadow-sm dark:bg-white/10">
                <Icon size={15} />
              </span>
              <p className="relative z-10 mt-1.5 text-sm font-extrabold leading-none tabular-nums text-slate-800 dark:text-white">{angka ?? '—'}</p>
              <p className="relative z-10 mt-0.5 truncate text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tombol export */}
      {adaData && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button onClick={eksporExcel} disabled={!!ekspor} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition active:scale-95 hover:brightness-110 disabled:opacity-40">
            {ekspor === 'xlsx' ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Excel (XLSX)
          </button>
          <button onClick={eksporPdf} disabled={!!ekspor} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/25 transition active:scale-95 hover:brightness-110 disabled:opacity-40">
            {ekspor === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} PDF
          </button>
        </div>
      )}

      {/* Tabel rekap per karyawan */}
      {memuat && !adaData ? (
        <p className="card flex items-center justify-center gap-2 py-8 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Memuat laporan…</p>
      ) : !adaData ? (
        <p className="card py-8 text-center text-xs text-slate-400">
          Belum ada data pada filter ini — ubah periode/departemen lalu tekan Tampilkan Laporan.
        </p>
      ) : (
        <div className="card tabel-geser !p-0">
          <table className="tabel-modern min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-3 py-2.5">Karyawan</th>
                <th className="px-2 py-2.5">Departemen</th>
                <th className="px-2 py-2.5 text-center">Hadir</th>
                <th className="px-2 py-2.5 text-center">Telat</th>
                <th className="px-2 py-2.5 text-center">Libur</th>
                <th className="px-2 py-2.5 text-center">Izin</th>
                <th className="px-2 py-2.5 text-center">Sakit</th>
                <th className="px-2 py-2.5 text-center">Cuti</th>
                <th className="px-2 py-2.5 text-center">Alpha</th>
                <th className="px-2 py-2.5 text-center">Lembur</th>
                <th className="px-3 py-2.5 text-center">Kehadiran</th>
              </tr>
            </thead>
            <tbody>
              {data.baris.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                  <td className="px-3 py-2.5">
                    <p className="font-bold text-slate-700 dark:text-slate-200">{r.nama}</p>
                    <p className="text-[10px] text-slate-400">{r.nip} • {r.jabatan}</p>
                  </td>
                  <td className="px-2 py-2.5 text-slate-500 dark:text-slate-400">{r.departemen}</td>
                  <td className="px-2 py-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">{r.hadir}</td>
                  <td className="px-2 py-2.5 text-center font-bold text-amber-600 dark:text-amber-400">{r.terlambat}</td>
                  <td className="px-2 py-2.5 text-center text-teal-600 dark:text-teal-400">{r.hadirLibur}</td>
                  <td className="px-2 py-2.5 text-center text-slate-500 dark:text-slate-400">{r.izin}</td>
                  <td className="px-2 py-2.5 text-center text-slate-500 dark:text-slate-400">{r.sakit}</td>
                  <td className="px-2 py-2.5 text-center text-slate-500 dark:text-slate-400">{r.cuti}</td>
                  <td className="px-2 py-2.5 text-center font-bold text-rose-600 dark:text-rose-400">{r.alpha}</td>
                  <td className="px-2 py-2.5 text-center text-slate-500 dark:text-slate-400">{r.lembur}j</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${kehadiranWarna(r.persen)}`}>{r.persen}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adaData && (
        <p className="text-center text-[10px] font-semibold text-slate-400 sm:hidden">← Geser tabel ke samping untuk melihat kolom lain →</p>
      )}

      <p className="rounded-3xl bg-indigo-50 p-4 text-xs leading-relaxed text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
        📊 <b>Cara hitung:</b> Hari kerja mengikuti pengaturan <b>Hari Kerja</b> di tab Jadwal (contoh Senin–Jumat) pada rentang terpilih.
        <b> % Kehadiran</b> = (Hadir + Terlambat) ÷ Hari Kerja. Absensi di luar hari kerja tercatat pada kolom <b>Hadir Libur</b> dan
        tidak menambah persentase. Izin/Sakit/Cuti dihitung dari pengajuan yang tidak ditolak (hari tumpang-tindih periode); lembur dari pengajuan yang
        <b> Disetujui</b>. Alpha = hari kerja − masuk − izin. Excel berisi sheet <b>Ringkasan</b> + satu sheet per departemen.
      </p>
    </div>
  )
}



// ============================================================================
//  RIWAYAT SURAT PERINGATAN (tab "Riwayat SP")
//  Berbeda dari tab Peringatan yang hanya menampilkan surat AKTIF: di sini
//  seluruh kejadian tercatat — kapan surat diterbitkan, oleh admin siapa, dan
//  kapan dicabut. Surat yang sudah dicabut (atau karyawan yang sudah dihapus)
//  tetap tampil lengkap karena data penting disalin saat kejadian berlangsung.
// ============================================================================
function RiwayatPeringatan() {
  const [data, setData] = useState(null)
  const [karyawan, setKaryawan] = useState([])
  const [filter, setFilter] = useState({ employeeId: '', jenis: '', aksi: '', dari: '', sampai: '' })
  const [memuat, setMemuat] = useState(true)

  const muat = (f) => {
    const pakai = f || filter
    setMemuat(true)
    api.adminRiwayatPeringatan(pakai)
      .then(setData)
      .catch(() => setData({ items: [], ringkas: { total: 0, diterbitkan: 0, dicabut: 0 } }))
      .finally(() => setMemuat(false))
  }

  useEffect(() => {
    muat({ employeeId: '', jenis: '', aksi: '', dari: '', sampai: '' })
    api.adminKaryawan().then(setKaryawan).catch(() => {})
    // Muat sekali saat tab dibuka; penyaringan berikutnya lewat tombol Terapkan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (k, v) => setFilter((f) => ({ ...f, [k]: v }))
  const bersihkan = () => {
    const kosong = { employeeId: '', jenis: '', aksi: '', dari: '', sampai: '' }
    setFilter(kosong)
    muat(kosong)
  }

  const items = data?.items || []
  const ringkas = data?.ringkas || { total: 0, diterbitkan: 0, dicabut: 0 }

  return (
    <div className="animate-fade-in">
      <div className="mb-3 flex items-start gap-2.5 rounded-3xl bg-indigo-50 p-4 text-xs leading-relaxed text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
        <History size={16} className="mt-0.5 shrink-0" />
        <span>
          <b>Jejak audit</b> semua surat peringatan &amp; pemecatan: kapan diterbitkan, oleh admin siapa,
          dan kapan dicabut. Surat yang sudah dicabut atau karyawan yang sudah dihapus <b>tetap tercatat</b>
          di sini — bukti riwayat tidak hilang.
        </span>
      </div>

      {/* Ringkasan kejadian (dihitung server dengan COUNT, bukan dari daftar terbatas) */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          ['Total Kejadian', ringkas.total, 'text-indigo-600 dark:text-indigo-300', History],
          ['Diterbitkan', ringkas.diterbitkan, 'text-rose-600 dark:text-rose-300', FilePlus2],
          ['Dicabut', ringkas.dicabut, 'text-emerald-600 dark:text-emerald-300', Undo2],
        ].map(([label, angka, teks, Icon]) => (
          <div key={label} className={`stat-tile !p-3 text-center ${teks}`}>
            <span className="relative z-10 mx-auto grid h-8 w-8 place-items-center rounded-xl bg-white/70 shadow-sm dark:bg-white/10">
              <Icon size={15} />
            </span>
            <p className="relative z-10 mt-1.5 text-xl font-black leading-none tabular-nums text-slate-800 dark:text-white">{angka}</p>
            <p className="relative z-10 mt-0.5 truncate text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Penyaring riwayat */}
      <div className="card mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Karyawan</label>
          <select className="input !px-3" value={filter.employeeId} onChange={(e) => set('employeeId', e.target.value)}>
            <option value="">Semua</option>
            {karyawan.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Jenis Surat</label>
          <select className="input !px-3" value={filter.jenis} onChange={(e) => set('jenis', e.target.value)}>
            <option value="">Semua</option>
            {JENIS_SURAT.map(([j, label]) => <option key={j} value={j}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Jenis Kejadian</label>
          <select className="input !px-3" value={filter.aksi} onChange={(e) => set('aksi', e.target.value)}>
            <option value="">Semua</option>
            <option value="Diterbitkan">Diterbitkan</option>
            <option value="Dicabut">Dicabut</option>
          </select>
        </div>
        <div>
          <label className="label">Dari Tanggal</label>
          <input type="date" className="input !px-3" value={filter.dari} onChange={(e) => set('dari', e.target.value)} />
        </div>
        <div>
          <label className="label">Sampai Tanggal</label>
          <input type="date" className="input !px-3" value={filter.sampai} onChange={(e) => set('sampai', e.target.value)} />
        </div>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
          <button onClick={() => muat()} disabled={memuat} className="btn-primary flex-1 !py-2.5 !text-xs disabled:opacity-40">
            {memuat ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />} Terapkan
          </button>
          <button onClick={bersihkan} className="btn-ghost !py-2.5 !text-xs" aria-label="Bersihkan filter" title="Bersihkan filter">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>


      {/* Daftar riwayat — terbaru di atas */}
      {memuat && items.length === 0 ? (
        <p className="card flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" /> Memuat riwayat…
        </p>
      ) : items.length === 0 ? (
        <p className="card py-8 text-center text-xs text-slate-400">
          Belum ada riwayat surat peringatan pada saringan ini.
        </p>
      ) : (
        <div className="space-y-3 pb-2">
          {items.map((r) => {
            const terbit = r.aksi === 'Diterbitkan'
            return (
              <div key={r.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                      terbit
                        ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                    }`}
                  >
                    {terbit ? <FilePlus2 size={17} /> : <Undo2 size={17} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${kelasSurat(r.jenis)}`}>{r.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          terbit
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        }`}
                      >
                        {r.aksi}
                      </span>
                    </div>
                    <p className="truncate text-sm font-bold">{r.nama || 'Karyawan dihapus'}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {r.nomor || 'nomor tidak tercatat'} • surat {formatTanggalPendek(r.tanggal)}
                    </p>
                    {r.alasan && (
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{r.alasan}</p>
                    )}
                    <p className="mt-1.5 text-[10px] font-semibold text-slate-400">
                      {terbit ? 'Diterbitkan' : 'Dicabut'} oleh {r.oleh}
                      {r.dibuat ? ` • ${r.dibuat}` : ''}
                    </p>
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


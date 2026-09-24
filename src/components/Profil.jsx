import { useMemo, useState } from 'react'
import {
  Briefcase, Building2, Mail, Phone, MapPinned, BadgeCheck, Award, Plane, LogOut, HelpCircle,
  ChevronRight, KeyRound, Eye, EyeOff, Loader2, Wallet, FileWarning, ShieldCheck, Sparkles,
} from 'lucide-react'
import { USER_DEFAULT } from '../hooks/useAbsensi'
import * as api from '../api'
import Bantuan from './Bantuan'
import SlipGaji from './SlipGaji'
import SuratKertas from './SuratKertas'

export default function Profil({ user = USER_DEFAULT, history, onLogout, toast }) {
  const [bantuanOpen, setBantuanOpen] = useState(false)
  const [slipOpen, setSlipOpen] = useState(false)
  // Kartu Keamanan dilipat agar halaman tetap ringkas & mudah dipindai.
  const [bukaPin, setBukaPin] = useState(false)
  // Warna angka rekap per status — hierarki visual kekinian.
  const WARNA_STAT = {
    Hadir: 'text-emerald-600 dark:text-emerald-400',
    Terlambat: 'text-amber-600 dark:text-amber-400',
    Izin: 'text-sky-600 dark:text-sky-400',
    'Izin Terlambat': 'text-teal-600 dark:text-teal-400',
    Alpha: 'text-rose-600 dark:text-rose-400',
  }
  const AKSEN_STAT = {
    Hadir: 'bg-emerald-500',
    Terlambat: 'bg-amber-500',
    Izin: 'bg-sky-500',
    'Izin Terlambat': 'bg-teal-500',
    Alpha: 'bg-rose-500',
  }
  const stats = useMemo(() => {
    const s = { Hadir: 0, Terlambat: 0, Izin: 0, Alpha: 0 }
    history.forEach((h) => {
      // Hari IZIN DATANG (nama baru "Izin Terlambat", nama lama "Izin Datang
      // Siang") = KEHADIRAN: karyawan tetap masuk kerja, hanya jam masuknya
      // lewat → dihitung HADIR (gaji harian & uang makan tetap dibayar), sama
      // dengan laporan admin, slip gaji, dan kartu Statistik Mingguan.
      const kunci = IZIN_DATANG.includes(h.status) ? 'Hadir' : h.status
      if (s[kunci] !== undefined) s[kunci]++
    })
    return s
  }, [history])
  // Catatan: berapa di antara hari Hadir itu yang memakai izin datang.
  const izinDatang = useMemo(
    () => history.filter((h) => IZIN_DATANG.includes(h.status)).length,
    [history],
  )

  const inisial = user.nama
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const items = [
    { Icon: Mail, label: 'Email', value: user.email, latar: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300' },
    { Icon: Phone, label: 'Telepon', value: user.telepon, latar: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' },
    { Icon: MapPinned, label: 'Lokasi Kerja', value: user.lokasiKerja, latar: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' },
  ]

  // Persentase sisa cuti untuk bar progres gradasi.
  const kuotaCuti = user.cutiTahunan ?? 12
  const sisaCuti = user.sisaCuti ?? 12
  const persenCuti = Math.min(100, Math.max(0, (sisaCuti / (kuotaCuti || 1)) * 100))

  // ---- Ganti PIN (diverifikasi hash PIN lama di server) ----
  const [pinLama, setPinLama] = useState('')
  const [pinBaru, setPinBaru] = useState('')
  const [pinUlang, setPinUlang] = useState('')
  const [lihatPin, setLihatPin] = useState(false)
  const [prosesPin, setProsesPin] = useState(false)
  const [pesanPin, setPesanPin] = useState(null) // { tipe: 'ok' | 'error', teks }

  const kirimPin = async (e) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(pinLama) || !/^\d{6}$/.test(pinBaru)) return setPesanPin({ tipe: 'error', teks: 'PIN harus tepat 6 angka.' })
    if (pinBaru !== pinUlang) return setPesanPin({ tipe: 'error', teks: 'Ulangi PIN baru tidak sama.' })
    if (pinBaru === pinLama) return setPesanPin({ tipe: 'error', teks: 'PIN baru harus berbeda dari PIN lama.' })
    setProsesPin(true)
    setPesanPin(null)
    try {
      await api.ubahPin(pinLama, pinBaru)
      setPesanPin({ tipe: 'ok', teks: 'PIN berhasil diganti — gunakan PIN baru saat login berikutnya.' })
      toast?.('PIN berhasil diganti 🔒')
      setPinLama(''); setPinBaru(''); setPinUlang('')
    } catch (err) {
      setPesanPin({ tipe: 'error', teks: err.message })
      toast?.(err.message, 'error')
    } finally {
      setProsesPin(false)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* ===== HERO IDENTITAS — satu kartu gradasi: avatar + nama + status ===== */}
      <div className="animate-rise relative mb-4 overflow-hidden rounded-[1.9rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-5 text-white shadow-xl shadow-indigo-500/25">
        <span aria-hidden className="aurora absolute inset-0 opacity-70 [background-image:linear-gradient(115deg,rgba(255,255,255,.22),transparent_45%,rgba(255,255,255,.16))]" />
        <span aria-hidden className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
        <span aria-hidden className="absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <span aria-hidden className="absolute inset-0 opacity-[0.13] [background-image:radial-gradient(rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="relative z-10 flex items-center gap-4">
          {/* Avatar inisial: cincin kaca di luar, kotak putih di dalam. Tidak ada
              posisi negatif / z-index rumit, jadi hurufnya mustahil tertimpa. */}
          <div className="shrink-0 rounded-[1.5rem] border border-white/30 bg-white/15 p-1 backdrop-blur-md">
            <div className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-[1.25rem] bg-white shadow-inner dark:bg-slate-900">
              <span className="bg-gradient-to-br from-indigo-700 to-fuchsia-500 bg-clip-text text-2xl font-black text-transparent">
                {inisial}
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <span className="chip-glass text-[10px] font-bold uppercase tracking-[0.16em]">
              <Sparkles size={11} className="text-amber-300" /> Profil Saya
            </span>
            <h1 className="mt-1 truncate text-xl font-black leading-tight tracking-tight">{user.nama}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-white/85">
              <BadgeCheck size={13} className="text-emerald-300" /> NIP {user.nip} • Akun aktif
            </p>
          </div>
        </div>

        {/* Chip status kepegawaian, jabatan & departemen */}
        <div className="relative z-10 mt-4 flex flex-wrap gap-2">
          <span className="chip-glass text-[11px]">
            <BadgeCheck size={12} /> {user.statusKaryawan || 'Karyawan Tetap'}
          </span>
          <span className="chip-glass text-[11px]">
            <Briefcase size={12} /> {user.jabatan}
          </span>
          <span className="chip-glass text-[11px]">
            <Building2 size={12} /> {user.departemen}
          </span>
        </div>
      </div>

      {/* ===== REKAP KEHADIRAN — petak statistik beraksen warna ===== */}
      <div className="card animate-rise mb-4" style={{ animationDelay: '50ms' }}>
        <h2 className="judul-seksi mb-3">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-500/15">
            <Award size={14} />
          </span>
          Rekap Kehadiran
          <span className="ml-auto text-[10px] font-semibold text-slate-400">{history.length} catatan</span>
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(stats).map(([k, v], i) => (
            <div
              key={k}
              style={{ animationDelay: `${80 + i * 45}ms` }}
              className={`stat-tile animate-rise !p-3 text-center ${WARNA_STAT[k] || 'text-slate-500'}`}
            >
              <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${AKSEN_STAT[k] || 'bg-slate-300'}`} />
              <p className="relative z-10 text-2xl font-black leading-none tabular-nums text-slate-800 dark:text-white">{v}</p>
              <p className="relative z-10 mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{k}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ===== SISA CUTI — bar progres gradasi ===== */}
      <div className="card animate-rise mb-4" style={{ animationDelay: '90ms' }}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="judul-seksi">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-50 text-sky-500 dark:bg-sky-500/15">
              <Plane size={14} />
            </span>
            Sisa Cuti Tahunan
          </h2>
          <span className="shrink-0 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 px-3 py-1 text-xs font-extrabold text-white shadow-md shadow-indigo-500/30">
            {sisaCuti} hari
          </span>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-500"
            style={{ width: `${persenCuti}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          Kuota {kuotaCuti} hari/tahun • terpakai {user.cutiTerpakai ?? (kuotaCuti - sisaCuti)} hari
          {/* Angka ini dihitung server setiap kali data dimuat ulang — pengajuan cuti
              yang baru dikirim langsung memotong sisa cuti di atas. */}
          {!!user.cutiMenunggu && <> • menunggu persetujuan {user.cutiMenunggu} hari</>}
        </p>
      </div>


      {/* ===== SLIP GAJI — tombol aksi kaca dengan tepi gradasi ===== */}
      <button
        onClick={() => setSlipOpen(true)}
        className="animate-rise mb-4 flex w-full items-center justify-between gap-3 overflow-hidden rounded-[1.5rem] bg-gradient-to-r from-emerald-500 to-teal-600 p-[1.5px] text-left shadow-lg shadow-emerald-500/25 transition active:scale-[0.98]"
        style={{ animationDelay: '120ms' }}
      >
        <span className="flex w-full items-center gap-3 rounded-[1.4rem] bg-white px-4 py-3.5 dark:bg-slate-900">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
            <Wallet size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">Slip Gaji</span>
            <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
              Rincian gaji, uang makan &amp; lembur per periode
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-emerald-500" />
        </span>
      </button>
      <SlipGaji open={slipOpen} onClose={() => setSlipOpen(false)} user={user} toast={toast} />

      {/* ===== SURAT PERINGATAN (SP1–SP3) & pemecatan ===== */}
      <div className="card animate-rise mb-4" style={{ animationDelay: '150ms' }}>
        <h2 className="judul-seksi mb-3">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-500/15">
            <FileWarning size={14} />
          </span>
          Surat Peringatan &amp; Pemecatan
        </h2>
        {(user.peringatan || []).length === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 px-3.5 py-3 text-xs font-semibold text-emerald-700 dark:from-emerald-500/10 dark:to-teal-500/5 dark:text-emerald-300">
            <BadgeCheck size={15} /> Bersih — tidak ada surat peringatan. Pertahankan!
          </p>
        ) : (
          <div className="space-y-3">
            {user.peringatan.map((s) => (
              <SuratKertas key={s.id} surat={s} user={user} perusahaan={user.perusahaan} toast={toast} />
            ))}
          </div>
        )}
      </div>

      {/* ===== DATA KONTAK — satu kartu, baris dipisah garis halus ===== */}
      <div className="card animate-rise mb-4 !p-0" style={{ animationDelay: '180ms' }}>
        <h2 className="judul-seksi border-b border-slate-100 p-4 pb-3 dark:border-white/5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <Mail size={14} />
          </span>
          Data Kontak
        </h2>
        {items.map(({ Icon, label, value, latar }, i) => (
          <div
            key={label}
            className={`flex items-center gap-3 p-4 ${i > 0 ? 'border-t border-slate-100 dark:border-white/5' : ''}`}
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${latar}`}>
              <Icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="truncate text-sm font-semibold">{value}</p>
            </div>
          </div>
        ))}
      </div>


      {/* ===== KEAMANAN — ganti PIN, dilipat agar halaman tetap ringkas ===== */}
      <div className="card animate-rise mb-4 !p-0" style={{ animationDelay: '210ms' }}>
        <button
          type="button"
          onClick={() => setBukaPin((v) => !v)}
          aria-expanded={bukaPin}
          className="flex w-full items-center gap-3 p-4 text-left"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-white shadow-md shadow-indigo-500/25">
            <ShieldCheck size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Keamanan — Ganti PIN</span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">Perbarui PIN 6 angka akun Anda</span>
          </span>
          <ChevronRight
            size={18}
            className={`shrink-0 text-slate-400 transition-transform duration-300 ${bukaPin ? 'rotate-90' : ''}`}
          />
        </button>

        {bukaPin && (
          <form onSubmit={kirimPin} className="animate-fade-in space-y-3 border-t border-slate-100 p-4 dark:border-white/5">
            {[
              { label: 'PIN Lama', nilai: pinLama, set: setPinLama, auto: 'current-pin' },
              { label: 'PIN Baru (6 angka)', nilai: pinBaru, set: setPinBaru, auto: 'new-pin' },
              { label: 'Ulangi PIN Baru', nilai: pinUlang, set: setPinUlang, auto: 'new-pin2' },
            ].map(({ label, nilai, set, auto }) => (
              <div key={label}>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
                <div className="relative">
                  <input
                    className="input !py-2.5 pr-12 font-mono tracking-[0.35em]"
                    type={lihatPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete={auto}
                    placeholder="••••••"
                    value={nilai}
                    onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <button
                    type="button"
                    onClick={() => setLihatPin((v) => !v)}
                    aria-label="Tampilkan / sembunyikan PIN"
                    className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {lihatPin ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            ))}
            {pesanPin && (
              <p
                className={`rounded-xl px-3 py-2 text-[11px] font-semibold ${
                  pesanPin.tipe === 'ok'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                }`}
              >
                {pesanPin.tipe === 'ok' ? '✓ ' : '⚠️ '}
                {pesanPin.teks}
              </p>
            )}
            <button type="submit" disabled={prosesPin} className="btn-primary w-full !py-2.5 !text-xs">
              {prosesPin ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              {prosesPin ? 'Menyimpan…' : 'Simpan PIN Baru'}
            </button>
          </form>
        )}
      </div>


      {/* ===== PUSAT BANTUAN ===== */}
      <button
        onClick={() => setBantuanOpen(true)}
        className="animate-rise mb-4 flex w-full items-center justify-between gap-3 overflow-hidden rounded-[1.5rem] bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 p-[1.5px] text-left shadow-lg shadow-indigo-500/25 transition active:scale-[0.98]"
        style={{ animationDelay: '240ms' }}
      >
        <span className="flex w-full items-center gap-3 rounded-[1.4rem] bg-white px-4 py-3.5 dark:bg-slate-900">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 text-white shadow-md">
            <HelpCircle size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">Pusat Bantuan</span>
            <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
              Cara absen, izin, lembur, dan FAQ lainnya
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-indigo-500" />
        </span>
      </button>
      <Bantuan open={bantuanOpen} onClose={() => setBantuanOpen(false)} />

      {/* ===== KELUAR ===== */}
      <button
        onClick={onLogout}
        className="flex w-full items-center justify-center gap-2 rounded-[1.5rem] border border-rose-200/80 bg-rose-50/80 py-3.5 text-sm font-bold text-rose-600 shadow-sm backdrop-blur transition hover:bg-rose-100/80 active:scale-[0.98] dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
      >
        <LogOut size={17} /> Keluar dari NUBSEN
      </button>

      <p className="mt-5 text-center text-[11px] text-slate-400">
        NUBSEN v2.0 • Cukup Satu Klik!
      </p>
    </div>
  )
}


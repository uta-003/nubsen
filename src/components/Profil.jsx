import { useMemo, useState } from 'react'
import { Briefcase, Building2, Mail, Phone, MapPinned, BadgeCheck, Award, Plane, LogOut, HelpCircle, ChevronRight, KeyRound, Eye, EyeOff, Loader2, Wallet, FileWarning } from 'lucide-react'
import { USER_DEFAULT } from '../hooks/useAbsensi'
import * as api from '../api'
import Bantuan from './Bantuan'
import SlipGaji from './SlipGaji'
import SuratKertas from './SuratKertas'

export default function Profil({ user = USER_DEFAULT, history, onLogout, toast }) {
  const [bantuanOpen, setBantuanOpen] = useState(false)
  const [slipOpen, setSlipOpen] = useState(false)
  // Warna angka rekap per status — hierarki visual kekinian.
  const WARNA_STAT = {
    Hadir: 'text-emerald-600 dark:text-emerald-400',
    Terlambat: 'text-amber-600 dark:text-amber-400',
    Izin: 'text-sky-600 dark:text-sky-400',
    Alpha: 'text-rose-600 dark:text-rose-400',
  }
  const stats = useMemo(() => {
    const s = { Hadir: 0, Terlambat: 0, Izin: 0, Alpha: 0 }
    history.forEach((h) => { if (s[h.status] !== undefined) s[h.status]++ })
    return s
  }, [history])

  const inisial = user.nama
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const items = [
    { Icon: Mail, label: 'Email', value: user.email },
    { Icon: Phone, label: 'Telepon', value: user.telepon },
    { Icon: MapPinned, label: 'Lokasi Kerja', value: user.lokasiKerja },
  ]

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
      {/* Kartu identitas — banner gradien dengan dekorasi blur + avatar pop */}
      <div className="card animate-rise mb-4 overflow-hidden !p-0">
        <div className="relative h-24 overflow-hidden bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600">
          <span aria-hidden className="absolute -left-6 -top-10 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <span aria-hidden className="absolute -right-8 top-2 h-24 w-24 rounded-full bg-white/15 blur-xl" />
        </div>
        <div className="-mt-12 px-5 pb-5">
          {/* `relative z-10` WAJIB di sini. Banner gradien di atasnya memakai
              `position: relative`, dan menurut urutan pengecatan CSS elemen
              berposisi selalu dicat SESUDAH isi statis — tanpa z-index ini
              banner menutupi huruf inisial avatar (huruf nama "tertimpa biru"). */}
          <div className="relative z-10 grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-extrabold text-white shadow-lg shadow-indigo-500/40 ring-4 ring-white dark:ring-slate-900">
            {inisial}
          </div>
          <h1 className="mt-3 text-lg font-extrabold tracking-tight">{user.nama}</h1>
          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <BadgeCheck size={14} className="text-emerald-500" /> NIP {user.nip} • Aktif
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {/* Status kepegawaian (diatur admin di form Tambah/Edit Karyawan) */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                (user.statusKaryawan || 'Karyawan Tetap') === 'Karyawan Kontrak'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
              }`}
            >
              <BadgeCheck size={13} /> {user.statusKaryawan || 'Karyawan Tetap'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              <Briefcase size={13} /> {user.jabatan}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
              <Building2 size={13} /> Dept. {user.departemen}
            </span>
          </div>
        </div>
      </div>

      {/* Statistik kehadiran — angka berwarna per status */}
      <div className="card animate-rise mb-4" style={{ animationDelay: '60ms' }}>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Award size={16} className="text-amber-500" /> Rekap Kehadiran
        </h2>
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {Object.entries(stats).map(([k, v], i) => (
            <div
              key={k}
              className="min-w-0 rounded-2xl bg-slate-50 p-2.5 dark:bg-slate-800 sm:p-3"
              style={{ animationDelay: `${100 + i * 50}ms` }}
            >
              <p className={`text-lg font-extrabold leading-none sm:text-xl ${WARNA_STAT[k] || ''}`}>{v}</p>
              <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{k}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sisa cuti tahunan */}
      <div className="card animate-rise mb-4" style={{ animationDelay: '120ms' }}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
            <Plane size={16} className="text-sky-500" /> Sisa Cuti Tahunan
          </h2>
          <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
            {user.sisaCuti ?? 12} hari
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all"
            style={{ width: `${Math.min(100, ((user.sisaCuti ?? 12) / (user.cutiTahunan ?? 12)) * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Kuota {user.cutiTahunan ?? 12} hari/tahun • terpakai {user.cutiTerpakai ?? ((user.cutiTahunan ?? 12) - (user.sisaCuti ?? 12))} hari
          {/* Angka ini dihitung server setiap kali data dimuat ulang — pengajuan cuti
              yang baru dikirim langsung memotong sisa cuti di atas. */}
          {!!user.cutiMenunggu && <> • menunggu persetujuan {user.cutiMenunggu} hari</>}
        </p>
      </div>

      {/* Surat peringatan (SP1–SP3) & pemecatan — diterbitkan admin, muncul di sini */}
      <div className="card animate-rise mb-4" style={{ animationDelay: '130ms' }}>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
          <FileWarning size={16} className="text-rose-500" /> Surat Peringatan &amp; Pemecatan
        </h2>
        {(user.peringatan || []).length === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3.5 py-3 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <BadgeCheck size={14} /> Bersih — tidak ada surat peringatan. Pertahankan!
          </p>
        ) : (
          <div className="space-y-3">
            {user.peringatan.map((s) => (
              <SuratKertas key={s.id} surat={s} user={user} perusahaan={user.perusahaan} toast={toast} />
            ))}
          </div>
        )}
      </div>

      {/* Slip gaji per PERIODE PENGGAJIAN (periode ditetapkan admin di tab Gaji) */}
      <button
        onClick={() => setSlipOpen(true)}
        className="mb-4 flex w-full items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left transition active:scale-[0.98] dark:border-emerald-500/30 dark:bg-emerald-500/10"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <Wallet size={18} />
          </span>
          <div>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Slip Gaji</p>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
              Rincian gaji, uang makan & lembur per periode penggajian
            </p>
          </div>
        </div>
        <ChevronRight size={18} className="text-emerald-400" />
      </button>
      <SlipGaji open={slipOpen} onClose={() => setSlipOpen(false)} user={user} toast={toast} />

      {/* Detail kontak */}
      <div className="card animate-rise space-y-3" style={{ animationDelay: '180ms' }}>
        {items.map(({ Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              <Icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="truncate text-sm font-semibold">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Keamanan — ganti PIN sendiri: verifikasi PIN lama → PIN baru 6 angka */}
      <div className="card animate-rise mt-4" style={{ animationDelay: '140ms' }}>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
          <KeyRound size={16} className="text-indigo-500" /> Keamanan — Ganti PIN
        </h2>
        <form onSubmit={kirimPin} className="space-y-3">
          {[
            { label: 'PIN Lama', nilai: pinLama, set: setPinLama, auto: 'current-pin' },
            { label: 'PIN Baru (6 angka)', nilai: pinBaru, set: setPinBaru, auto: 'new-pin' },
            { label: 'Ulangi PIN Baru', nilai: pinUlang, set: setPinUlang, auto: 'new-pin2' },
          ].map(({ label, nilai, set, auto }) => (
            <div key={label}>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
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
      </div>

      {/* Pusat bantuan */}
      <button
        onClick={() => setBantuanOpen(true)}
        className="mt-4 flex w-full items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-left transition active:scale-[0.98] dark:border-indigo-500/30 dark:bg-indigo-500/10"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
            <HelpCircle size={18} />
          </span>
          <div>
            <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Pusat Bantuan</p>
            <p className="text-[11px] text-indigo-500/80 dark:text-indigo-400/80">Cara absen, izin, lembur, dan FAQ lainnya</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-indigo-400" />
      </button>
      <Bantuan open={bantuanOpen} onClose={() => setBantuanOpen(false)} />

      <button
        onClick={onLogout}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 py-3.5 text-sm font-bold text-rose-600 transition active:scale-[0.98] dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
      >
        <LogOut size={17} /> Keluar dari NUBSEN
      </button>

      <p className="mt-5 text-center text-[11px] text-slate-400">
        NUBSEN v2.0
      </p>
    </div>
  )
}


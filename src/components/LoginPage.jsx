import { useEffect, useState } from 'react'
import { Mail, LockKeyhole, Eye, EyeOff, Loader2, LogIn, Sparkles, Camera, BellRing, BarChart3, UserPlus, Building2 } from 'lucide-react'
import * as api from '../api'
import LogoAnimasi from './LogoAnimasi'

// Halaman login modern: latar aurora gelap + blob cahaya, kartu KACA
// (glassmorphism), logo tanpa border, tombol gradasi, dan chip fitur.
// Getar (shake) saat salah, show/hide PIN, dukungan penuh mode gelap.
// Pada instalasi KOSONG (tanpa data contoh), tampil form "Pengaturan Awal"
// untuk membuat akun admin REAL pertama perusahaan.
export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [lihat, setLihat] = useState(false)
  const [proses, setProses] = useState(false)
  const [error, setError] = useState(null)
  const [goyang, setGoyang] = useState(false)
  // Pengaturan awal (instalasi kosong → buat akun admin pertama)
  const [modeSetup, setModeSetup] = useState(false)
  const [namaBaru, setNamaBaru] = useState('')
  const [cekSelesai, setCekSelesai] = useState(false)

  useEffect(() => {
    api.cekButuhSetup()
      .then((butuh) => setModeSetup(butuh))
      .catch(() => {})
      .finally(() => setCekSelesai(true))
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setProses(true)
    setError(null)
    try {
      if (modeSetup) {
        const karyawan = await api.setupAwal(namaBaru.trim(), email.trim(), pin.trim())
        onLogin(karyawan)
      } else {
        const karyawan = await api.login(email.trim(), pin.trim())
        onLogin(karyawan)
      }
    } catch (err) {
      setError(err.message)
      setGoyang(true)
      setTimeout(() => setGoyang(false), 500)
    } finally {
      setProses(false)
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      {/* Latar aurora + grid halus — gelap kekinian dengan cahaya berlapis */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_18%_8%,rgba(99,102,241,.4),transparent_70%),radial-gradient(45%_40%_at_88%_26%,rgba(217,70,239,.28),transparent_70%),radial-gradient(60%_55%_at_50%_108%,rgba(56,189,248,.22),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[size:38px_38px] [mask-image:radial-gradient(75%_60%_at_50%_35%,black,transparent)]" />
        <div className="blob absolute -left-24 -top-24 h-80 w-80 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="blob blob-2 absolute -right-28 top-1/4 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="blob blob-3 absolute -bottom-28 left-1/4 h-80 w-80 rounded-full bg-sky-400/15 blur-3xl" />
      </div>

      <div className={`relative w-full max-w-sm ${goyang ? 'shake' : ''}`}>
        {/* Brand: HANYA logo yang tampil — tanpa bulatan/pil pembungkus apapun */}
        <div className="animate-slide-up mb-6 text-center">
          <div className="mx-auto mb-3 w-fit">
            <LogoAnimasi ukuran="xl" tanpaCahaya />
          </div>
          <h1 className="bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-3xl font-black tracking-tight text-transparent">
            NUBSEN
          </h1>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-100/80">
            <Sparkles size={12} className="text-amber-300" /> Cukup Satu Klik!
          </p>
        </div>

        {/* Kartu kaca (glassmorphism) */}
        <div
          className="animate-slide-up rounded-[2rem] border border-white/50 bg-white/85 p-6 shadow-2xl shadow-indigo-950/50 ring-1 ring-white/40 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/75 dark:ring-white/5"
          style={{ animationDelay: '80ms' }}
        >
          {modeSetup ? (
            <>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Pengaturan Awal 🏢</h2>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                Instalasi baru terdeteksi. Buat <b>akun admin pertama</b> perusahaan Anda — semua data contoh telah dihapus.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Selamat datang 👋</h2>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                Masuk dengan email karyawan dan PIN 6 angka.
              </p>
            </>
          )}

          <form onSubmit={submit} className="space-y-3.5">
            {error && (
              <p className="rounded-2xl bg-rose-100 px-3.5 py-2.5 text-xs font-semibold text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                ⚠️ {error}
              </p>
            )}

            {modeSetup && (
              <div>
                <label className="label">Nama Lengkap (Admin)</label>
                <div className="relative">
                  <Building2 size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    autoComplete="name"
                    className="w-full rounded-2xl border border-slate-200/80 bg-white/70 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-200/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:ring-indigo-500/20"
                    placeholder="mis. Nama Anda"
                    value={namaBaru}
                    onChange={(e) => setNamaBaru(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  autoComplete="username"
                  className="w-full rounded-2xl border border-slate-200/80 bg-white/70 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-200/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:ring-indigo-500/20"
                  placeholder="nama@perusahaan.co.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">PIN</label>
              <div className="relative">
                <LockKeyhole size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={lihat ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-slate-200/80 bg-white/70 py-3 pl-11 pr-12 text-sm font-semibold tracking-[0.4em] text-slate-900 outline-none transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-200/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:ring-indigo-500/20"
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setLihat(!lihat)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={lihat ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                >
                  {lihat ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={proses}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 py-3.5 text-base font-bold text-white shadow-lg shadow-indigo-500/40 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {proses ? <Loader2 size={18} className="animate-spin" /> : modeSetup ? <UserPlus size={18} /> : <LogIn size={18} />}
              {proses ? 'Memeriksa…' : modeSetup ? 'Buat Akun Admin & Masuk' : 'Masuk'}
            </button>
          </form>

          {/* Chip fitur — poin jual aplikasi dalam sekali pandang */}
          {!modeSetup && (
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                [Camera, 'Selfie + GPS'],
                [BellRing, 'Notifikasi'],
                [BarChart3, 'Rekap Jalan'],
              ].map(([Icon, label]) => (
                <div key={label} className="flex flex-col items-center gap-1 rounded-2xl bg-slate-100/80 px-1 py-2.5 dark:bg-white/5">
                  <Icon size={15} className="text-indigo-500 dark:text-indigo-300" />
                  <span className="truncate text-[10px] font-bold text-slate-600 dark:text-slate-300">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="animate-slide-up mt-4 text-center text-[10px] font-medium text-white/60" style={{ animationDelay: '160ms' }}>
          NUBSEN v2.0.0
        </p>
      </div>
    </div>
  )
}



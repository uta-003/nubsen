import { useState } from 'react'
import { Mail, LockKeyhole, Eye, EyeOff, Loader2, LogIn, Sparkles, Camera, BellRing, BarChart3 } from 'lucide-react'
import * as api from '../api'
import LogoAnimasi from './LogoAnimasi'

// Halaman login modern: latar gradasi gelap + blob cahaya, kartu KACA
// (glassmorphism), logo tanpa border, tombol gradasi, dan chip fitur.
// Getar (shake) saat salah, show/hide PIN, dukungan penuh mode gelap.
export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [lihat, setLihat] = useState(false)
  const [proses, setProses] = useState(false)
  const [error, setError] = useState(null)
  const [goyang, setGoyang] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setProses(true)
    setError(null)
    try {
      const karyawan = await api.login(email.trim(), pin.trim())
      onLogin(karyawan)
    } catch (err) {
      setError(err.message)
      setGoyang(true)
      setTimeout(() => setGoyang(false), 500)
    } finally {
      setProses(false)
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-700 via-violet-800 to-slate-950 px-4 py-10 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-950">
      {/* Blob cahaya mengambang di latar gradasi */}
      <div className="pointer-events-none absolute inset-0">
        <div className="blob absolute -left-24 -top-24 h-80 w-80 rounded-full bg-indigo-400/25 blur-3xl" />
        <div className="blob blob-2 absolute -right-28 top-1/4 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="blob blob-3 absolute -bottom-28 left-1/4 h-80 w-80 rounded-full bg-violet-400/20 blur-3xl" />
      </div>

      <div className={`relative w-full max-w-sm ${goyang ? 'shake' : ''}`}>
        {/* Brand: logo mengambang + nama gradasi (tanpa border apapun) */}
        <div className="animate-slide-up mb-6 text-center">
          <div className="mx-auto mb-4 w-fit rounded-full bg-white/10 p-3 backdrop-blur-xl">
            <LogoAnimasi ukuran="lg" />
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
          className="animate-slide-up rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/80"
          style={{ animationDelay: '80ms' }}
        >
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Selamat datang 👋</h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Masuk dengan email karyawan dan PIN 6 angka.
          </p>

          <form onSubmit={submit} className="space-y-3.5">
            {error && (
              <p className="rounded-2xl bg-rose-100 px-3.5 py-2.5 text-xs font-semibold text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                ⚠️ {error}
              </p>
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
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-base font-bold text-white shadow-lg shadow-indigo-500/30 transition active:scale-[0.98] disabled:opacity-50"
            >
              {proses ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              {proses ? 'Memeriksa…' : 'Masuk'}
            </button>
          </form>

          {/* Chip fitur — poin jual aplikasi dalam sekali pandang */}
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
        </div>

        <p className="animate-slide-up mt-4 text-center text-[10px] font-medium text-white/60" style={{ animationDelay: '160ms' }}>
          NUBSEN v2.0.0
        </p>
      </div>
    </div>
  )
}



import { useState } from 'react'
import { Mail, LockKeyhole, Eye, EyeOff, Loader2, LogIn, Sparkles } from 'lucide-react'
import * as api from '../api'

// Halaman login dengan animasi: blob gradasi mengambang, logo berdenyut,
// getar saat salah, dan show/hide PIN.
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
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10">
      {/* Blob gradasi mengambang di latar */}
      <div className="pointer-events-none absolute inset-0">
        <div className="blob absolute -left-16 -top-16 h-64 w-64 rounded-full bg-indigo-400/40 blur-3xl" />
        <div className="blob blob-2 absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-fuchsia-400/40 blur-3xl" />
        <div className="blob blob-3 absolute -bottom-20 left-1/4 h-64 w-64 rounded-full bg-violet-400/40 blur-3xl" />
      </div>

      <div className={`w-full max-w-sm animate-slide-up ${goyang ? 'shake' : ''}`}>
        {/* Logo berdenyut */}
        <div className="mb-6 text-center">
          <img
            src="/logo-icon.png"
            alt="Logo NUBSEN"
            className="animate-pulse-slow mx-auto h-20 w-20 object-contain drop-shadow-lg"
          />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">NUBSEN</h1>
          <p className="flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Sparkles size={12} className="text-amber-400" /> Cukup Satu Klik!
          </p>
        </div>

        <form onSubmit={submit} className="card space-y-4">
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
                className="input !pl-11"
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
                className="input !pl-11 !pr-12 tracking-[0.4em]"
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

          <button type="submit" disabled={proses} className="btn-primary w-full !py-3.5 text-base">
            {proses ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Memeriksa…
              </>
            ) : (
              <>
                <LogIn size={18} /> Masuk
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  )
}



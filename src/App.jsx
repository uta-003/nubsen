import { useEffect, useState } from 'react'
import { LogIn, WifiOff, RefreshCw } from 'lucide-react'
import * as api from './api'
import useDarkMode from './hooks/useDarkMode'
import { useAbsensi, USER_DEFAULT } from './hooks/useAbsensi'
import Dashboard from './components/Dashboard'
import Izin from './components/Izin'
import Riwayat from './components/Riwayat'
import Profil from './components/Profil'
import BottomNav from './components/BottomNav'
import DarkModeToggle from './components/DarkModeToggle'
import InstallPrompt from './components/InstallPrompt'
import LoginPage from './components/LoginPage'
import Lembur from './components/Lembur'
import Notifikasi from './components/Notifikasi'
import NotifikasiBell from './components/NotifikasiBell'
import Admin from './components/Admin'
import Toast from './components/Toast'

export default function App() {
  const { dark, toggle } = useDarkMode()
  const [authUser, setAuthUser] = useState(null)
  const [authSiap, setAuthSiap] = useState(false)
  const authed = !!authUser
  const { user, today, history, loading, error, catatCheckIn, catatCheckOut, ajukanIzin, muatUlang, jadwal } =
    useAbsensi(authed)
  const [view, setView] = useState(() => {
    // PULIHKAN TAB TERAKHIR: user tidak perlu navigasi ulang setiap buka aplikasi
    try {
      const t = localStorage.getItem('absenku-tab')
      return ['dashboard', 'izin', 'lembur', 'riwayat', 'notifikasi', 'profil', 'admin'].includes(t) ? t : 'dashboard'
    } catch {
      return 'dashboard'
    }
  })
  const [toast, setToast] = useState(null)

  // Auto-login: validasi token tersimpan saat aplikasi dibuka
  useEffect(() => {
    if (!api.getToken()) {
      setAuthSiap(true)
      return
    }
    api
      .getProfile()
      .then(setAuthUser)
      .catch(() => api.setToken(null))
      .finally(() => setAuthSiap(true))
  }, [])

  // Deep-link berbasis hash (mis. http://localhost:9091/#admin atau :9090/#riwayat)
  // agar halaman bisa di-refresh / di-bookmark tanpa kembali ke beranda.
  useEffect(() => {
    const VIEW_SAH = ['dashboard', 'izin', 'lembur', 'riwayat', 'notifikasi', 'profil', 'admin']
    const dariHash = () => {
      const v = window.location.hash.replace(/^#\/?/, '')
      if (VIEW_SAH.includes(v)) setView(v)
    }
    dariHash()
    window.addEventListener('hashchange', dariHash)
    return () => window.removeEventListener('hashchange', dariHash)
  }, [])

  // Tulis view aktif ke hash URL supaya alamat selalu mencerminkan halaman.
  useEffect(() => {
    const target = view === 'dashboard' ? '' : `#${view}`
    if (window.location.hash !== target) {
      window.history.replaceState(null, '', `${window.location.pathname}${target}`)
    }
    try {
      localStorage.setItem('absenku-tab', view)
    } catch { /* abaikan */ }
  }, [view])

  // Akun non-admin tidak boleh membuka halaman Admin walau mengetik #admin.
  useEffect(() => {
    if (view === 'admin' && authUser && !authUser.isAdmin) setView('dashboard')
  }, [view, authUser])

  const handleLogin = (karyawan) => setAuthUser(karyawan)
  const handleLogout = () => {
    api.logoutApi()
    setAuthUser(null)
    setView('dashboard')
  }

  // Splash saat memeriksa sesi tersimpan
  if (!authSiap)
    return (
      <div className="grid min-h-full place-items-center">
        <img
          src="/logo.png"
          alt="Logo NUBSEN"
          className="animate-pulse-slow h-20 w-20 rounded-[1.75rem] object-cover shadow-xl ring-4 ring-white/70 dark:ring-slate-800"
        />
      </div>
    )

  // Belum login → halaman login beranimasi
  if (!authUser)
    return (
      <div className="min-h-full">
        <LoginPage onLogin={handleLogin} />
      </div>
    )

  // Panel Admin — tampilan sama seperti aplikasi mobile (lebar max-w-md)
  if (view === 'admin' && authUser.isAdmin)
    return (
      <div className="mx-auto min-h-full max-w-md px-4 pb-32 pt-4">
        <Admin user={authUser} onBack={() => setView('dashboard')} />
        <Toast toast={toast} onClose={() => setToast(null)} />
        <BottomNav active={view} onChange={setView} isAdmin />
      </div>
    )

  const tampilkanToast = (pesan, type = 'success') => setToast({ pesan, type })

  const handleCheckIn = async ({ jam, lokasi, selfie }) => {
    try {
      const rec = await catatCheckIn({ jam, lokasi, selfie })
      const jamStr = rec?.checkIn || jam
      let pesan =
        rec?.status === 'Hadir'
          ? `Check-in berhasil pukul ${jamStr} — Hadir! ✅`
          : `Check-in pukul ${jamStr} — tercatat Terlambat ⏰`
      let tipe = rec?.status === 'Hadir' ? 'success' : 'error'
      if (rec?.diLuarArea) {
        pesan += ` • ⚠️ Di luar area kantor (±${rec.jarak} m)`
        tipe = 'warn'
      }
      tampilkanToast(pesan, tipe)
    } catch (e) {
      tampilkanToast(e.message, 'error')
    }
  }

  const handleCheckOut = async ({ jam, lokasi, selfie }) => {
    try {
      const rec = await catatCheckOut({ jam, lokasi, selfie })
      tampilkanToast(`Check-out berhasil pukul ${rec?.checkOut || jam}. Sampai jumpa! 👋`)
    } catch (e) {
      tampilkanToast(e.message, 'error')
    }
  }

  const handleIzin = async (form) => {
    try {
      await ajukanIzin(form)
      tampilkanToast('Pengajuan izin berhasil dikirim 📤')
    } catch (e) {
      tampilkanToast(e.message, 'error')
    }
  }

  return (
    <div className="mx-auto min-h-full max-w-md px-4 pb-32 pt-4">
      {/* Header */}
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Logo NUBSEN"
            className="h-11 w-11 rounded-2xl object-cover shadow-lg ring-2 ring-white/80 dark:ring-slate-700"
          />
          <div>
            <p className="text-base font-extrabold leading-none tracking-tight">NUBSEN</p>
            <p className="text-[10px] font-medium text-slate-400">Cukup Satu Klik!</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotifikasiBell onClick={() => setView('notifikasi')} />
          <DarkModeToggle dark={dark} toggle={toggle} />
        </div>
      </header>

      <InstallPrompt />

      {/* Konten */}
      <main>
        {loading ? (
          <div className="animate-fade-in space-y-4">
            {/* Skeleton loading ala aplikasi mobile */}
            <div className="card space-y-3">
              <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-7 w-44 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="card grid grid-cols-2 gap-3">
              <div className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="card flex justify-center py-4">
              <div className="h-40 w-40 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="card space-y-2">
              <div className="h-4 w-36 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        ) : error ? (
          <div className="card flex flex-col items-center gap-3 py-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-3xl bg-rose-100 text-rose-500 dark:bg-rose-500/15">
              <WifiOff size={26} />
            </span>
            <p className="text-sm font-bold">Tidak dapat terhubung ke server</p>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {error}
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <button onClick={muatUlang} className="btn-primary">
                <RefreshCw size={16} /> Coba Lagi
              </button>
              {error.includes('login kembali') && (
                <button onClick={handleLogout} className="btn-ghost">
                  <LogIn size={16} /> Login Ulang
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {view === 'dashboard' && (
              <Dashboard
                user={user || USER_DEFAULT}
                today={today || { tanggal: '', checkIn: null, checkOut: null, status: null, keterangan: '' }}
                history={history}
                jadwal={jadwal}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
                goToIzin={() => setView('izin')}
              />
            )}
            {view === 'izin' && <Izin onSubmit={handleIzin} sisaCuti={user?.sisaCuti ?? null} />}
            {view === 'lembur' && <Lembur toast={tampilkanToast} />}
            {view === 'riwayat' && <Riwayat history={history} />}
            {view === 'notifikasi' && <Notifikasi />}
            {view === 'profil' && <Profil user={user || USER_DEFAULT} history={history} onLogout={handleLogout} />}
          </>
        )}
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />
      <BottomNav active={view} onChange={setView} isAdmin={!!user?.isAdmin} />
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { LogIn, WifiOff, RefreshCw, ShieldCheck, ArrowUp, CloudUpload } from 'lucide-react'
import * as api from './api'
import useDarkMode from './hooks/useDarkMode'
import { useAbsensi, USER_DEFAULT } from './hooks/useAbsensi'
import useSinkronLuring from './hooks/useSinkronLuring'
import Dashboard from './components/Dashboard'
import Pengajuan from './components/Pengajuan'
import Riwayat from './components/Riwayat'
import Profil from './components/Profil'
import BottomNav from './components/BottomNav'
import DarkModeToggle from './components/DarkModeToggle'
import InstallPrompt from './components/InstallPrompt'
import LoginPage from './components/LoginPage'
import Notifikasi from './components/Notifikasi'
import NotifikasiBell from './components/NotifikasiBell'
import Admin from './components/Admin'
import Toast from './components/Toast'
import { tutupTeratas } from './utils/kembali'
import { keluarAplikasi } from './utils/native'

// Tombol Back Android TANPA dialog konfirmasi keluar: modal ditutup dulu,
// halaman lain kembali ke Beranda, lalu aplikasi langsung ditutup lewat
// keluarAplikasi() (lihat handler window.__nubsenHandleBack di bawah).

export default function App() {
  const { dark, toggle } = useDarkMode()
  const [authUser, setAuthUser] = useState(null)
  const [authSiap, setAuthSiap] = useState(false)
  const authed = !!authUser
  const { user, today, history, loading, error, catatCheckIn, catatCheckOut, ajukanIzin, muatUlang, jadwal } =
    useAbsensi(authed)
  // Mode luring — status koneksi + antrean + sinkron otomatis (utils/luring.js).
  // Callback lewat ref agar identitasnya stabil (hook tak perlu re-subscribe).
  const jalankanSinkron = useRef(null)
  const { online, antrean, menyinkron, sinkronManual } = useSinkronLuring({
    aktif: authed,
    saatSinkron: (h) => jalankanSinkron.current?.(h),
  })
  const [view, setView] = useState(() => {
    // PULIHKAN TAB TERAKHIR: user tidak perlu navigasi ulang setiap buka aplikasi.
    // Tab lama era 5 tab ('izin'/'lembur') dipetakan ke tab Pengajuan.
    try {
      const t = localStorage.getItem('absenku-tab')
      if (t === 'izin' || t === 'lembur') return 'pengajuan'
      return ['dashboard', 'pengajuan', 'riwayat', 'notifikasi', 'profil', 'admin'].includes(t) ? t : 'dashboard'
    } catch {
      return 'dashboard'
    }
  })
  // Sub-halaman tab Pengajuan: 'izin' (Izin/Cuti) atau 'lembur'. Disimpan agar
  // aplikasi dibuka kembali di sub-halaman yang terakhir dipakai.
  const [jenisPengajuan, setJenisPengajuan] = useState(() => {
    try {
      return localStorage.getItem('absenku-pengajuan') === 'lembur' ? 'lembur' : 'izin'
    } catch {
      return 'izin'
    }
  })
  const [toast, setToast] = useState(null)

  // Otak tombol Back Android (dipanggil native lewat window.__nubsenBack →
  // __nubsenHandleBack). Didaftarkan ulang tiap state berubah supaya SELALU
  // membaca halaman terbaru. Mengembalikan '1' bila web menangani sendiri:
  //   1) tutup modal/sheet terbuka   2) halaman lain → kembali ke Beranda
  //   3) di Beranda / layar login → keluar aplikasi LANGSUNG tanpa dialog.
  useEffect(() => {
    window.__nubsenHandleBack = () => {
      try {
        if (tutupTeratas()) return '1'
        if (!authSiap) return '' // web belum siap → native menutup aplikasi
        if (!authUser) {
          // Layar login: keluar langsung, tanpa dialog konfirmasi.
          keluarAplikasi()
          return '1'
        }
        if (view !== 'dashboard') {
          setView('dashboard')
          window.scrollTo({ top: 0 })
          return '1'
        }
        // Sudah di Beranda: tutup aplikasi seketika saat Back ditekan.
        keluarAplikasi()
        return '1'
      } catch {
        return '' // galat apa pun → native menutup aplikasi
      }
    }
    return () => {
      delete window.__nubsenHandleBack
    }
  }, [authSiap, authUser, view])

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
    const VIEW_SAH = ['dashboard', 'pengajuan', 'riwayat', 'notifikasi', 'profil', 'admin']
    const dariHash = () => {
      const v = window.location.hash.replace(/^#\/?/, '')
      // Hash era 5 tab (#izin / #lembur) tetap berfungsi → dibuka sebagai tab
      // Pengajuan dengan sub-halaman sesuai hash-nya.
      if (v === 'izin' || v === 'lembur') {
        setJenisPengajuan(v === 'lembur' ? 'lembur' : 'izin')
        setView('pengajuan')
      } else if (VIEW_SAH.includes(v)) {
        setView(v)
      }
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

  // Simpan sub-halaman Pengajuan yang terakhir dipakai.
  useEffect(() => {
    try {
      localStorage.setItem('absenku-pengajuan', jenisPengajuan)
    } catch { /* abaikan */ }
  }, [jenisPengajuan])

  // Akun non-admin tidak boleh membuka halaman Admin walau mengetik #admin.
  useEffect(() => {
    if (view === 'admin' && authUser && !authUser.isAdmin) setView('dashboard')
  }, [view, authUser])

  const handleLogin = (karyawan) => setAuthUser(karyawan)

  // Buka tab Pengajuan langsung pada sub-halaman tertentu ('izin' | 'lembur') —
  // dipakai pintasan izin di Beranda dan hash #izin / #lembur.
  const bukaPengajuan = (jenis = 'izin') => {
    setJenisPengajuan(jenis)
    setView('pengajuan')
  }

  // FAB "kembali ke atas" — muncul saat halaman sudah discroll jauh.
  const [scrollJauh, setScrollJauh] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrollJauh(window.scrollY > 500)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
          src="/logo-mark.png"
          alt="Logo NUBSEN"
          className="animate-pulse-slow h-28 w-auto"
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

  // Panel Admin — mode layar penuh (tanpa bottom-nav) supaya di ponsel tidak ada
  // dua navigasi yang saling berebut ruang. Panel sudah punya tombol "Kembali"
  // sendiri di header-nya; padding bawah hanya menyisakan safe-area iOS.
  if (view === 'admin' && authUser.isAdmin)
    return (
      <div className="mx-auto min-h-full w-full max-w-md overflow-x-clip px-3 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-4 sm:px-4">
        <Admin user={authUser} onBack={() => setView('dashboard')} />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    )

  const tampilkanToast = (pesan, type = 'success') => setToast({ pesan, type })

  // Hasil sinkron antrean luring → toast + muat ulang data dari server.
  // Event 'absenku:tersinkron' juga disiarkan agar halaman lain (riwayat izin &
  // lembur di tab Pengajuan) ikut menarik ulang datanya.
  jalankanSinkron.current = (h) => {
    tampilkanToast(
      h.terkirim > 0
        ? `✅ ${h.terkirim} data tersinkron ke server${h.gagal ? ` • ${h.gagal} ditolak` : ''}`
        : `⚠️ ${h.gagal} data ditolak server`,
      h.terkirim > 0 ? 'success' : 'warn',
    )
    window.dispatchEvent(new CustomEvent('absenku:tersinkron', { detail: h }))
    if (h.terkirim > 0) muatUlang()
  }

  const handleCheckIn = async ({ jam, lokasi, selfie }) => {
    try {
      const rec = await catatCheckIn({ jam, lokasi, selfie })
      // Luring: tersimpan di antrean perangkat + UI optimistik — bukan gagal.
      if (rec?.luring) {
        tampilkanToast('📴 Luring — absen disimpan di perangkat, dikirim otomatis saat online', 'warn')
        return
      }
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
      if (rec?.luring) {
        tampilkanToast('📴 Luring — check-out disimpan, dikirim otomatis saat online', 'warn')
        return
      }
      tampilkanToast(`Check-out berhasil pukul ${rec?.checkOut || jam}. Sampai jumpa! 👋`)
    } catch (e) {
      tampilkanToast(e.message, 'error')
    }
  }

  const handleIzin = async (form) => {
    try {
      const r = await ajukanIzin(form)
      if (r?.luring) {
        tampilkanToast('📴 Luring — izin disimpan di perangkat, dikirim otomatis saat online', 'warn')
        return r // { luring: true } dipakai Izin untuk entri optimistik di riwayat
      }
      tampilkanToast('Pengajuan izin berhasil dikirim 📤')
      return r
    } catch (e) {
      tampilkanToast(e.message, 'error')
      return null
    }
  }

  return (
    <div className="mx-auto min-h-full w-full max-w-md overflow-x-clip px-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-4">
      {/* Header — sticky: brand & aksi selalu terlihat saat discroll. Latar SOLID
          (bukan glass transparan) supaya kartu biru di belakang tidak tembus dan
          menimpa logo/nama saat halaman digulir. Padding atas aman dari notch. */}
      <header
        className={`sticky top-0 z-30 -mx-3 mb-5 flex items-center justify-between gap-3 border-b bg-slate-100 px-3 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] transition-shadow dark:bg-slate-950 sm:-mx-4 sm:px-4 ${
          scrollJauh
            ? 'border-slate-200/80 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.55)] dark:border-slate-800/80'
            : 'border-transparent'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src="/logo-icon.png"
            alt="Logo NUBSEN"
            className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
          />
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold leading-none tracking-tight">NUBSEN</p>
            <p className="truncate text-[10px] font-medium text-slate-400">Cukup Satu Klik!</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Status luring / antrean sinkron — ketuk untuk sinkron manual */}
          {(!online || antrean > 0) && (
            <button
              onClick={sinkronManual}
              title={
                online
                  ? `${antrean} data menunggu — ketuk untuk sinkron sekarang`
                  : `Perangkat luring — ${antrean > 0 ? `${antrean} data menunggu, ` : ''}dikirim otomatis saat online`
              }
              className={`flex h-11 items-center gap-1.5 rounded-2xl border px-3 text-xs font-bold shadow-sm transition active:scale-90 ${
                online
                  ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300'
                  : 'border-slate-200 bg-white/80 text-slate-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300'
              }`}
            >
              {online ? (
                menyinkron ? <RefreshCw size={15} className="animate-spin" /> : <CloudUpload size={15} />
              ) : (
                <WifiOff size={15} />
              )}
              {/* Luring juga menampilkan jumlah antrean supaya user tahu ada data
                  miliknya yang belum terkirim (bukan hanya "mode offline" saja). */}
              {online ? (antrean > 0 ? `${antrean} antre` : 'Sinkron') : `Luring${antrean > 0 ? ` · ${antrean}` : ''}`}
            </button>
          )}
          {/* Pintu masuk Panel Admin (hanya akun admin) — dulu berupa tab ke-6 di
              bottom-nav yang membuat bar sesak di ponsel; kini tombol ringkas di header. */}
          {authUser?.isAdmin && (
            <button
              onClick={() => setView('admin')}
              aria-label="Buka Panel Admin"
              title="Panel Admin"
              className="grid h-11 w-11 place-items-center rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-600 shadow-sm transition active:scale-90 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300"
            >
              <ShieldCheck size={20} />
            </button>
          )}
          <NotifikasiBell onClick={() => setView('notifikasi')} />
          <DarkModeToggle dark={dark} toggle={toggle} />
        </div>
      </header>

      <InstallPrompt />

      {/* FAB kembali ke atas — di atas bottom-nav, tidak menghalangi tombol apa pun */}
      {scrollJauh && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Kembali ke atas"
          className="animate-fade-in fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom))] right-4 z-30 grid h-11 w-11 place-items-center rounded-2xl border border-slate-200/70 bg-white/95 text-indigo-600 shadow-lg backdrop-blur transition active:scale-90 dark:border-slate-700/70 dark:bg-slate-900/95 dark:text-indigo-300"
        >
          <ArrowUp size={18} />
        </button>
      )}

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
                goToIzin={() => bukaPengajuan('izin')}
              />
            )}
            {view === 'pengajuan' && (
              <Pengajuan
                jenis={jenisPengajuan}
                onJenis={setJenisPengajuan}
                onSubmit={handleIzin}
                sisaCuti={user?.sisaCuti ?? null}
                toast={tampilkanToast}
              />
            )}
            {view === 'riwayat' && <Riwayat history={history} />}
            {view === 'notifikasi' && <Notifikasi />}
            {view === 'profil' && <Profil user={user || USER_DEFAULT} history={history} onLogout={handleLogout} toast={tampilkanToast} />}
          </>
        )}
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />
      <BottomNav active={view} onChange={setView} />
    </div>
  )
}

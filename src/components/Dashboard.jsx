import { useEffect, useState } from 'react'
import { MapPin, LogIn, LogOut, Navigation, Clock3, Loader2, CalendarCheck2, Bell, Copy, Check } from 'lucide-react'
import { formatJam, formatTanggalLengkap, sapaanWaktu, durasiKerja } from '../utils/date'
import { ambilLokasi, statusGeofence, KANTOR } from '../utils/geo'
import StatusBadge from './StatusBadge'
import SelfieModal from './SelfieModal'
import KartuStatistik from './Statistik'
import usePengingat from '../hooks/usePengingat'
import { JADWAL_DEFAULT } from '../hooks/useAbsensi'

export default function Dashboard({ user, today, history = [], onCheckIn, onCheckOut, goToIzin, jadwal = JADWAL_DEFAULT }) {
  const [now, setNow] = useState(new Date())
  const [modal, setModal] = useState(null) // 'in' | 'out' | null
  const [lokasi, setLokasi] = useState(null)
  const [cariLokasi, setCariLokasi] = useState(false)
  const [lokasiError, setLokasiError] = useState(null)
  const [tersalin, setTersalin] = useState(false)
  const { jamMasukBatas, jamPulang } = jadwal // jadwal kerja aktif dari server
  const { aktif: pengingatAktif, toggle: togglePengingat } = usePengingat(today, jamPulang, jamMasukBatas)

  // Getaran haptic (Android/HP fisik) — feedback taktil ala aplikasi native
  const getar = (pola = 30) => {
    try { navigator.vibrate?.(pola) } catch { /* tak didukung */ }
  }

  const salinKoordinat = async () => {
    if (!lokasi) return
    try {
      await navigator.clipboard.writeText(`${lokasi.lat}, ${lokasi.lon}`)
      setTersalin(true)
      getar(15)
      setTimeout(() => setTersalin(false), 2000)
    } catch { /* clipboard ditolak browser */ }
  }

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const muatLokasi = async () => {
    setCariLokasi(true)
    setLokasiError(null)
    try {
      setLokasi(await ambilLokasi())
    } catch {
      setLokasiError('Gagal mengambil lokasi. Aktifkan izin GPS pada browser.')
    } finally {
      setCariLokasi(false)
    }
  }

  // Ambil lokasi otomatis saat halaman dibuka
  useEffect(() => {
    muatLokasi()
  }, [])

  const prosesAbsen = async (mode) => {
    getar(30)
    if (!lokasi) await muatLokasi()
    setModal(mode)
  }

  const selesaiSelfie = (selfie) => {
    getar([50, 40, 50]) // pola sukses ala aplikasi native
    const jam = formatJam(new Date()).slice(0, 5)
    if (modal === 'in') onCheckIn({ jam, lokasi, selfie })
    else onCheckOut({ jam, lokasi, selfie })
    setModal(null)
  }

  const sudahMasuk = !!today.checkIn
  const sudahPulang = !!today.checkOut

  // Countdown live — pakai jadwal kerja aktif dari server (jam masuk batas & jam pulang)
  const toDetik = (hhmm) => {
    const [j, m] = (hhmm || '00:00').split(':').map(Number)
    return j * 3600 + m * 60
  }
  const detikKini = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  let countdown = null
  if (!sudahMasuk) {
    const sisa = toDetik(jamMasukBatas) - detikKini
    countdown =
      sisa > 0
        ? { judul: `⏳ Batas absen masuk (${jamMasukBatas})`, sisa, warna: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' }
        : { judul: '⚠️ Batas masuk terlewat — check-in tercatat Terlambat', sisa: 0, warna: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' }
  } else if (!sudahPulang) {
    const sisa = toDetik(jamPulang) - detikKini
    countdown =
      sisa > 0
        ? { judul: `🏃 Estimasi jam pulang (${jamPulang})`, sisa, warna: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' }
        : { judul: '🎉 Waktunya pulang! Jangan lupa check-out', sisa: 0, warna: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' }
  }
  const formatSisa = (s) =>
    [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':')

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Sapaan + tanggal */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{sapaanWaktu(now)}, 👋</p>
          <h1 className="text-xl font-extrabold tracking-tight">{user.nama}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <CalendarCheck2 size={14} /> {formatTanggalLengkap(now)}
          </p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 px-3.5 py-2 text-right text-white shadow-lg shadow-indigo-500/30">
          <Clock3 size={14} className="ml-auto opacity-80" />
          <p className="font-mono text-lg font-bold leading-none">{formatJam(now)}</p>
        </div>
      </div>

      {/* Kartu status kehadiran */}
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Status Kehadiran Hari Ini</h2>
          <StatusBadge status={today.status} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
            <div className="mb-1 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <LogIn size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">Jam Masuk</span>
            </div>
            <p className="font-mono text-2xl font-bold">{today.checkIn || '—:—'}</p>
            <p className="text-[11px] text-slate-400">Batas: {jamMasukBatas}</p>
          </div>
          <div className="rounded-2xl bg-rose-50 p-4 dark:bg-rose-500/10">
            <div className="mb-1 flex items-center gap-1.5 text-rose-500 dark:text-rose-400">
              <LogOut size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">Jam Pulang</span>
            </div>
            <p className="font-mono text-2xl font-bold">{today.checkOut || '—:—'}</p>
            <p className="text-[11px] text-slate-400">
              {sudahMasuk && sudahPulang ? durasiKerja(today.checkIn, today.checkOut) : '\u00A0'}
            </p>
          </div>
        </div>
        {today.diLuarArea != null && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2.5 py-1 font-semibold ${
                today.diLuarArea
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
              }`}
            >
              {today.diLuarArea
                ? `⚠️ Absen di luar area kantor (±${today.jarak} m)`
                : `✓ Absen di area kantor (±${today.jarak} m)`}
            </span>
          </div>
        )}
      </div>

      {/* Countdown batas absen */}
      {countdown && (
        <div className={`flex items-center justify-between rounded-2xl px-4 py-3 ${countdown.bg}`}>
          <span className={`text-xs font-semibold ${countdown.warna}`}>{countdown.judul}</span>
          {countdown.sisa > 0 && (
            <span className={`font-mono text-lg font-bold ${countdown.warna}`}>{formatSisa(countdown.sisa)}</span>
          )}
        </div>
      )}

      {/* Tombol absen utama */}
      <div className="flex flex-col items-center gap-3 py-2">
        {sudahPulang ? (
          <div className="rounded-3xl bg-emerald-100 px-8 py-4 text-center dark:bg-emerald-500/15">
            <p className="font-bold text-emerald-700 dark:text-emerald-400">Absensi hari ini lengkap ✅</p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80">Terima kasih, hati-hati di perjalanan!</p>
          </div>
        ) : (
          <button
            onClick={() => prosesAbsen(sudahMasuk ? 'out' : 'in')}
            className="animate-pulse-slow grid h-40 w-40 place-items-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-white shadow-xl shadow-indigo-500/40 transition active:scale-95"
          >
            <div className="text-center">
              <span className="block text-3xl">{sudahMasuk ? '🏃' : '✋'}</span>
              <span className="mt-1 block text-base font-extrabold">
                {sudahMasuk ? 'Absen Pulang' : 'Absen Sekarang'}
              </span>
              <span className="text-[10px] font-medium opacity-80">Selfie + GPS</span>
            </div>
          </button>
        )}
      </div>

      {/* Statistik mingguan: streak + grafik 7 hari */}
      <KartuStatistik history={history} />

      {/* Kartu lokasi GPS */}
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
            <MapPin size={16} className="text-indigo-500" /> Lokasi Anda
          </h2>
          <button
            onClick={muatLokasi}
            className="flex items-center gap-1 rounded-xl bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition active:scale-95 dark:bg-indigo-500/15 dark:text-indigo-400"
          >
            {cariLokasi ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
            {cariLokasi ? 'Mencari…' : 'Perbarui'}
          </button>
        </div>
        {lokasi ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-sm font-semibold">
                {lokasi.lat}, {lokasi.lon}
              </p>
              <button
                onClick={salinKoordinat}
                title="Salin koordinat"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 transition active:scale-90 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {tersalin ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              </button>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {lokasi.alamat || 'Alamat tidak tersedia (luring)'} • ±{lokasi.accuracy} m
            </p>
            {(() => {
              const g = statusGeofence(lokasi.lat, lokasi.lon)
              if (!g) return null
              return (
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      g.diLuarArea
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                    }`}
                  >
                    {g.diLuarArea ? '⚠️ Di luar area' : '✓ Di area kantor'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ±{g.jarak} m dari {KANTOR.nama} • {KANTOR.alamat}
                  </span>
                </div>
              )
            })()}
          </>
        ) : (
          <p className="text-xs text-slate-400">{lokasiError || 'Mengambil lokasi…'}</p>
        )}
      </div>

      {/* Pengingat notifikasi */}
      <div className="card flex items-center justify-between !py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <Bell size={16} />
          </span>
          <div>
            <p className="text-xs font-bold">Pengingat Absen</p>
            <p className="text-[10px] text-slate-400">Notifikasi dinamis sesuai jadwal kerja</p>
          </div>
        </div>
        <button
          onClick={togglePengingat}
          className={`relative h-6 w-11 rounded-full transition ${pengingatAktif ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
          aria-label="Aktifkan/nonaktifkan pengingat"
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${pengingatAktif ? 'left-[1.375rem]' : 'left-0.5'}`}
          />
        </button>
      </div>

      {/* Shortcut izin */}
      <button
        onClick={goToIzin}
        className="flex w-full items-center justify-between rounded-3xl border border-dashed border-indigo-300 bg-indigo-50/60 p-4 text-left transition active:scale-[0.98] dark:border-indigo-500/40 dark:bg-indigo-500/10"
      >
        <div>
          <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Sakit / Izin / Cuti?</p>
          <p className="text-xs text-indigo-500/80 dark:text-indigo-400/80">Ajukan sekarang, tanpa kertas.</p>
        </div>
        <span className="text-xl">📄</span>
      </button>

      <SelfieModal open={!!modal} mode={modal} onClose={() => setModal(null)} onCapture={selesaiSelfie} lokasi={lokasi} namaUser={user.nama} />
    </div>
  )
}





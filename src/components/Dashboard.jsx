import { useEffect, useState } from 'react'
import { MapPin, LogIn, LogOut, Navigation, Clock3, Loader2, CalendarCheck2, Bell, Copy, Check, TriangleAlert } from 'lucide-react'
import { formatJam, formatTanggalLengkap, formatTanggalPendek, sapaanWaktu, durasiKerja, toISODate } from '../utils/date'
import { ambilCuaca, sapaanCuaca } from '../utils/cuaca'
import { detailLibur, labelJenisPendek, liburBerikutnya } from '../utils/liburIndonesia'
import { ambilLokasi, statusGeofence, KANTOR, pesanErrorLokasi } from '../utils/geo'
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
  // Cuaca terkini (Open-Meteo): ikon + suhu + UV di kartu jam. Dimuat sekali
  // saat halaman dibuka; gagal/tanpa internet → badge tetap tampil (fallback
  // animasi matahari/bulan) tanpa info suhu.
  const [cuaca, setCuaca] = useState(null)
  useEffect(() => {
    let batal = false
    ambilCuaca()
      .then((c) => !batal && setCuaca(c))
      .catch(() => { /* luring: biarkan null */ })
    return () => { batal = true }
  }, [])

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
    } catch (err) {
      setLokasiError(pesanErrorLokasi(err))
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
  // Inisial nama untuk avatar kekinian di sapaan.
  const inisial = (user.nama || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // --- Hari libur / non-kerja (banner Beranda + strip "libur berikutnya") ---
  // Hari kerja mengikuti jadwal admin (hariKerja: 0 = Minggu … 6 = Sabtu);
  // tanggal merah (libur nasional/cuti bersama) dihitung bukan hari kerja.
  const hariIniIso = toISODate(now)
  const liburHariIni = detailLibur(hariIniIso)
  const hariKerjaSet = Array.isArray(jadwal.hariKerja) && jadwal.hariKerja.length ? jadwal.hariKerja : [1, 2, 3, 4, 5]
  const bukanHariKerja = !!liburHariIni || !hariKerjaSet.includes(now.getDay())
  const liburDepan = bukanHariKerja ? null : liburBerikutnya(now)

  // Countdown live — pakai jadwal kerja aktif dari server (jam masuk batas & jam pulang)
  const toDetik = (hhmm) => {
    const [j, m] = (hhmm || '00:00').split(':').map(Number)
    return j * 3600 + m * 60
  }
  const detikKini = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  let countdown = null
  // Di hari libur/non-kerja tidak ada countdown masuk — "batas terlewat" di hari
  // Minggu/libur justru menyesatkan (tidak ada kewajiban absen hari itu).
  if (!sudahMasuk && !bukanHariKerja) {
    const sisa = toDetik(jamMasukBatas) - detikKini
    countdown =
      sisa > 0
        ? { judul: `⏳ Batas absen masuk (${jamMasukBatas})`, sisa, total: toDetik(jamMasukBatas), warna: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' }
        : { judul: '⚠️ Batas masuk terlewat — check-in tercatat Terlambat', sisa: 0, total: 0, warna: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' }
  } else if (!sudahPulang) {
    const sisa = toDetik(jamPulang) - detikKini
    const total = Math.max(1, toDetik(jamPulang) - toDetik(jamMasukBatas))
    countdown =
      sisa > 0
        ? { judul: `🏃 Estimasi jam pulang (${jamPulang})`, sisa, total, warna: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' }
        : { judul: '🎉 Waktunya pulang! Jangan lupa check-out', sisa: 0, total: 0, warna: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' }
  }
  const formatSisa = (s) =>
    [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':')

  // Durasi kerja live (sejak check-in) — pill "Sedang bekerja" di kartu status.
  let durasiBekerja = null
  if (sudahMasuk && !sudahPulang && today.checkIn) {
    const [h1, m1] = today.checkIn.split(':').map(Number)
    const totalMenit = Math.max(0, Math.floor((detikKini - (h1 * 3600 + m1 * 60)) / 60))
    durasiBekerja = `${Math.floor(totalMenit / 60)} jam ${totalMenit % 60} mnt`
  }

  // --- Jam live (kartu hero beranda) ---
  const p2 = (n) => String(n).padStart(2, '0')
  const jamHero = p2(now.getHours())
  const menitHero = p2(now.getMinutes())
  const detikHero = p2(now.getSeconds())

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Sapaan: avatar inisial + nama. Tanggal TIDAK lagi nempel sebagai chip
          kecil di bawah nama (dulu posisinya menyempil di ujung blok sapaan dan
          saat halaman digulir chip putih itu lewat tepat di bawah header sticky —
          tampak seperti "tertimpa"). Kini tanggal menyatu dengan kartu jam di
          bawah, jadi tanggal & jam selalu satu tempat. */}
      <div className="animate-rise flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/30">
          {inisial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-slate-400">
            {sapaanWaktu(now)}, 👋
            {sapaanCuaca(cuaca) && <span className="hidden sm:inline"> · {sapaanCuaca(cuaca)}</span>}
          </p>
          <h1 className="truncate text-lg font-extrabold tracking-tight">{user.nama}</h1>
          {/* Sapaan cuaca versi ponsel sempit — baris sendiri (tidak memotong nama) */}
          {sapaanCuaca(cuaca) && <p className="truncate text-[11px] text-indigo-500/80 sm:hidden dark:text-indigo-400/80">{sapaanCuaca(cuaca)}</p>}
        </div>
      </div>

      {/* Jam live — kartu utama beranda: jam besar, detik berjalan, bar progres */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-5 text-white shadow-xl shadow-indigo-500/30">
        <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 h-32 w-32 rounded-full bg-fuchsia-300/25 blur-2xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">
              <Clock3 size={12} /> Waktu Saat Ini
            </p>
            <p className="mt-1.5 font-mono text-[2.6rem] font-extrabold leading-none tracking-tight tabular-nums">
              {jamHero}:{menitHero}
              <span className="ml-1 text-lg font-bold text-white/60">:{detikHero}</span>
            </p>
            <div className="mt-3 h-1 w-32 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white/90 transition-[width] duration-1000 ease-linear"
                style={{ width: `${(Number(detikHero) / 59) * 100}%` }}
              />
            </div>
            {/* Tanggal hari ini — satu tempat dengan jam ("Waktu Saat Ini"),
                jadi tidak ada lagi chip tanggal yang menyempil di bawah nama. */}
            <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
              <CalendarCheck2 size={12} className="shrink-0" />
              <span className="truncate">{formatTanggalLengkap(now)}</span>
            </p>
          </div>
          <div className="shrink-0 rounded-2xl bg-white/15 px-3 py-2.5 text-center backdrop-blur-sm">
            {/* Ikon cuaca statis (tanpa animasi). Malam hari + cerah → bulan. */}
            <p className="text-[2.5rem] leading-none">
              {cuaca ? (cuaca.jenis === 'cerah' && !cuaca.siang ? '🌙' : cuaca.ikon) : now.getHours() >= 6 && now.getHours() < 18 ? '☀️' : '🌙'}
            </p>
            <p className="mt-1.5 whitespace-nowrap text-[11px] font-semibold text-white/85">
              {cuaca ? cuaca.label : sapaanWaktu(now).replace('Selamat ', '')}
            </p>
            {/* Info cuaca: suhu + UV (hilang dengan sendirinya saat luring) */}
            {cuaca && (
              <p className="mt-0.5 whitespace-nowrap text-[10px] font-semibold text-white/70">
                {cuaca.suhu}°C · UV {cuaca.uv}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Hari libur / bukan hari kerja — menggantikan countdown agar tidak
          muncul "batas masuk terlewat" yang menyesatkan di hari non-kerja. */}
      {bukanHariKerja && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
            {liburHariIni
              ? `🎉 Hari ini libur — ${liburHariIni.nama} (${labelJenisPendek(liburHariIni.jenis)})`
              : '🍃 Hari ini bukan hari kerja — nikmati waktu istirahatmu'}
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
            Tidak wajib absen. Bila tetap bekerja, absenmu tercatat sebagai "Hadir Libur".
          </p>
        </div>
      )}

      {/* Kartu status kehadiran */}
      <div className="card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-sm font-bold text-slate-700 dark:text-slate-200">Status Kehadiran Hari Ini</h2>
          <StatusBadge status={today.status} />
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <div className="min-w-0 rounded-2xl bg-emerald-50 p-3.5 transition hover:-translate-y-0.5 dark:bg-emerald-500/10 sm:p-4">
            <span className="mb-2 inline-grid h-8 w-8 place-items-center rounded-xl bg-white/80 text-emerald-600 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-400">
              <LogIn size={15} />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/70 dark:text-emerald-400/80">Jam Masuk</p>
            <p className="font-mono text-xl font-bold sm:text-2xl">{today.checkIn || '—:—'}</p>
            <p className="text-[11px] text-slate-400">Batas: {jamMasukBatas}</p>
          </div>
          <div className="rounded-2xl bg-rose-50 p-3.5 transition hover:-translate-y-0.5 dark:bg-rose-500/10 sm:p-4">
            <span className="mb-2 inline-grid h-8 w-8 place-items-center rounded-xl bg-white/80 text-rose-500 shadow-sm dark:bg-rose-500/20 dark:text-rose-400">
              <LogOut size={15} />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600/70 dark:text-rose-400/80">Jam Pulang</p>
            <p className="font-mono text-xl font-bold sm:text-2xl">{today.checkOut || '—:—'}</p>
            <p className="text-[11px] text-slate-400">
              {sudahMasuk && sudahPulang ? durasiKerja(today.checkIn, today.checkOut) : '\u00A0'}
            </p>
          </div>
        </div>
        {/* Garis waktu: Masuk → Bekerja → Pulang */}
        <div className="mt-3.5 flex items-center">
          {[['Masuk', sudahMasuk], ['Bekerja', sudahMasuk && !sudahPulang], ['Pulang', sudahPulang]].map(([label, aktif], i) => (
            <div key={label} className={`flex items-center ${i < 2 ? 'flex-1' : ''}`}>
              <div className="flex shrink-0 flex-col items-center">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ${
                    aktif
                      ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/40'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                  }`}
                >
                  {aktif ? '✓' : i + 1}
                </span>
                <span className={`mt-1 text-[10px] font-semibold ${aktif ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>{label}</span>
              </div>
              {i < 2 && (
                <div
                  className={`mx-1.5 mb-4 h-0.5 flex-1 rounded ${
                    i === 0 && sudahMasuk
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-600'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        {/* Pill "Sedang bekerja" — durasi live sejak check-in, berdetik tiap detik */}
        {durasiBekerja && (
          <div className="mt-3 flex justify-center">
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              ⏱️ Sedang bekerja {durasiBekerja}
            </span>
          </div>
        )}
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

      {/* Countdown batas absen — dengan bar progres yang mengecil mendekati batas */}
      {countdown && (
        <div className={`rounded-2xl px-4 py-3 ${countdown.bg}`}>
          <div className="flex items-center justify-between gap-3">
            <span className={`min-w-0 truncate text-xs font-semibold ${countdown.warna}`}>{countdown.judul}</span>
            {countdown.sisa > 0 && (
              <span className={`shrink-0 font-mono text-lg font-bold ${countdown.warna}`}>{formatSisa(countdown.sisa)}</span>
            )}
          </div>
          {countdown.sisa > 0 && countdown.total > 0 && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
              <div
                className={`h-full rounded-full bg-current transition-[width] duration-1000 ease-linear ${countdown.warna}`}
                style={{ width: `${Math.max(2, Math.min(100, (countdown.sisa / countdown.total) * 100))}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Info libur berikutnya — hitungan mundur menuju tanggal merah */}
      {!bukanHariKerja && liburDepan && (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-white px-4 py-2.5 shadow-soft ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-700/60">
          <span className="min-w-0 truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            🗓️ Libur berikutnya: <span className="font-bold">{liburDepan.nama}</span> · {formatTanggalPendek(liburDepan.tanggal)}
          </span>
          <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
            {liburDepan.hariLagi === 0 ? 'Hari ini' : liburDepan.hariLagi === 1 ? 'Besok' : `${liburDepan.hariLagi} hari lagi`}
          </span>
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
          <div className="relative">
            {/* Cincin putus-putus berputar di sekeliling tombol — aksen kekinian */}
            <span aria-hidden className="animate-spin-slower absolute -inset-3 rounded-full border-2 border-dashed border-indigo-300/70 dark:border-indigo-500/40" />
            <button
              onClick={() => prosesAbsen(sudahMasuk ? 'out' : 'in')}
              className="animate-pulse-slow relative grid h-40 w-40 place-items-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-white shadow-xl shadow-indigo-500/40 transition active:scale-95"
            >
              <div className="text-center">
                <span className="block text-3xl">{sudahMasuk ? '🏃' : '✋'}</span>
                <span className="mt-1 block text-base font-extrabold">
                  {sudahMasuk ? 'Absen Pulang' : 'Absen Sekarang'}
                </span>
                <span className="text-[10px] font-medium opacity-80">Selfie + GPS</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Statistik mingguan: streak + grafik 7 hari */}
      <KartuStatistik history={history} jadwal={jadwal} />

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

        {/* Kegagalan GPS ditampilkan sebagai peringatan yang mencolok. Sebelumnya
            pesan ini hanya muncul bila koordinat belum ada, sehingga kegagalan
            "Perbarui" (koordinat lama masih tampil) tenggelam tanpa pemberitahuan. */}
        {lokasiError && (
          <div className="mb-2 flex items-start gap-2 rounded-xl bg-amber-50 p-2.5 text-[11px] font-medium leading-relaxed text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            <span>{lokasiError}</span>
          </div>
        )}

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
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      g.diLuarArea
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                    }`}
                  >
                    {g.diLuarArea ? '⚠️ Di luar area' : '✓ Di area kantor'}
                  </span>
                  <span className="min-w-0 break-words text-[11px] text-slate-400">
                    ±{g.jarak} m dari {KANTOR.nama} • {KANTOR.alamat}
                  </span>
                </div>
              )
            })()}
          </>
        ) : (
          <p className="text-xs text-slate-400">{cariLokasi ? 'Mencari lokasi…' : 'Mengambil lokasi…'}</p>
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





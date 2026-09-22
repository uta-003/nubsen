import { useEffect, useRef, useState } from 'react'
import { Camera, RotateCcw, Check, X, ScanFace } from 'lucide-react'
import { KANTOR, statusGeofence } from '../utils/geo'
import { usePenutupKembali } from '../hooks/useTombolKembali'

/**
 * Mock-up verifikasi wajah + GeoTag Image (ala GeoTagImage/GTI):
 * setiap foto selfie di-stamp otomatis dengan koordinat GPS, alamat,
 * jarak ke kantor, waktu capture, dan nama pengambil — tertulis permanen di gambar.
 */
export default function SelfieModal({ open, mode = 'in', onClose, onCapture, lokasi = null, namaUser = '' }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [wajahTerdeteksi, setWajahTerdeteksi] = useState(false)

  const bukaKamera = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      // Mock "face detection": setelah 1,4 detik tampilkan badge terdeteksi
      setTimeout(() => setWajahTerdeteksi(true), 1400)
    } catch {
      setError('Tidak dapat mengakses kamera. Izinkan akses kamera di browser Anda.')
    }
  }

  useEffect(() => {
    if (open) {
      setPhoto(null)
      setWajahTerdeteksi(false)
      bukaKamera()
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [open])

  const jepret = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    // mirror agar terasa seperti kamera selfie
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    gambarGeoTag(ctx, canvas.width, canvas.height)
    setPhoto(canvas.toDataURL('image/jpeg', 0.85))
  }

  // ===== GeoTag Image (GTI) =====
  // Stempel ala library Android GeoTagImage: kartu semi-transparan di kiri bawah
  // foto berisi lokasi + waktu + author. Tertulis permanen di file gambar.
  const gambarGeoTag = (ctx, w, h) => {
    const s = Math.max(10, Math.round(w / 30)) // skala teks mengikuti lebar foto
    const lh = Math.round(s * 1.45)
    const pad = Math.round(s * 0.8)
    const jam = new Date()
    const dua = (n) => String(n).padStart(2, '0')
    const waktu = `${jam.getFullYear()}-${dua(jam.getMonth() + 1)}-${dua(jam.getDate())} ${dua(jam.getHours())}:${dua(jam.getMinutes())}:${dua(jam.getSeconds())}`

    const g = lokasi ? statusGeofence(lokasi.lat, lokasi.lon) : null
    const alamat = (lokasi?.alamat || KANTOR.alamat || 'Alamat tidak tersedia').slice(0, 48)
    const baris = [
      `📍 GPS : ${lokasi ? `${lokasi.lat}, ${lokasi.lon}` : 'tidak tersedia'}`,
      `🏠 Alamat : ${alamat}`,
      g ? `🏢 ${KANTOR.nama} — ${KANTOR.alamat} • ±${g.jarak} m` : `🏢 Kantor : ${KANTOR.nama} — ${KANTOR.alamat}`,
      `📅 Waktu : ${waktu}`,
      `📸 Captured by ${namaUser || 'Karyawan'} • NUBSEN`,
    ]

    ctx.font = `${s}px Inter, system-ui, sans-serif`
    const lebarTeks = Math.max(...baris.map((t) => ctx.measureText(t).width))
    const kartuW = Math.min(w - pad * 2, lebarTeks + pad * 2)
    const kartuH = baris.length * lh + pad * 2
    const x = pad
    const y = h - kartuH - pad
    const r = Math.round(s * 0.8)

    // kartu latar semi-transparan navy (rounded)
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(x, y, kartuW, kartuH, r)
    else {
      ctx.moveTo(x + r, y)
      ctx.arcTo(x + kartuW, y, x + kartuW, y + kartuH, r)
      ctx.arcTo(x + kartuW, y + kartuH, x, y + kartuH, r)
      ctx.arcTo(x, y + kartuH, x, y, r)
      ctx.arcTo(x, y, x + kartuW, y, r)
      ctx.closePath()
    }
    ctx.fillStyle = 'rgba(10, 29, 87, 0.72)' // #0A1D57 transparan
    ctx.fill()

    // teks putih
    ctx.fillStyle = '#FFFFFF'
    ctx.textBaseline = 'top'
    baris.forEach((t, i) => ctx.fillText(t, x + pad, y + pad + i * lh))
  }

  const konfirmasi = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    onCapture(photo)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-sm animate-fade-in sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-[2.25rem] border border-white/60 bg-white/95 p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95 sm:rounded-[2.25rem] sm:pb-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30">
              <ScanFace size={20} />
            </span>
            <div>
              <h3 className="font-bold">Verifikasi Selfie</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'in' ? 'Absen Masuk' : 'Absen Pulang'} — pastikan wajah terlihat jelas
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              streamRef.current?.getTracks().forEach((t) => t.stop())
              onClose()
            }}
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[1.75rem] bg-slate-950 shadow-inner">
          {photo ? (
            <img src={photo} alt="Selfie" className="h-full w-full object-cover" />
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" />
              {/* ===== Bingkai berbentuk WAJAH (bukan oval) =====
                  Siluet kepala: dahi & pelipis lebar, pipi penuh, dagu meruncing.
                  Path genap-ganjil (evenodd): persegi penuh + siluet = lubang gelap
                  di luar wajah ala Face ID, wajah user tetap terlihat jelas. */}
              <svg
                viewBox="0 0 300 400"
                preserveAspectRatio="xMidYMid slice"
                className="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden
              >
                <defs>
                  <linearGradient id="wajahGaris" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="50%" stopColor="#e0e7ff" />
                    <stop offset="100%" stopColor="#e879f9" />
                  </linearGradient>
                </defs>
                {/* Selubung gelap di luar siluet wajah */}
                <path
                  fillRule="evenodd"
                  fill="rgba(2, 6, 23, 0.58)"
                  d="M0,0 H300 V400 H0 Z
                     M150,68 C100,68 64,102 62,158 C60,204 72,240 94,268 C112,291 131,312 150,312
                     C169,312 188,291 206,268 C228,240 240,204 238,158 C236,102 200,68 150,68 Z"
                />
                {/* Halo tipis mengelilingi garis wajah */}
                <path
                  className="wajah-berdenyut"
                  fill="none"
                  stroke="rgba(255,255,255,.35)"
                  strokeWidth="8"
                  d="M150,68 C100,68 64,102 62,158 C60,204 72,240 94,268 C112,291 131,312 150,312
                     C169,312 188,291 206,268 C228,240 240,204 238,158 C236,102 200,68 150,68 Z"
                />
                {/* Garis siluet wajah — putus-putus & terus berjalan */}
                <path
                  className="wajah-dash"
                  fill="none"
                  stroke="url(#wajahGaris)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray="12 10"
                  d="M150,68 C100,68 64,102 62,158 C60,204 72,240 94,268 C112,291 131,312 150,312
                     C169,312 188,291 206,268 C228,240 240,204 238,158 C236,102 200,68 150,68 Z"
                />
              </svg>
              {/* Braket sudut ala Face ID */}
              <span aria-hidden className="pointer-events-none absolute left-4 top-4 h-7 w-7 rounded-tl-2xl border-l-[3px] border-t-[3px] border-white/80" />
              <span aria-hidden className="pointer-events-none absolute right-4 top-4 h-7 w-7 rounded-tr-2xl border-r-[3px] border-t-[3px] border-white/80" />
              <span aria-hidden className="pointer-events-none absolute bottom-4 left-4 h-7 w-7 rounded-bl-2xl border-b-[3px] border-l-[3px] border-white/80" />
              <span aria-hidden className="pointer-events-none absolute bottom-4 right-4 h-7 w-7 rounded-br-2xl border-b-[3px] border-r-[3px] border-white/80" />
              {/* Garis pemindai wajah (mock face-scan) — glow neon di area wajah */}
              <div className="scanline pointer-events-none left-[16%] right-[16%] h-[3px] rounded-full bg-gradient-to-r from-transparent via-indigo-300/90 to-transparent blur-[1px]" />
              {wajahTerdeteksi && (
                <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-500/90 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/40 backdrop-blur">
                  <Check size={13} /> Wajah terdeteksi
                </div>
              )}
            </>
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <p className="text-sm text-rose-300">{error}</p>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          {photo ? (
            <>
              <button onClick={() => { setPhoto(null); bukaKamera() }} className="btn-ghost flex-1">
                <RotateCcw size={18} /> Ulangi
              </button>
              <button onClick={konfirmasi} className="btn-primary flex-1">
                <Check size={18} /> Gunakan Foto
              </button>
            </>
          ) : (
            <div className="relative">
              {/* Cincin putus-putus berputar mengelilingi tombol jepret */}
              <span aria-hidden className="animate-spin-slower absolute -inset-2.5 rounded-full border-2 border-dashed border-indigo-400/70 dark:border-indigo-400/50" />
              <button
                onClick={jepret}
                disabled={!!error}
                className="relative grid h-[4.25rem] w-[4.25rem] place-items-center rounded-full bg-white shadow-2xl shadow-indigo-500/40 ring-4 ring-white/50 transition active:scale-90 disabled:opacity-40"
                aria-label="Ambil selfie"
              >
                <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white">
                  <Camera size={24} />
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

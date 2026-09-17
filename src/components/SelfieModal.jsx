import { useEffect, useRef, useState } from 'react'
import { Camera, RotateCcw, Check, X, ScanFace } from 'lucide-react'
import { KANTOR, statusGeofence } from '../utils/geo'

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 animate-fade-in sm:items-center">
      <div className="w-full max-w-md animate-slide-up rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-[2rem]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <ScanFace size={22} />
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

        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-slate-900">
          {photo ? (
            <img src={photo} alt="Selfie" className="h-full w-full object-cover" />
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" />
              {/* Bingkai oval verifikasi */}
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="h-3/5 w-3/5 rounded-[50%] border-[3px] border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              </div>
              {/* Garis pemindai wajah (mock face-scan) */}
              <div className="scanline pointer-events-none inset-x-10 h-1 rounded-full bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />
              {wajahTerdeteksi && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-bold text-white shadow-lg">
                  ✓ Wajah terdeteksi
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
            <button
              onClick={jepret}
              disabled={!!error}
              className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/40 transition active:scale-90 disabled:opacity-40"
              aria-label="Ambil selfie"
            >
              <Camera size={26} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

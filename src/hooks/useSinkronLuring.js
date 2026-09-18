import { useCallback, useEffect, useRef, useState } from 'react'
import { jumlahAntrean, prosesAntrean, saatBerubahInternet } from '../utils/luring'

// Status koneksi + mesin sinkron antrean luring untuk App:
//  - chip header "Luring / n antre" (lihat App.jsx),
//  - kirim ulang otomatis saat event 'online', tiap 60 dtk bila ada antrean,
//    dan segera setelah item baru masuk antrean (bila ternyata masih online).
// `saatSinkron({terkirim, gagal})` dipanggil bila ada data yang berhasil dikirim.
export default function useSinkronLuring({ aktif = true, saatSinkron } = {}) {
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [antrean, setAntrean] = useState(() => jumlahAntrean())
  const [menyinkron, setMenyinkron] = useState(false)
  const sibuk = useRef(false)
  const cbSinkron = useRef(saatSinkron)
  cbSinkron.current = saatSinkron

  const sinkron = useCallback(async () => {
    if (sibuk.current || navigator.onLine === false || jumlahAntrean() === 0) return
    sibuk.current = true
    setMenyinkron(true)
    try {
      const hasil = await prosesAntrean()
      setAntrean(jumlahAntrean())
      if (hasil.terkirim || hasil.gagal) cbSinkron.current?.(hasil)
    } catch { /* tak terduga — antrean tetap aman */ }
    finally {
      sibuk.current = false
      setMenyinkron(false)
    }
  }, [])

  useEffect(() => {
    if (!aktif) return
    setOnline(navigator.onLine)
    setAntrean(jumlahAntrean())
    const lepas = saatBerubahInternet((status) => {
      setOnline(status === 'online')
      if (status === 'online') sinkron()
    })
    const onAntrean = () => {
      setAntrean(jumlahAntrean())
      sinkron() // aman dipanggil saat luring — prosesAntrean sendiri yang menolak
    }
    window.addEventListener('absenku:antrean', onAntrean)
    const t = setInterval(() => {
      if (jumlahAntrean() > 0) sinkron()
    }, 60000)
    return () => {
      lepas()
      clearInterval(t)
      window.removeEventListener('absenku:antrean', onAntrean)
    }
  }, [aktif, sinkron])

  return { online, antrean, menyinkron, sinkronManual: sinkron }
}
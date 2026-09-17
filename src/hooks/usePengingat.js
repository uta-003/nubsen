import { useEffect, useState } from 'react'

const KEY_AKTIF = 'absenku.pengingat'
const KEY_TERKIRIM = 'absenku.pengingat.terkirim'

// Pengingat absen via Notification API — jam DINAMIS sesuai jadwal kerja dari server:
// 5 menit sebelum batas masuk & tepat jam pulang. Sekali per hari per jenis pengingat.
export default function usePengingat(today, jamPulang = '17:00', jamMasukBatas = '08:15') {
  const [aktif, setAktif] = useState(() => localStorage.getItem(KEY_AKTIF) === '1')

  const toMenit = (hhmm) => {
    const [j, m] = (hhmm || '00:00').split(':').map(Number)
    return j * 60 + m
  }

  const toggle = async () => {
    if (!aktif && 'Notification' in window && Notification.permission !== 'granted') {
      const izin = await Notification.requestPermission()
      if (izin !== 'granted') return
    }
    const next = !aktif
    setAktif(next)
    localStorage.setItem(KEY_AKTIF, next ? '1' : '0')
  }

  useEffect(() => {
    if (!aktif || !('Notification' in window) || Notification.permission !== 'granted') return
    const batasMasuk = toMenit(jamMasukBatas)
    const jamPulangMenit = toMenit(jamPulang)
    const cek = () => {
      const now = new Date()
      const menit = now.getHours() * 60 + now.getMinutes()
      const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const terkirim = JSON.parse(localStorage.getItem(KEY_TERKIRIM) || '{}')
      let pesan = null
      if (!today?.checkIn && menit >= batasMasuk - 5 && menit <= batasMasuk + 45 && terkirim.masuk !== iso) {
        pesan = `⏰ Waktunya absen masuk! Batas ${jamMasukBatas}. Jangan lupa selfie + GPS.`
        terkirim.masuk = iso
      }
      if (today?.checkIn && !today?.checkOut && menit >= jamPulangMenit && terkirim.pulang !== iso) {
        pesan = `🏃 Waktunya absen pulang (${jamPulang}). Hati-hati di jalan!`
        terkirim.pulang = iso
      }
      if (pesan) {
        localStorage.setItem(KEY_TERKIRIM, JSON.stringify(terkirim))
        new Notification('NUBSEN', { body: pesan })
      }
    }
    cek()
    const t = setInterval(cek, 30000)
    return () => clearInterval(t)
  }, [aktif, today?.checkIn, today?.checkOut, jamMasukBatas, jamPulang])

  return { aktif, toggle }
}

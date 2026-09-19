import { useEffect, useState } from 'react'
import { diAplikasi } from '../utils/native'
import { siapkanNotifikasi, jadwalkanPengingat, tampilkanNotifikasi } from '../utils/notif'

const KEY_AKTIF = 'absenku.pengingat'
const KEY_TERKIRIM = 'absenku.pengingat.terkirim'

// Pengingat absen — jam DINAMIS sesuai jadwal kerja dari server: 5 menit sebelum
// batas masuk & tepat jam pulang, sekali per hari per jenis. PENGIRIMAN DUA JALUR
// agar notifikasi tetap MUNCUL DI LAYAR HP:
//  • Aplikasi Android (Capacitor): alarm harian native via AlarmManager
//    (jadwalkanPengingat) — tetap berbunyi walau aplikasi tertutup. Timer interval
//    di bawah sengaja TIDAK dipakai di aplikasi supaya tidak notifikasi ganda.
//  • Peramban (PWA): penjaga interval 30 dtk + tampilkanNotifikasi() (Service
//    Worker bila tersedia, fallback new Notification halaman).
export default function usePengingat(today, jamPulang = '17:00', jamMasukBatas = '08:15') {
  const [aktif, setAktif] = useState(() => {
    try {
      return localStorage.getItem(KEY_AKTIF) === '1'
    } catch {
      return false
    }
  })

  const toggle = async () => {
    if (aktif) {
      setAktif(false)
      try { localStorage.setItem(KEY_AKTIF, '0') } catch { /* abaikan */ }
      jadwalkanPengingat({ aktif: false }).catch(() => {}) // matikan alarm native
      return true
    }
    // Minta izin OS + siapkan kanal Android (dialog izin muncul sekali di awal).
    const hasil = await siapkanNotifikasi()
    if (hasil === 'tidak-diizinkan' || hasil === 'tidak-didukung') return false
    setAktif(true)
    try { localStorage.setItem(KEY_AKTIF, '1') } catch { /* abaikan */ }
    jadwalkanPengingat({ aktif: true, jamMasukBatas, jamPulang }).catch(() => {})
    return true
  }

  // Aplikasi Android: (re)pasang alarm saat toggle aktif & tiap jadwal kerja
  // berubah (mis. admin menggeser jam pulang — alarm lama dibatalkan, baru dipasang).
  useEffect(() => {
    if (!aktif || !diAplikasi()) return
    jadwalkanPengingat({ aktif: true, jamMasukBatas, jamPulang }).catch(() => {})
  }, [aktif, jamMasukBatas, jamPulang])

  // Peramban: penjaga interval (web tidak punya padanan AlarmManager).
  useEffect(() => {
    if (!aktif || diAplikasi()) return undefined
    const toMenit = (hhmm) => {
      const [j, m] = (hhmm || '00:00').split(':').map(Number)
      return j * 60 + m
    }
    const cek = async () => {
      const now = new Date()
      const menit = now.getHours() * 60 + now.getMinutes()
      const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      let terkirim = {}
      try { terkirim = JSON.parse(localStorage.getItem(KEY_TERKIRIM) || '{}') } catch { /* mulai segar */ }
      let pesan = null
      let kunci = null
      if (!today?.checkIn && menit >= toMenit(jamMasukBatas) - 5 && menit <= toMenit(jamMasukBatas) + 45 && terkirim.masuk !== iso) {
        pesan = `⏰ Waktunya absen masuk! Batas ${jamMasukBatas}. Jangan lupa selfie + GPS.`
        kunci = 'masuk'
      }
      if (today?.checkIn && !today?.checkOut && menit >= toMenit(jamPulang) && terkirim.pulang !== iso) {
        pesan = `🏃 Waktunya absen pulang (${jamPulang}). Hati-hati di jalan!`
        kunci = 'pulang'
      }
      if (pesan) {
        terkirim[kunci] = iso
        try { localStorage.setItem(KEY_TERKIRIM, JSON.stringify(terkirim)) } catch { /* abaikan */ }
        // id unik per jenis → tag notifikasi tidak saling menggantikan.
        await tampilkanNotifikasi({ id: `pengingat-${kunci}`, judul: 'NUBSEN', pesan, jenis: 'info' })
      }
    }
    cek()
    const t = setInterval(cek, 30000)
    return () => clearInterval(t)
  }, [aktif, today?.checkIn, today?.checkOut, jamMasukBatas, jamPulang])

  return { aktif, toggle }
}

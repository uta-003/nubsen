// ============ Cuaca terkini via Open-Meteo (gratis, tanpa API key) ============
// Data dipakai kartu "Waktu Saat Ini" di Beranda: ikon cuaca + suhu + UV.
// Urutan lokasi: GPS perangkat (bila user setuju) → fallback koordinat KANTOR.
// Cache 30 menit per koordinat (dibulatkan 2 desimal) di localStorage.

import { KANTOR } from './geo'

// Kode weather_code WMO Open-Meteo → { jenis, label, ikon }.
export function terjemahkanKodeCuaca(kode) {
  const peta = [
    [0, 'cerah', 'Cerah', '☀️'],
    [1, 'cerah', 'Cerah Berawan', '🌤️'],
    [2, 'berawan', 'Berawan', '⛅'],
    [3, 'berawan', 'Mendung', '☁️'],
    [45, 'kabut', 'Berkabut', '🌫️'],
    [48, 'kabut', 'Kabut Beku', '🌫️'],
    [51, 'gerimis', 'Gerimis Ringan', '🌦️'],
    [53, 'gerimis', 'Gerimis', '🌦️'],
    [55, 'hujan', 'Gerimis Lebat', '🌧️'],
    [56, 'gerimis', 'Gerimis Beku', '🌨️'],
    [57, 'hujan', 'Gerimis Beku Lebat', '🌨️'],
    [61, 'hujan', 'Hujan Ringan', '🌦️'],
    [63, 'hujan', 'Hujan', '🌧️'],
    [65, 'hujan', 'Hujan Lebat', '🌧️'],
    [66, 'hujan', 'Hujan Beku', '🌨️'],
    [67, 'hujan', 'Hujan Beku Lebat', '🌨️'],
    [71, 'salju', 'Salju Ringan', '🌨️'],
    [73, 'salju', 'Hujan Salju', '🌨️'],
    [75, 'salju', 'Salju Lebat', '❄️'],
    [77, 'salju', 'Butiran Salju', '🌨️'],
    [80, 'hujan', 'Hujan Lokal Ringan', '🌦️'],
    [81, 'hujan', 'Hujan Lokal', '🌧️'],
    [22, 'hujan', 'Hujan Lokal Lebat', '⛈️'],
    [82, 'hujan', 'Hujan Lokal Lebat', '⛈️'],
    [85, 'salju', 'Semburan Salju', '🌨️'],
    [86, 'kabut', 'Semburan Salju Lebat', '❄️'],
    [95, 'badai', 'Badai Guntur', '⛈️'],
    [96, 'badai', 'Badai + Hujan Es', '⛈️'],
    [99, 'badai', 'Badai Hebat + Hujan Es', '⛈️'],
  ]
  const temuan = peta.find(([k]) => k === kode)
  return temuan ? { jenis: temuan[1], label: temuan[2], ikon: temuan[3] } : { jenis: 'berawan', label: 'Berawan', ikon: '⛅' }
}

const KUNCI_CACHE = 'absenku.cuaca'

export async function ambilCuaca(latLon = null) {
  // 1) Lokasi: parameter → GPS → kantor
  let lat, lon
  if (latLon) {
    ;[lat, lon] = latLon
  } else {
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('tanpa geolocation'))
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p),
          reject,
          { timeout: 6000, maximumAge: 600000 },
        )
      })
      lat = pos.coords.latitude
      lon = pos.coords.longitude
    } catch {
      lat = KANTOR.lat
      lon = KANTOR.lon
    }
  }
  const kunci = `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`
  const peta = bacaCache()
  const simpanan = peta[kunci]
  if (simpanan && Date.now() - simpanan.waktu < 30 * 60 * 1000) return simpanan.data

  // 2) Ambil dari Open-Meteo
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,uv_index`
  const r = await fetch(url)
  if (!r.ok) throw new Error('gagal mengambil cuaca')
  const j = await r.json()
  const c = j.current || {}
  const hasil = {
    suhu: Math.round(c.temperature_2m),
    terasa: Math.round(c.apparent_temperature) !== Math.round(c.temperature_2m) ? Math.round(c.apparent_temperature) : null,
    lembap: c.relative_humidity_2m,
    uv: Math.round((c.uv_index || 0) * 10) / 10,
    siang: c.is_day === 1,
    ...terjemahkanKodeCuaca(c.weather_code),
  }
  peta[kunci] = { waktu: Date.now(), data: hasil }
  try {
    localStorage.setItem(KUNCI_CACHE, JSON.stringify(peta))
  } catch { /* penyimpanan penuh / privat — abaikan */ }
  return hasil
}

function bacaCache() {
  try {
    return JSON.parse(localStorage.getItem(KUNCI_CACHE) || '{}')
  } catch {
    return {}
  }
}

// Sapaan tambahan sesuai cuaca — tampil di bawah nama (baris kedua sapaan).
export function sapaanCuaca(cuaca) {
  if (!cuaca) return null
  if (cuaca.jenis === 'badai') return 'Hujan badai di luar — hati-hati di jalan! ⛈️'
  if (cuaca.jenis === 'hujan') return 'Hujan hari ini — jangan lupa payung! 🌂'
  if (cuaca.jenis === 'gerimis') return 'Gerimis tipis — siapkan jas hujan ya 🌦️'
  if (cuaca.jenis === 'kabut') return 'Kabut pekat — berhati-hati saat berkendara 🌫️'
  if (cuaca.jenis === 'salju') return 'Salju turun — jaga tubuh tetap hangat ❄️'
  if (cuaca.suhu >= 33) return 'Hari terik — minum yang banyak ya 🥵'
  if (cuaca.jenis === 'cerah' && cuaca.siang) return 'Hari cerah — semangat menjalani hari! ☀️'
  if (cuaca.jenis === 'cerah') return 'Malam cerah — selamat beristirahat 🌙'
  return 'Langit berawan — tetap semangat hari ini ⛅'
}
// ============ Util Geolokasi (GPS) ============
// Mengambil koordinat GPS + alamat sementara via reverse-geocoding
// Nominatim (OpenStreetMap) — gratis, tanpa API key. Jika gagal (offline),
// tetap tampilkan koordinat.

// Pesan kegagalan GPS yang bisa ditindaklanjuti pengguna.
// GeolocationPositionError: 1 = izin ditolak, 2 = posisi tak tersedia, 3 = timeout.
export function pesanErrorLokasi(err) {
  if (err?.code === 1) {
    return 'Izin lokasi belum diberikan. Buka Setelan → Aplikasi → NUBSEN → Izin → Lokasi → Izinkan, lalu tekan Perbarui.'
  }
  if (err?.code === 2) {
    return 'Sinyal GPS tidak tersedia. Nyalakan Lokasi/GPS di HP lalu tekan Perbarui.'
  }
  if (err?.code === 3) {
    return 'Pencarian GPS melebihi batas waktu. Coba lagi di tempat terbuka.'
  }
  return err?.message || 'Lokasi gagal diperbarui. Coba lagi.'
}

// Satu permintaan posisi (dibungkus Promise agar bisa di-await).
function mintaPosisi(opsi) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, opsi)
  })
}

// Catatan APK Android: GPS hanya berfungsi bila AndroidManifest.xml memuat
// ACCESS_FINE_LOCATION & ACCESS_COARSE_LOCATION. Tanpa itu Capacitor menolak
// permintaan geolocation dari WebView dan aplikasi menampilkan
// "Lokasi gagal diperbarui" (dijaga oleh scripts/cek-ikon-android.ps1).
export async function getPosition() {
  if (!('geolocation' in navigator)) {
    throw new Error('Perangkat tidak mendukung GPS')
  }
  try {
    // 1) Akurasi tinggi (GPS murni) — dipakai untuk verifikasi geofence 20 m.
    return await mintaPosisi({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })
  } catch (err) {
    // 2) Izin ditolak → tidak ada gunanya diulang. Selain itu (sinyal lemah di
    //    dalam gedung / kehabisan waktu) ulangi dengan akurasi jaringan.
    if (err?.code === 1) throw err
    return mintaPosisi({ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 })
  }
}

export async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&accept-language=id`,
      { headers: { Accept: 'application/json' } },
    )
    if (!res.ok) throw new Error('geocode gagal')
    const data = await res.json()
    return data?.display_name || 'Lokasi tidak dikenali'
  } catch {
    return null // offline / diblokir — tampilkan hanya koordinat
  }
}

export async function ambilLokasi() {
  const pos = await getPosition()
  const { latitude: lat, longitude: lon, accuracy } = pos.coords
  const alamat = await reverseGeocode(lat, lon)
  return { lat: +lat.toFixed(6), lon: +lon.toFixed(6), accuracy: Math.round(accuracy), alamat }
}

// ============ Geofence kantor (sinkron dengan server/db.js) ============
export const KANTOR = {
  nama: 'Kantor Pusat',
  alamat: 'Kelapa Gading - Jakarta Utara',
  lat: -6.1765782,
  lon: 106.899041,
  radiusM: 20,
}

export function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const rad = (d) => (d * Math.PI) / 180
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Status zona: { jarak (m), diLuarArea (bool) }
export function statusGeofence(lat, lon) {
  if (lat == null || lon == null) return null
  const jarak = Math.round(haversineM(lat, lon, KANTOR.lat, KANTOR.lon))
  return { jarak, diLuarArea: jarak > KANTOR.radiusM }
}

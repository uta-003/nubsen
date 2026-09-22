// ============ API client NUBSEN ============
// Lokal (dev): path relatif '/api/...' diproxy Vite ke backend Express
// (lihat vite.config.js: '/api' & '/uploads' → http://localhost:9091).
// Online: VITE_BACKEND_URL mengarah ke backend produksi. Fallback produksi:
// API & berkas dilayani dari https://nubsen.vercel.app (Vercel serverless) —
// ditulis langsung agar APK bundel-lokal tetap benar walau .env tidak ada.
export const API_BASE = (
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.PROD ? 'https://nubsen.vercel.app' : '')
).replace(/\/+$/, '')


// Mengubah path berkas dari server ('/uploads/xxx.jpg') menjadi URL yang bisa
// dibuka browser. dataURL (data:...) dan URL absolut dibiarkan apa adanya.
export function assetUrl(path) {
  if (!path) return null
  if (/^(https?:|data:|blob:)/i.test(path)) return path
  return `${API_BASE}${path}`
}

// ============ Sesi login (token) ============
const TOKEN_KEY = 'absenku.token'
export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token) {
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {}
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`
  if (!isForm) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error(
      'Server tidak terjangkau. Pastikan backend berjalan (lokal: cd server && npm start).',
    )
  }
  const json = await res.json().catch(() => ({}))
  if (res.status === 401) {
    setToken(null)
    throw new Error(json.error || 'Sesi berakhir. Silakan login kembali.')
  }
  if (!res.ok) throw new Error(json.error || `Terjadi kesalahan (HTTP ${res.status})`)
  return json.data
}

// ---------- Autentikasi ----------
export async function cekButuhSetup() {
  const d = await request('/api/auth/needs-setup')
  return !!d.butuhSetup
}

// Pengaturan awal: buat akun admin pertama saat instalasi masih kosong.
export async function setupAwal(nama, email, pin) {
  const data = await request('/api/auth/setup', { method: 'POST', body: { nama, email, pin } })
  setToken(data.token)
  return data.karyawan
}

export async function login(email, pin) {
  const data = await request('/api/auth/login', { method: 'POST', body: { email, pin } })
  setToken(data.token)
  return data.karyawan
}

export async function logoutApi() {
  try {
    await request('/api/auth/logout', { method: 'POST' })
  } finally {
    setToken(null)
  }
}

// Normalisasi bentuk respons server (sudah camelCase dari toClient di backend).
// Semua field server DITERUSKAN — termasuk `sumber` ('absensi' | 'izin') yang
// dipakai Riwayat untuk menyaring baris turunan pengajuan izin, dan data absen
// PULANG (lokasiPulang/selfiePulang/…) yang dipakai modal detail.
function mapRecord(row) {
  if (!row) return null
  return {
    id: row.id ?? null,
    tanggal: row.tanggal || '',
    checkIn: row.checkIn || null,
    checkOut: row.checkOut || null,
    status: row.status || null,
    keterangan: row.keterangan || '',
    lokasi: row.lokasi || null,
    selfie: row.selfie || null,
    diLuarArea: row.diLuarArea ?? null,
    jarak: row.jarak ?? null,
    // Data absen pulang (terpisah dari masuk).
    lokasiPulang: row.lokasiPulang || null,
    selfiePulang: row.selfiePulang || null,
    diLuarAreaPulang: row.diLuarAreaPulang ?? null,
    jarakPulang: row.jarakPulang ?? null,
    // Penanda ADA foto (muatan daftar RINGAN — base64 tidak ikut; foto diambil
    // terpisah via getFotoAbsensi saat detail dibuka).
    adaSelfie: !!row.adaSelfie,
    adaSelfiePulang: !!row.adaSelfiePulang,
    lampiran: row.lampiran || null,
    // Absensi di luar hari kerja (mis. masuk hari Sabtu) → badge "Hari libur".
    hariLibur: !!row.hariLibur,
    // Penanda asal baris: catatan absensi asli vs turunan pengajuan izin.
    sumber: row.sumber || 'absensi',
  }
}

export function getProfile() {
  return request('/api/profile')
}

// Ganti PIN sendiri (diverifikasi hash PIN lama di server)
export function ubahPin(pinLama, pinBaru) {
  return request('/api/profile/pin', { method: 'PUT', body: { pinLama, pinBaru } })
}

// ---------- Jadwal kerja (DUA MODE: 'biasa' & 'shift' 2 giliran) ----------
export function getJadwal() {
  return request('/api/jadwal')
}
export function adminGetJadwal() {
  return request('/api/admin/jadwal')
}
// Simpan pengaturan jadwal.
// `data` = { mode, jamMasukBatas, jamPulang, hariKerja, shift1, shift2 }
// (shift1/shift2 = { nama, masuk, batas, pulang }; boleh dikirim sebagian).
export function adminUpdateJadwal(data) {
  return request('/api/admin/jadwal', { method: 'PUT', body: data })
}

// ---------- Hari libur (nasional/cuti bersama + khusus dari admin) ----------
export function adminLibur({ tahun } = {}) {
  return request(`/api/admin/libur${tahun ? `?tahun=${tahun}` : ''}`)
}
export function adminTambahLibur(tanggal, nama) {
  return request('/api/admin/libur', { method: 'POST', body: { tanggal, nama } })
}
export function adminHapusLibur(tanggal) {
  return request(`/api/admin/libur/${tanggal}`, { method: 'DELETE' })
}

// ---------- Surat peringatan (SP1–SP3) & pemecatan ----------
export function adminPeringatan(employeeId = '') {
  return request(`/api/admin/peringatan${employeeId ? `?employeeId=${employeeId}` : ''}`)
}
export function adminBuatPeringatan(body) {
  return request('/api/admin/peringatan', { method: 'POST', body })
}
export function adminHapusPeringatan(id) {
  return request(`/api/admin/peringatan/${id}`, { method: 'DELETE' })
}
// Riwayat (jejak audit) penerbitan & pencabutan surat — termasuk surat yang sudah
// dicabut/dihapus dan karyawan yang sudah dihapus. Filter: employeeId, jenis, aksi,
// dari, sampai. Hasil: { items, ringkas: { total, diterbitkan, dicabut } }.
export function adminRiwayatPeringatan({ employeeId, jenis, aksi, dari, sampai } = {}) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries({ employeeId, jenis, aksi, dari, sampai })) {
    if (v !== undefined && v !== null && String(v).trim() !== '') q.set(k, v)
  }
  const saring = q.toString()
  return request(`/api/admin/peringatan/riwayat${saring ? `?${saring}` : ''}`)
}

// ---------- Identitas perusahaan (KOP surat) & tren kehadiran ----------
export function adminPerusahaan() {
  return request('/api/admin/perusahaan')
}
export function adminUpdatePerusahaan(nama, alamat) {
  return request('/api/admin/perusahaan', { method: 'PUT', body: { nama, alamat } })
}
export function adminTren() {
  return request('/api/admin/tren')
}

export async function getToday() {
  return mapRecord(await request('/api/attendance/today'))
}

export async function getHistory(filter = {}) {
  const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v))
  const rows = await request(`/api/attendance/history${qs.toString() ? `?${qs}` : ''}`)
  return rows.map(mapRecord)
}

export async function checkIn({ jam, lokasi, selfie, requestId }) {
  const data = await request('/api/attendance/check-in', {
    method: 'POST',
    // requestId = idempotensi sinkron luring: kirim ulang antrean yang sama
    // dikenali server (jurnal sync_log) dan TIDAK dianggap konflik 409.
    body: { jam, lat: lokasi?.lat, lon: lokasi?.lon, alamat: lokasi?.alamat, selfie, requestId },
  })
  return mapRecord(data)
}

export async function checkOut({ jam, lokasi, selfie, requestId }) {
  const data = await request('/api/attendance/check-out', {
    method: 'POST',
    body: { jam, lat: lokasi?.lat, lon: lokasi?.lon, alamat: lokasi?.alamat, selfie, requestId },
  })
  return mapRecord(data)
}

// ---------- Izin / Cuti ----------
// Riwayat pengajuan izin/cuti milik karyawan yang login (semua status) —
// dipakai bagian "Riwayat Pengajuan" pada halaman Izin/Cuti.
export function getLeaves() {
  return request('/api/leaves')
}

export function createLeave({ jenis, mulai, selesai, keterangan, lampiran }) {
  const fd = new FormData()
  fd.append('jenis', jenis)
  fd.append('mulai', mulai)
  fd.append('selesai', selesai)
  fd.append('keterangan', keterangan)
  if (lampiran) fd.append('lampiran', lampiran)
  return request('/api/leaves', { method: 'POST', body: fd, isForm: true })
}

// ---------- Lembur ----------
export function getLembur() {
  return request('/api/overtime')
}

export function buatLembur({ tanggal, jam_mulai, jam_selesai, keterangan }) {
  return request('/api/overtime', { method: 'POST', body: { tanggal, jam_mulai, jam_selesai, keterangan } })
}

// ---------- Notifikasi ----------
export async function getNotifikasi() {
  const d = await request('/api/notifications')
  return {
    items: d.items || [],
    pengumuman: d.pengumuman || [],
    notifikasi: d.notifikasi || d.items || [],
    belumDibaca: d.belumDibaca || 0,
    belumDibacaPengumuman: d.belumDibacaPengumuman || 0,
  }
}

export function tandaiNotifikasiDibaca(pilihan = {}) {
  // pilihan: { id } → satu item; { pengumuman: true } → semua pengumuman
  return request('/api/notifications/read', { method: 'POST', body: pilihan })
}

// ---------- Panel Admin ----------
const admin = (path, opts = {}) => request(`/api/admin${path}`, opts)

export const adminRingkasan = () => admin('/overview')
export const adminKaryawan = () => admin('/employees')
export const adminTambahKaryawan = (d) => admin('/employees', { method: 'POST', body: d })
export const adminUbahKaryawan = (id, d) => admin(`/employees/${id}`, { method: 'PUT', body: d })
export const adminHapusKaryawan = (id) => admin(`/employees/${id}`, { method: 'DELETE' })
export const adminAbsensi = (q = '') => admin(`/attendance${q}`)
export const adminUbahAbsensi = (id, d) => admin(`/attendance/${id}`, { method: 'PUT', body: d })
export const adminHapusAbsensi = (id) => admin(`/attendance/${id}`, { method: 'DELETE' })
export const adminIzin = () => admin('/leaves')
export const adminStatusIzin = (id, status, alasan = '') => admin(`/leaves/${id}`, { method: 'PUT', body: { status, alasan } })
export const adminHapusIzin = (id) => admin(`/leaves/${id}`, { method: 'DELETE' })
export const adminLembur = () => admin('/overtime')
export const adminStatusLembur = (id, status, alasan = '') => admin(`/overtime/${id}`, { method: 'PUT', body: { status, alasan } })
export const adminHapusLembur = (id) => admin(`/overtime/${id}`, { method: 'DELETE' })
export const adminNotifikasi = () => admin('/notifications')
export const adminKirimNotifikasi = (d) => admin('/notifications', { method: 'POST', body: d })
export const adminUbahPengumuman = (grupId, d) => admin(`/notifications/grup/${grupId}`, { method: 'PUT', body: d })
export const adminHapusPengumuman = (grupId) => admin(`/notifications/grup/${grupId}`, { method: 'DELETE' })
export const adminHapusNotifikasi = (id) => admin(`/notifications/${id}`, { method: 'DELETE' })

// ---------- Laporan Kehadiran (export Excel/PDF) ----------
export function adminLaporan({ dari, sampai, departemen } = {}) {
  const qs = new URLSearchParams()
  if (dari) qs.set('dari', dari)
  if (sampai) qs.set('sampai', sampai)
  if (departemen) qs.set('departemen', departemen)
  return admin(`/reports${qs.toString() ? `?${qs}` : ''}`)
}

// ---------- Penghitung Gaji (per karyawan/hari + uang makan + lembur) ----------
export function adminGaji({ dari, sampai, departemen } = {}) {
  const qs = new URLSearchParams()
  if (dari) qs.set('dari', dari)
  if (sampai) qs.set('sampai', sampai)
  if (departemen) qs.set('departemen', departemen)
  return admin(`/gaji${qs.toString() ? `?${qs}` : ''}`)
}

// ---------- Periode penggajian (dipakai slip gaji di aplikasi karyawan) ----------
export const adminPeriodeGaji = () => admin('/gaji/periode')
export const adminTetapkanPeriodeGaji = (d) => admin('/gaji/periode', { method: 'POST', body: d })
export const adminAktifkanPeriodeGaji = (id) => admin(`/gaji/periode/${id}/aktif`, { method: 'PUT' })
export const adminHapusPeriodeGaji = (id) => admin(`/gaji/periode/${id}`, { method: 'DELETE' })

// Slip gaji karyawan yang sedang login (periode aktif, atau periode terpilih).
// Hasil: { periode, slip, hariKerja, hariKerjaHari, daftar }
export function getSlipGaji({ periodeId } = {}) {
  return request(`/api/slip${periodeId ? `?periodeId=${periodeId}` : ''}`)
}

// ---------- Lampiran pengajuan & foto selfie (diambil saat dibuka saja) ----------
// Daftar pengajuan & riwayat TIDAK membawa base64 (bisa ratusan KB per baris)
// supaya cepat; berkas aslinya diambil lewat endpoint ini saat benar-benar dibuka.
export const getLampiranIzin = (id) => request(`/api/leaves/${id}/lampiran`)
export const adminLampiranIzin = (id) => admin(`/leaves/${id}/lampiran`)
export const getFotoAbsensi = (id, jenis = 'masuk') => request(`/api/attendance/${id}/foto?jenis=${jenis}`)
export const adminFotoAbsensi = (id, jenis = 'masuk') => admin(`/attendance/${id}/foto?jenis=${jenis}`)

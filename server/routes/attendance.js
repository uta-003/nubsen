import { Router } from 'express'
import { db } from '../db.js'
import { getToday, catatCheckIn, catatCheckOut, listHistory, toClient, fotoAbsensi } from '../models.js'
import { saveDataUrl } from '../utils/files.js'
import { wrap } from '../utils/wrap.js'

const router = Router()

// ============ Idempotensi sinkronisasi luring ============
// Antrean perangkat membawa requestId unik per pengajuan. Bila koneksi putus
// tepat SETELAH server menyimpan data (respons tak pernah diterima), klien
// mengirim ulang item yang sama — jurnal sync_log membuat pengiriman ganda
// menjadi tanpa dampak: data TIDAK diduplikasi dan respons pertama diputar ulang.
// Catatan: baris karyawan+tanggal sendiri sudah UNIQUE, jadi duplikasi check-in
// tak mungkin; jurnal ini mencegah pengiriman ulang dianggap galat 409 di klien
// dan melindungi operasi lain (mis. lembur) bila nanti memakai pola yang sama.
async function cekIdempoten(requestId, employeeId, jenis) {
  if (!requestId) return { lanjut: true }
  const ada = await db.get('SELECT request_id FROM sync_log WHERE request_id = ?', [String(requestId)])
  if (ada) return { lanjut: false, duplikat: true }
  await db.run(
    'INSERT INTO sync_log (request_id, employee_id, jenis) VALUES (?, ?, ?)',
    [String(requestId), employeeId, jenis],
  )
  return { lanjut: true }
}

// GET /api/attendance/today — status kehadiran hari ini
router.get('/today', wrap(async (req, res) => {
  res.json({ data: toClient(await getToday(req.employeeId)) })
}))

// POST /api/attendance/check-in — body JSON { lat, lon, alamat, selfie, requestId? }
router.post('/check-in', wrap(async (req, res) => {
  const { lat, lon, alamat, selfie, requestId } = req.body || {}
  const idem = await cekIdempoten(requestId, req.employeeId, 'checkin')
  const existing = await getToday(req.employeeId)
  if (idem.duplikat) {
    // Pengiriman ulang dari antrean: kembalikan kondisi hari ini apa adanya.
    return res.json({ data: toClient(existing), duplikat: true })
  }
  if (existing?.check_in) {
    return res.status(409).json({ error: 'Anda sudah check-in hari ini.' })
  }
  const row = await catatCheckIn({
    employeeId: req.employeeId,
    lokasi: { lat, lon, alamat },
    selfieUrl: saveDataUrl(selfie),
  })
  res.json({ data: toClient(row) })
}))

// POST /api/attendance/check-out — body JSON { lat, lon, alamat, selfie, requestId? }
router.post('/check-out', wrap(async (req, res) => {
  const { lat, lon, alamat, selfie, requestId } = req.body || {}
  const idem = await cekIdempoten(requestId, req.employeeId, 'checkout')
  if (idem.duplikat) {
    return res.json({ data: toClient(await getToday(req.employeeId)), duplikat: true })
  }
  const hasil = await catatCheckOut({
    employeeId: req.employeeId,
    lokasi: { lat, lon, alamat },
    selfieUrl: saveDataUrl(selfie),
  })
  if (hasil.error) return res.status(409).json({ error: hasil.error })
  res.json({ data: toClient(hasil) })
}))

// GET /api/attendance/:id/foto?jenis=masuk|pulang — foto selfie satu catatan
// absensi. Daftar riwayat tidak lagi membawa base64 (agar cepat); foto diambil
// hanya saat detail dibuka. Hanya pemilik catatan yang boleh mengaksesnya.
router.get('/:id/foto', wrap(async (req, res) => {
  const jenis = req.query.jenis === 'pulang' ? 'pulang' : 'masuk'
  const a = await fotoAbsensi(Number(req.params.id), jenis)
  if (!a) return res.status(404).json({ error: 'Catatan absensi tidak ditemukan.' })
  if (a.employeeId !== req.employeeId) return res.status(403).json({ error: 'Foto milik karyawan lain.' })
  res.json({ data: a })
}))

// GET /api/attendance/history?dari=YYYY-MM-DD&sampai=YYYY-MM-DD&status=Hadir
router.get('/history', wrap(async (req, res) => {
  const { dari, sampai, status } = req.query
  res.json({ data: await listHistory({ dari, sampai, status }, req.employeeId) })
}))

export default router
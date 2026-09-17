import { Router } from 'express'
import { getToday, catatCheckIn, catatCheckOut, listHistory, toClient } from '../models.js'
import { saveDataUrl } from '../utils/files.js'
import { wrap } from '../utils/wrap.js'

const router = Router()

// GET /api/attendance/today — status kehadiran hari ini
router.get('/today', wrap(async (req, res) => {
  res.json({ data: toClient(await getToday(req.employeeId)) })
}))

// POST /api/attendance/check-in — body JSON { lat, lon, alamat, selfie(dataURL) }
router.post('/check-in', wrap(async (req, res) => {
  const { lat, lon, alamat, selfie } = req.body || {}
  const existing = await getToday(req.employeeId)
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

// POST /api/attendance/check-out — body JSON { lat, lon, alamat, selfie(dataURL) }
router.post('/check-out', wrap(async (req, res) => {
  const { lat, lon, alamat, selfie } = req.body || {}
  const hasil = await catatCheckOut({
    employeeId: req.employeeId,
    lokasi: { lat, lon, alamat },
    selfieUrl: saveDataUrl(selfie),
  })
  if (hasil.error) return res.status(409).json({ error: hasil.error })
  res.json({ data: toClient(hasil) })
}))

// GET /api/attendance/history?dari=YYYY-MM-DD&sampai=YYYY-MM-DD&status=Hadir
router.get('/history', wrap(async (req, res) => {
  const { dari, sampai, status } = req.query
  res.json({ data: await listHistory({ dari, sampai, status }, req.employeeId) })
}))

export default router
import { Router } from 'express'
import { getJadwal } from '../db.js'

const router = Router()

// GET /api/jadwal — jadwal kerja aktif (jam masuk batas & jam pulang).
// Dipakai semua karyawan: countdown dashboard, pengingat, info "Batas:".
router.get('/', (_req, res) => {
  res.json({ data: getJadwal() })
})

export default router

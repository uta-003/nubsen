import { Router } from 'express'
import { getJadwal } from '../db.js'
import { wrap } from '../utils/wrap.js'

const router = Router()

// GET /api/jadwal — jadwal kerja aktif (jam masuk batas & jam pulang).
// Dipakai semua karyawan: hitungan mundur dashboard, pengingat, info "Batas:".
router.get('/', wrap(async (_req, res) => {
  res.json({ data: await getJadwal() })
}))

export default router
import { Router } from 'express'
import { getJadwal } from '../db.js'
import { listHariLibur } from '../models.js'
import { wrap } from '../utils/wrap.js'

const router = Router()

// GET /api/jadwal — jadwal kerja aktif (jam masuk batas & jam pulang) + daftar
// hari libur (tahun berjalan & tahun depan) agar kalender karyawan bisa menandai
// libur yang ditetapkan admin, bukan hanya libur nasional bawaan.
router.get('/', wrap(async (_req, res) => {
  const data = await getJadwal()
  data.libur = await listHariLibur()
  res.json({ data })
}))

export default router
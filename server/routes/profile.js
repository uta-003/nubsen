import { Router } from 'express'
import { getEmployee } from '../models.js'
import { wrap } from '../utils/wrap.js'

const router = Router()

// GET /api/profile — data karyawan sesuai token sesi (req.employeeId)
router.get('/', wrap(async (req, res) => {
  const karyawan = await getEmployee(req.employeeId)
  if (!karyawan) return res.status(404).json({ error: 'Data karyawan tidak ditemukan.' })
  res.json({ data: karyawan })
}))

export default router
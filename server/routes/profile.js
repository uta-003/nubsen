import { Router } from 'express'
import { getEmployee } from '../models.js'

const router = Router()

// GET /api/profile — data karyawan sesuai token sesi (req.employeeId)
router.get('/', (req, res) => {
  const karyawan = getEmployee(req.employeeId)
  if (!karyawan) return res.status(404).json({ error: 'Data karyawan tidak ditemukan.' })
  res.json({ data: karyawan })
})

export default router

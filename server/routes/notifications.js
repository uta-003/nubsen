import { Router } from 'express'
import { listNotifikasi, tandaiSemuaDibaca } from '../models.js'
import { wrap } from '../utils/wrap.js'

const router = Router()

// GET /api/notifications — notifikasi milik sendiri + siaran umum
router.get('/', wrap(async (req, res) => {
  res.json({ data: await listNotifikasi(req.employeeId) })
}))

// POST /api/notifications/read — tandai semua sudah dibaca
router.post('/read', wrap(async (req, res) => {
  await tandaiSemuaDibaca(req.employeeId)
  res.json({ data: { ok: true } })
}))

export default router
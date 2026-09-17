import { Router } from 'express'
import { listNotifikasi, tandaiSemuaDibaca } from '../models.js'

const router = Router()

// GET /api/notifications — notifikasi milik sendiri + broadcast
router.get('/', (req, res) => {
  res.json({ data: listNotifikasi(req.employeeId) })
})

// POST /api/notifications/read — tandai semua sudah dibaca
router.post('/read', (req, res) => {
  tandaiSemuaDibaca(req.employeeId)
  res.json({ data: { ok: true } })
})

export default router

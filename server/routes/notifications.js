import { Router } from 'express'
import { listNotifikasi, tandaiSemuaDibaca, tandaiSatuDibaca } from '../models.js'
import { wrap } from '../utils/wrap.js'

const router = Router()

// GET /api/notifications — notifikasi milik sendiri + siaran umum,
// sudah dipilah: pengumuman (kabar perusahaan) vs notifikasi (alert personal).
router.get('/', wrap(async (req, res) => {
  res.json({ data: await listNotifikasi(req.employeeId) })
}))

// POST /api/notifications/read — tandai sudah dibaca.
//   { id }                → satu item saja
//   { pengumuman: true }  → semua PENGUMUMAN (badge megafon saja)
//   { notifikasi: true }  → semua NOTIFIKASI personal (badge lonceng saja)
//   tanpa body            → keduanya sekaligus
router.post('/read', wrap(async (req, res) => {
  const { id, pengumuman, notifikasi } = req.body || {}
  if (id != null) {
    await tandaiSatuDibaca(id, req.employeeId)
  } else {
    await tandaiSemuaDibaca(
      req.employeeId,
      pengumuman === true ? 'pengumuman' : notifikasi === true ? 'notifikasi' : 'semua',
    )
  }
  res.json({ data: { ok: true } })
}))

export default router
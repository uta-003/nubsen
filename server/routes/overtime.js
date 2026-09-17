import { Router } from 'express'
import { buatLembur, listLembur } from '../models.js'
import { wrap } from '../utils/wrap.js'

const router = Router()

// GET /api/overtime — pengajuan lembur milik karyawan yang login
router.get('/', wrap(async (req, res) => {
  res.json({ data: await listLembur(req.employeeId) })
}))

// POST /api/overtime — body { tanggal, jam_mulai, jam_selesai, keterangan }
router.post('/', wrap(async (req, res) => {
  const { tanggal, jam_mulai, jam_selesai, keterangan = '' } = req.body || {}
  if (!tanggal || !jam_mulai || !jam_selesai) {
    return res.status(400).json({ error: 'Tanggal dan jam wajib diisi.' })
  }
  if (jam_selesai <= jam_mulai) {
    return res.status(400).json({ error: 'Jam selesai harus setelah jam mulai.' })
  }
  const row = await buatLembur({
    employeeId: req.employeeId,
    tanggal,
    jamMulai: jam_mulai,
    jamSelesai: jam_selesai,
    keterangan,
  })
  res.status(201).json({ data: row })
}))

export default router
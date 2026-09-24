import { Router } from 'express'
import { buatPiket, listPiket, biayaPiket } from '../models.js'
import { wrap } from '../utils/wrap.js'

const router = Router()

// GET /api/piket — daftar piket milik karyawan yang login + biaya piket yang
// berlaku (ditampilkan di halaman pengajuan agar karyawan tahu besar bayarannya).
router.get('/', wrap(async (req, res) => {
  const [items, biaya] = await Promise.all([listPiket(req.employeeId), biayaPiket()])
  res.json({ data: { items, biaya } })
}))

// POST /api/piket — body { tanggal, jam_mulai?, jam_selesai?, keterangan? }
router.post('/', wrap(async (req, res) => {
  const { tanggal, jam_mulai = '', jam_selesai = '', keterangan = '' } = req.body || {}
  if (!tanggal) return res.status(400).json({ error: 'Tanggal piket wajib diisi.' })
  const row = await buatPiket({
    employeeId: req.employeeId,
    tanggal,
    jamMulai: jam_mulai,
    jamSelesai: jam_selesai,
    keterangan,
  })
  if (row?.error) return res.status(400).json({ error: row.error })
  res.status(201).json({ data: row })
}))

export default router

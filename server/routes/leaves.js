import { Router } from 'express'
import multer from 'multer'
import { createLeave, listLeaves, leaveToClient } from '../models.js'
import { bufferToDataUrl } from '../utils/files.js'
import { wrap } from '../utils/wrap.js'

const router = Router()

// Lampiran disimpan di database sebagai dataURL (memoryStorage) sehingga tidak
// bergantung pada filesystem — wajib untuk serverless (Vercel) dan tetap
// portabel saat dijalankan lokal. Batas 3 MB menjaga badan permintaan tetap di
// bawah batas 4,5 MB Vercel Function (base64 ≈ 1,37× ukuran berkas).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\//.test(file.mimetype) || file.mimetype === 'application/pdf'
    cb(ok ? null : new Error('Lampiran hanya boleh gambar atau PDF'), ok)
  },
})

// GET /api/leaves — daftar pengajuan izin
router.get('/', wrap(async (req, res) => {
  res.json({ data: await listLeaves(req.employeeId) })
}))

// POST /api/leaves — multipart/form-data: jenis, mulai, selesai, keterangan, lampiran(file)
router.post('/', upload.single('lampiran'), wrap(async (req, res) => {
  const { jenis, mulai, selesai, keterangan = '' } = req.body || {}
  if (!jenis || !mulai || !selesai) {
    return res.status(400).json({ error: 'jenis, mulai, dan selesai wajib diisi.' })
  }
  if (selesai < mulai) {
    return res.status(400).json({ error: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' })
  }
  const row = await createLeave({
    employeeId: req.employeeId,
    jenis, mulai, selesai, keterangan,
    lampiran: req.file ? bufferToDataUrl(req.file.mimetype, req.file.buffer) : null,
  })
  res.status(201).json({ data: leaveToClient(row) })
}))

export default router
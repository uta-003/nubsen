import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import crypto from 'node:crypto'
import { createLeave, listLeaves, leaveToClient } from '../models.js'
import { uploadsDir } from '../utils/files.js'

const router = Router()

// Upload lampiran ke folder uploads/ dengan nama unik.
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) =>
    cb(null, `izin-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname || '')}`),
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // maks 5 MB
  fileFilter: (req, file, cb) => {
    const ok = /^image\//.test(file.mimetype) || file.mimetype === 'application/pdf'
    cb(ok ? null : new Error('Lampiran hanya boleh gambar atau PDF'), ok)
  },
})

// GET /api/leaves — daftar pengajuan izin
router.get('/', (req, res) => {
  res.json({ data: listLeaves(req.employeeId) })
})

// POST /api/leaves — multipart/form-data: jenis, mulai, selesai, keterangan, lampiran(file)
router.post('/', upload.single('lampiran'), (req, res) => {
  const { jenis, mulai, selesai, keterangan = '' } = req.body || {}
  if (!jenis || !mulai || !selesai) {
    return res.status(400).json({ error: 'jenis, mulai, dan selesai wajib diisi.' })
  }
  if (selesai < mulai) {
    return res.status(400).json({ error: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' })
  }
  const row = createLeave({
    employeeId: req.employeeId,
    jenis, mulai, selesai, keterangan,
    lampiran: req.file ? `/uploads/${req.file.filename}` : null,
  })
  res.status(201).json({ data: leaveToClient(row) })
})

export default router

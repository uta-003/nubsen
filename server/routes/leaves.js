import { Router } from 'express'
import multer from 'multer'
import { createLeave, listLeaves, leaveToClient, lampiranIzin, JENIS_IZIN } from '../models.js'
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
  if (!JENIS_IZIN.includes(jenis)) {
    return res.status(400).json({ error: `Jenis pengajuan harus salah satu dari: ${JENIS_IZIN.join(', ')}.` })
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

// GET /api/leaves/:id/lampiran — isi lampiran (base64/dataURL) satu pengajuan.
// Dipisah dari daftar supaya GET /api/leaves tetap ringan & cepat; hanya pemilik
// pengajuan yang boleh membukanya.
router.get('/:id/lampiran', wrap(async (req, res) => {
  const l = await lampiranIzin(Number(req.params.id))
  if (!l) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' })
  if (l.employeeId !== req.employeeId) return res.status(403).json({ error: 'Lampiran milik karyawan lain.' })
  if (!l.lampiran) return res.status(404).json({ error: 'Pengajuan ini tidak punya lampiran.' })
  res.json({ data: { id: l.id, jenis: l.jenis, lampiran: l.lampiran } })
}))

export default router
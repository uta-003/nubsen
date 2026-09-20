import { Router } from 'express'
import { getEmployee, ubahPin, listPeringatan } from '../models.js'
import { wrap } from '../utils/wrap.js'

const router = Router()

// GET /api/profile — data karyawan sesuai token sesi (req.employeeId)
router.get('/', wrap(async (req, res) => {
  const karyawan = await getEmployee(req.employeeId)
  if (!karyawan) return res.status(404).json({ error: 'Data karyawan tidak ditemukan.' })
  // Surat peringatan (SP1–SP3) & pemecatan — tampil pada kartu Profil.
  karyawan.peringatan = await listPeringatan(req.employeeId)
  res.json({ data: karyawan })
}))

// PUT /api/profile/pin — ganti PIN sendiri: { pinLama, pinBaru }
router.put('/pin', wrap(async (req, res) => {
  const { pinLama, pinBaru } = req.body || {}
  if (!pinLama || !pinBaru) return res.status(400).json({ error: 'PIN lama & PIN baru wajib diisi.' })
  const hasil = await ubahPin(req.employeeId, pinLama, pinBaru)
  if (!hasil.ok) return res.status(400).json({ error: hasil.alasan })
  res.json({ data: { ok: true, pesan: 'PIN berhasil diganti.' } })
}))

export default router
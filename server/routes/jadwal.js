import { Router } from 'express'
import { getJadwal } from '../db.js'
import { listHariLibur, izinAktifHariIni } from '../models.js'
import { wrap } from '../utils/wrap.js'

const router = Router()

// GET /api/jadwal — jadwal kerja EFEKTIF untuk karyawan yang sedang login:
// mode 'biasa' memakai jam kantor, mode 'shift' memakai shift (1/2) miliknya,
// ditambah daftar hari libur agar kalender karyawan ikut menandai libur admin.
// `izinAktif` = pengajuan cuti/izin yang DISETUJUI dan mencakup hari ini →
// Beranda menampilkan tanda "sedang cuti/izin" (tidak wajib absen, bukan Alpha).
router.get('/', wrap(async (req, res) => {
  const data = await getJadwal(req.employeeId)
  data.libur = await listHariLibur()
  data.izinAktif = await izinAktifHariIni(req.employeeId)
  res.json({ data })
}))

export default router
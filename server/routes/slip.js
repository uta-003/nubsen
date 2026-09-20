import { Router } from 'express'
import { listPeriodeGaji, slipGajiKaryawan } from '../models.js'
import { wrap } from '../utils/wrap.js'

const router = Router()

// GET /api/slip — slip gaji karyawan yang sedang login.
//   • tanpa parameter  → periode penggajian yang sedang AKTIF (ditetapkan admin)
//   • ?periodeId=3     → periode tertentu (mis. melihat slip periode lalu)
// Daftar seluruh periode selalu ikut dikirim agar aplikasi karyawan bisa
// menampilkan pilihan periode tanpa permintaan tambahan.
router.get('/', wrap(async (req, res) => {
  const periodeId = Number(req.query.periodeId) || null
  const [hasil, daftar] = await Promise.all([
    slipGajiKaryawan(req.employeeId, periodeId),
    listPeriodeGaji(),
  ])
  res.json({ data: { ...(hasil || { periode: null, slip: null }), daftar } })
}))

export default router

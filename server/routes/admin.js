import { Router } from 'express'
import { getJadwal, setSetting } from '../db.js'
import {
  ringkasanAdmin,
  listKaryawan, buatKaryawan, ubahKaryawan, hapusKaryawan,
  listSemuaAbsensi, ubahAbsensi, hapusAbsensi,
  listSemuaIzin, setStatusIzin, hapusIzin,
  listSemuaLembur, setStatusLembur, hapusLembur,
  laporanKehadiran,
  notifToClient, kirimNotifikasi, listSemuaNotifikasi, hapusNotifikasi,
  kirimPengumuman, ubahPengumuman, hapusPengumuman,
} from '../models.js'
import { wrap } from '../utils/wrap.js'

const JENIS_VALID = ['pengumuman', 'penting', 'info', 'lembur', 'izin', 'absensi']

// Untuk menyebut hari kerja dalam pesan notifikasi perubahan jadwal.
const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

const router = Router()

// GET /api/admin/overview — ringkasan angka untuk dasbor admin
router.get('/overview', wrap(async (_req, res) => {
  res.json({ data: await ringkasanAdmin() })
}))

// ---------- Jadwal kerja ----------
router.get('/jadwal', wrap(async (_req, res) => {
  res.json({ data: await getJadwal() })
}))

// PUT /api/admin/jadwal — ubah jam masuk (batas Terlambat), jam pulang, dan hari kerja.
// Bila jadwal benar-benar berubah, SEMUA karyawan otomatis menerima notifikasi
// (broadcast: baris employee_id NULL, jenis 'jadwal') agar tidak kaget oleh
// perubahan batas absen / jam pulang.
router.put('/jadwal', wrap(async (req, res) => {
  const { jamMasukBatas, jamPulang, hariKerja } = req.body || {}
  const pola = /^([01]\d|2[0-3]):[0-5]\d$/
  if (!pola.test(jamMasukBatas || '') || !pola.test(jamPulang || '')) {
    return res.status(400).json({ error: 'Format jam harus HH:MM (contoh 08:15).' })
  }
  const lama = await getJadwal()
  // `hariKerja` opsional: array angka 0 (Minggu) … 6 (Sabtu), minimal satu hari.
  let hariBaru = null
  if (hariKerja !== undefined) {
    if (!Array.isArray(hariKerja) || hariKerja.length === 0) {
      return res.status(400).json({ error: 'Hari kerja harus berisi minimal satu hari.' })
    }
    hariBaru = [...new Set(hariKerja.map(Number))].sort((a, b) => a - b)
    if (hariBaru.some((n) => !Number.isInteger(n) || n < 0 || n > 6)) {
      return res.status(400).json({ error: 'Hari kerja harus angka 0 (Minggu) sampai 6 (Sabtu).' })
    }
    await setSetting('hariKerja', hariBaru.join(','))
  }
  await setSetting('jamMasukBatas', jamMasukBatas)
  await setSetting('jamPulang', jamPulang)

  // Notifikasi hanya bila ada yang berubah (hemat kotak masuk dari klik tanpa edit).
  const berubah =
    lama.jamMasukBatas !== jamMasukBatas ||
    lama.jamPulang !== jamPulang ||
    (hariBaru && hariBaru.join(',') !== (lama.hariKerja || []).join(','))
  if (berubah) {
    const hariStr = hariBaru ? `, hari kerja ${hariBaru.map((n) => NAMA_HARI[n]).join(', ')}` : ''
    await kirimNotifikasi({
      employeeId: null,
      judul: '📅 Jadwal kerja diperbarui',
      pesan: `Jadwal baru — batas masuk ${jamMasukBatas}, jam pulang ${jamPulang}${hariStr}. Sesuaikan absensimu ya.`,
      jenis: 'jadwal',
    })
  }
  // `notifikasiDikirim` ditaruh DI DALAM data karena klien (src/api.js) hanya
  // meneruskan `json.data` — dipakai panel admin untuk memberi tahu bahwa
  // broadcast sudah terkirim (atau tidak ada perubahan sehingga tidak ada notif).
  res.json({ data: { ...(await getJadwal()), notifikasiDikirim: !!berubah } })
}))

// ---------- Laporan kehadiran (rekap per karyawan + export) ----------
// GET /api/admin/reports?dari=YYYY-MM-DD&sampai=YYYY-MM-DD&departemen=Teknologi Informasi
router.get('/reports', wrap(async (req, res) => {
  const { dari, sampai, departemen } = req.query
  const pola = /^\d{4}-\d{2}-\d{2}$/
  if (dari && !pola.test(dari)) return res.status(400).json({ error: 'Parameter "dari" harus format YYYY-MM-DD.' })
  if (sampai && !pola.test(sampai)) return res.status(400).json({ error: 'Parameter "sampai" harus format YYYY-MM-DD.' })
  if (dari && sampai && dari > sampai) return res.status(400).json({ error: 'Tanggal "dari" melebihi "sampai".' })
  res.json({ data: await laporanKehadiran({ dari, sampai, departemen: (departemen || '').trim() || null }) })
}))

// ---------- Kelola Karyawan ----------
router.get('/employees', wrap(async (_req, res) => {
  res.json({ data: await listKaryawan() })
}))

router.post('/employees', wrap(async (req, res) => {
  const d = req.body || {}
  if (!d.nama || !d.email) return res.status(400).json({ error: 'Nama dan email wajib diisi.' })
  try {
    res.status(201).json({ data: await buatKaryawan(d) })
  } catch {
    res.status(400).json({ error: 'Gagal menambah karyawan — email/NIP mungkin sudah dipakai.' })
  }
}))

router.put('/employees/:id', wrap(async (req, res) => {
  const hasil = await ubahKaryawan(Number(req.params.id), req.body || {})
  if (!hasil) return res.status(404).json({ error: 'Karyawan tidak ditemukan.' })
  res.json({ data: hasil })
}))

router.delete('/employees/:id', wrap(async (req, res) => {
  if (Number(req.params.id) === req.employeeId) {
    return res.status(400).json({ error: 'Tidak bisa menghapus akun Anda sendiri.' })
  }
  await hapusKaryawan(Number(req.params.id))
  res.json({ data: { ok: true } })
}))

// ---------- Kelola Absensi ----------
router.get('/attendance', wrap(async (req, res) => {
  const { employeeId, dari, sampai } = req.query
  res.json({ data: await listSemuaAbsensi({ employeeId, dari, sampai }) })
}))

router.put('/attendance/:id', wrap(async (req, res) => {
  const hasil = await ubahAbsensi(Number(req.params.id), req.body || {})
  if (!hasil) return res.status(404).json({ error: 'Catatan absensi tidak ditemukan.' })
  // ubahAbsensi() sudah mengembalikan bentuk client (toClient) — jangan dipetakan dua kali.
  res.json({ data: hasil })
}))

router.delete('/attendance/:id', wrap(async (req, res) => {
  await hapusAbsensi(Number(req.params.id))
  res.json({ data: { ok: true } })
}))

// ---------- Kelola Izin/Cuti ----------
router.get('/leaves', wrap(async (_req, res) => {
  res.json({ data: await listSemuaIzin() })
}))

router.put('/leaves/:id', wrap(async (req, res) => {
  const status = req.body?.status
  if (!['Disetujui', 'Ditolak', 'Menunggu'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid.' })
  }
  const hasil = await setStatusIzin(Number(req.params.id), status)
  if (!hasil) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' })
  res.json({ data: hasil })
}))

router.delete('/leaves/:id', wrap(async (req, res) => {
  await hapusIzin(Number(req.params.id))
  res.json({ data: { ok: true } })
}))

// ---------- Kelola Lembur ----------
router.get('/overtime', wrap(async (_req, res) => {
  res.json({ data: await listSemuaLembur() })
}))

router.put('/overtime/:id', wrap(async (req, res) => {
  const status = req.body?.status
  if (!['Disetujui', 'Ditolak', 'Menunggu'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid.' })
  }
  const hasil = await setStatusLembur(Number(req.params.id), status)
  if (!hasil) return res.status(404).json({ error: 'Pengajuan lembur tidak ditemukan.' })
  res.json({ data: hasil })
}))

router.delete('/overtime/:id', wrap(async (req, res) => {
  await hapusLembur(Number(req.params.id))
  res.json({ data: { ok: true } })
}))

// ---------- Kelola Notifikasi & Pengumuman ----------
// GET — daftar terkirim; pengumuman dikelompokkan + statistik sudah/belum dibaca
router.get('/notifications', wrap(async (_req, res) => {
  res.json({ data: await listSemuaNotifikasi() })
}))

// POST — TANPA employeeId = pemberitahuan ke SEMUA karyawan (satu baris per orang),
//        DENGAN employeeId = notifikasi personal ke satu karyawan.
router.post('/notifications', wrap(async (req, res) => {
  const { employeeId = null, judul, pesan = '', jenis = 'pengumuman' } = req.body || {}
  if (!String(judul || '').trim()) return res.status(400).json({ error: 'Judul notifikasi wajib diisi.' })
  if (!JENIS_VALID.includes(jenis)) return res.status(400).json({ error: 'Jenis notifikasi tidak dikenal.' })

  if (!employeeId) {
    const hasil = await kirimPengumuman({ judul: String(judul).trim(), pesan, jenis })
    if (!hasil.jumlah) return res.status(400).json({ error: 'Belum ada karyawan yang bisa dikirimi.' })
    return res.status(201).json({ data: { ...hasil, pengumuman: true } })
  }

  const row = await kirimNotifikasi({
    employeeId: Number(employeeId), judul: String(judul).trim(), pesan, jenis,
  })
  res.status(201).json({ data: notifToClient(row) })
}))

// PUT — ubah isi pengumuman untuk semua penerima (status baca direset)
router.put('/notifications/grup/:grupId', wrap(async (req, res) => {
  const { judul, pesan, jenis } = req.body || {}
  if (jenis !== undefined && !JENIS_VALID.includes(jenis)) {
    return res.status(400).json({ error: 'Jenis notifikasi tidak dikenal.' })
  }
  const hasil = await ubahPengumuman(req.params.grupId, { judul, pesan, jenis })
  if (!hasil) return res.status(404).json({ error: 'Pengumuman tidak ditemukan atau tidak ada perubahan.' })
  res.json({ data: hasil })
}))

// DELETE — hapus seluruh pengumuman (semua penerima)
router.delete('/notifications/grup/:grupId', wrap(async (req, res) => {
  const jumlah = await hapusPengumuman(req.params.grupId)
  if (!jumlah) return res.status(404).json({ error: 'Pengumuman tidak ditemukan.' })
  res.json({ data: { ok: true, dihapus: jumlah } })
}))

// DELETE — hapus satu notifikasi personal
router.delete('/notifications/:id', wrap(async (req, res) => {
  await hapusNotifikasi(Number(req.params.id))
  res.json({ data: { ok: true } })
}))

export default router
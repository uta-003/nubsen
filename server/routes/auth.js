import { Router } from 'express'
import { login, logout, buatKaryawan } from '../models.js'
import { db } from '../db.js'
import { wrap } from '../utils/wrap.js'

const router = Router()

// ============ ENDPOINT PUBLIK (di-mount sebelum requireAuth) ============

// GET /api/auth/needs-setup — true bila BELUM ada karyawan sama sekali.
// Dipakai halaman login untuk menampilkan form "Pengaturan Awal" (buat akun
// admin pertama) pada instalasi baru yang masih kosong.
router.get('/needs-setup', wrap(async (_req, res) => {
  const n = (await db.get('SELECT COUNT(*) AS n FROM employees'))?.n ?? 0
  res.json({ data: { butuhSetup: Number(n) === 0 } })
}))

// POST /api/auth/setup — buat AKUN ADMIN PERTAMA. Hanya bisa dipakai saat
// tabel employees masih kosong; setelah ada akun, endpoint ini terkunci (403)
// agar tidak bisa dipakai menebas keamanan.
router.post('/setup', wrap(async (req, res) => {
  const n = (await db.get('SELECT COUNT(*) AS n FROM employees'))?.n ?? 0
  if (Number(n) > 0) {
    return res.status(403).json({ error: 'Pengaturan awal sudah selesai — silakan login dengan akun Anda.' })
  }
  const { nama, email, pin } = req.body || {}
  const namaBersih = String(nama || '').trim()
  const emailBersih = String(email || '').trim().toLowerCase()
  if (namaBersih.length < 2) return res.status(400).json({ error: 'Nama minimal 2 huruf.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailBersih)) return res.status(400).json({ error: 'Format email tidak valid.' })
  if (!/^\d{6}$/.test(String(pin || ''))) return res.status(400).json({ error: 'PIN harus tepat 6 angka.' })
  // Akun pertama otomatis menjadi admin dengan kuota cuti standar 12 hari.
  await buatKaryawan({ nama: namaBersih, email: emailBersih, pin: String(pin), isAdmin: true, cutiTahunan: 12 })
  const hasil = await login(emailBersih, String(pin))
  res.status(201).json({ data: hasil })
}))

// POST /api/auth/login — body { email, pin } → { token, karyawan }
router.post('/login', wrap(async (req, res) => {
  const { email, pin } = req.body || {}
  if (!email || !pin) return res.status(400).json({ error: 'Email dan PIN wajib diisi.' })
  const hasil = await login(email, String(pin))
  if (!hasil) return res.status(401).json({ error: 'Email atau PIN salah.' })
  res.json({ data: hasil })
}))

// POST /api/auth/logout — header Authorization: Bearer <token>
router.post('/logout', wrap(async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (token) await logout(token)
  res.json({ data: { ok: true } })
}))

export default router
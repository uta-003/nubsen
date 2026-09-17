import { Router } from 'express'
import { login, logout } from '../models.js'

const router = Router()

// POST /api/auth/login — body { email, pin } → { token, karyawan }
router.post('/login', (req, res) => {
  const { email, pin } = req.body || {}
  if (!email || !pin) return res.status(400).json({ error: 'Email dan PIN wajib diisi.' })
  const hasil = login(email, String(pin))
  if (!hasil) return res.status(401).json({ error: 'Email atau PIN salah.' })
  res.json({ data: hasil })
})

// POST /api/auth/logout — header Authorization: Bearer <token>
router.post('/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (token) logout(token)
  res.json({ data: { ok: true } })
})

export default router

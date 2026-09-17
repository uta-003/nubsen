import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { seedIfEmpty } from './seed.js'
import authRoutes from './routes/auth.js'
import overtimeRoutes from './routes/overtime.js'
import notificationRoutes from './routes/notifications.js'
import adminRoutes from './routes/admin.js'
import jadwalRoutes from './routes/jadwal.js'
import { employeeByToken } from './models.js'
import profileRoutes from './routes/profile.js'
import attendanceRoutes from './routes/attendance.js'
import leaveRoutes from './routes/leaves.js'
import { uploadsDir } from './utils/files.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 9091

const app = express()
app.set('trust proxy', 1) // berjalan di belakang proxy hosting (Render/Vercel)
// CORS: default terbuka — aplikasi PWA/Android memanggil dari domain berbeda.
// Batasi bila perlu dengan env CORS_ORIGINS, mis. "https://nubsen.vercel.app".
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : {}))
app.use(express.json({ limit: '15mb' })) // selfie dikirim sebagai dataURL base64

seedIfEmpty()
mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

app.get('/api/health', (req, res) =>
  res.json({ data: { status: 'ok', waktu: new Date().toISOString() } }),
)
app.use('/api/auth', authRoutes) // publik: login & logout

// Semua endpoint /api lainnya wajib membawa sesi: header Authorization: Bearer <token>
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const karyawan = employeeByToken(token)
  if (!karyawan) return res.status(401).json({ error: 'Sesi berakhir. Silakan login kembali.' })
  req.employeeId = karyawan.id
  next()
}
app.use('/api', requireAuth)

app.use('/api/profile', profileRoutes)
app.use('/api/jadwal', jadwalRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/leaves', leaveRoutes)
app.use('/api/overtime', overtimeRoutes)
app.use('/api/notifications', notificationRoutes)

// Panel admin — khusus karyawan ber-flag is_admin
const requireAdmin = (req, res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const karyawan = employeeByToken(token)
  if (!karyawan?.isAdmin) return res.status(403).json({ error: 'Akses khusus admin.' })
  req.employeeId = karyawan.id
  next()
}
app.use('/api/admin', requireAdmin, adminRoutes)

// 404 khusus API
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }))

// Sajikan hasil build frontend (dist/) bila ada → satu server untuk aplikasi + API,
// termasuk panel "web backend" admin di http://localhost:9091/#admin
const distDir = path.join(__dirname, '..', 'dist')
if (existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir))
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')))
  console.log(`🖥️  Aplikasi + panel admin juga tersedia di http://localhost:${PORT}/ (mis. /#admin)`)
} else {
  console.log('ℹ️  dist/ belum ada — jalankan "npm run build" di root agar aplikasi tampil di port ini.')
}

// Error handler terpusat
app.use((err, req, res, next) => {
  console.error('❌', err.message)
  res.status(err.status || 500).json({ error: err.message || 'Terjadi kesalahan pada server.' })
})

app.listen(PORT, () => {
  console.log(`🚀 NUBSEN API berjalan di http://localhost:${PORT}`)
})

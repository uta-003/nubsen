import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { seedIfEmpty } from './seed.js'
import { sinkronkanRiwayatPeringatan, lengkapiNomorSuratLama, satukanIzinDatang } from './models.js'
import { db, dbSiap, modeDatabase } from './db.js'
import authRoutes from './routes/auth.js'
import overtimeRoutes from './routes/overtime.js'
import piketRoutes from './routes/piket.js'
import notificationRoutes from './routes/notifications.js'
import adminRoutes from './routes/admin.js'
import jadwalRoutes from './routes/jadwal.js'
import slipRoutes from './routes/slip.js'
import { employeeByToken } from './models.js'
import profileRoutes from './routes/profile.js'
import attendanceRoutes from './routes/attendance.js'
import leaveRoutes from './routes/leaves.js'
import { uploadsDir, ensureUploadsDir } from './utils/files.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 9091

const app = express()
app.set('trust proxy', 1) // berjalan di belakang proxy hosting (Vercel/Render)
// CORS: default terbuka — aplikasi PWA/Android memanggil dari domain berbeda.
// Batasi bila perlu dengan env CORS_ORIGINS, mis. "https://nubsen.vercel.app".
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : {}))
// Selfie dikirim sebagai dataURL base64 (dan disimpan langsung di database).
// Batas 5 MB menjaga permintaan tetap di bawah batas 4,5 MB Vercel Function
// untuk gambar; lampiran form dibatasi 3 MB pada routes/leaves.js.
app.use(express.json({ limit: '5mb' }))

// ---------------------------------------------------------------------------
// Persiapan data — dijalankan sekali per proses (lazy pada permintaan pertama)
// sehingga kegagalan sementara (mis. jaringan ke Turso) tidak mematikan fungsi.
// ---------------------------------------------------------------------------
let janjiPersiapan = null
function persiapan() {
  if (!janjiPersiapan) {
    janjiPersiapan = (async () => {
      await dbSiap()        // buat tabel bila belum ada + migrasi ringan
      await seedIfEmpty()   // data demo (hanya bila database masih kosong)
      // Riwayat SP selalu sinkron dengan surat aktif saat server menyala.
      await sinkronkanRiwayatPeringatan()
      // Surat lama tanpa nomor otomatis diberi nomor resmi (urut, bulan & tahun otomatis).
      await lengkapiNomorSuratLama()
      // Data izin datang dengan nama LAMA ("Izin Datang Siang") disatukan ke satu
      // jenis resmi "Izin Datang Terlambat" — sekali jalan, aman diulang.
      await satukanIzinDatang()
    })().catch((err) => {
      console.error('⚠️  Persiapan data dilewati:', err.message)
      janjiPersiapan = null // coba lagi pada permintaan berikutnya
    })
  }
  return janjiPersiapan
}

app.use('/api', async (_req, _res, next) => {
  await persiapan()
  next()
})

app.get('/api/health', (_req, res) =>
  res.json({
    data: { status: 'ok', database: modeDatabase, waktu: new Date().toISOString() },
  }),
)
app.use('/api/auth', authRoutes) // publik: login & logout

// Semua endpoint /api lainnya wajib membawa sesi: header Authorization: Bearer <token>
const requireAuth = async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    const karyawan = await employeeByToken(token)
    if (!karyawan) return res.status(401).json({ error: 'Sesi berakhir. Silakan login kembali.' })
    req.employeeId = karyawan.id
    next()
  } catch (err) {
    next(err)
  }
}
app.use('/api', requireAuth)

app.use('/api/profile', profileRoutes)
app.use('/api/jadwal', jadwalRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/leaves', leaveRoutes)
app.use('/api/overtime', overtimeRoutes)
app.use('/api/piket', piketRoutes) // pengajuan piket (biaya diatur admin)
app.use('/api/notifications', notificationRoutes)
app.use('/api/slip', slipRoutes) // slip gaji karyawan per periode penggajian

// Panel admin — khusus karyawan ber-flag is_admin
const requireAdmin = async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    const karyawan = await employeeByToken(token)
    if (!karyawan?.isAdmin) return res.status(403).json({ error: 'Akses khusus admin.' })
    req.employeeId = karyawan.id
    next()
  } catch (err) {
    next(err)
  }
}
app.use('/api/admin', requireAdmin, adminRoutes)

// 404 khusus API
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }))

export default app
export { app }

// ---------------------------------------------------------------------------
// Sajikan hasil build frontend (dist/) bila ada → satu server untuk aplikasi +
// API (mis. http://localhost:9091/#admin). Di Vercel, blok ini dilewati dan
// frontend disajikan sebagai berkas statis oleh CDN.
// ---------------------------------------------------------------------------
const distDir = path.join(__dirname, '..', 'dist')
if (existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir))
  // Fallback SPA tanpa pola '*' (pola itu tidak valid pada Express 5).
  // Hanya untuk permintaan halaman (GET/HEAD yang mengharapkan HTML).
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path === '/api' || req.path.startsWith('/api/')) return next()
    if (!req.accepts('html')) return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
  console.log(`🖥️  Aplikasi + panel admin juga tersedia di http://localhost:${PORT}/ (mis. /#admin)`)
}

// Error handler terpusat — juga menangkap penolakan promise dari handler async.
app.use((err, _req, res, _next) => {
  console.error('❌', err.message)
  const status = err.status || (/lampiran|ukuran|file too large/i.test(err.message || '') ? 400 : 500)
  res.status(status).json({ error: err.message || 'Terjadi kesalahan pada server.' })
})

// ---------------------------------------------------------------------------
// Server lokal: listen hanya bila BUKAN di lingkungan serverless Vercel
// (di Vercel, aplikasi ini dipanggil sebagai handler oleh api/[...path].js).
// ---------------------------------------------------------------------------
if (!process.env.VERCEL) {
  if (ensureUploadsDir()) {
    // Berkas lama (sebelum migrasi ke database) tetap bisa dibuka saat dev.
    app.use('/uploads', express.static(uploadsDir))
  }
  app.listen(PORT, () => {
    console.log(`🚀 NUBSEN API berjalan di http://localhost:${PORT}`)
    console.log(`🗄️  Database: ${modeDatabase} (driver: ${db.mode})`)
    console.log('🔗 Health   : http://localhost:%d/api/health', PORT)
  })
}

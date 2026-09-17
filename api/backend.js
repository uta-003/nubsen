// ============================================================================
//  Entry point serverless Vercel untuk backend NUBSEN (aplikasi Express).
//
//  PENTING: berkas fungsi dinamis (mis. api/[...path].js) pada Vercel hanya
//  cocok untuk SATU segmen, sehingga rute seperti /api/auth/login tidak pernah
//  sampai ke fungsi (Vercel menjawab 404). Karena itu vercel.json memakai
//  rewrite eksplisit:
//
//      { "source": "/api/(.*)", "destination": "/api/backend?asal=$1" }
//
//  Handler ini membangun kembali URL asli (path + query) dari parameter 'asal'
//  lalu menyerahkan permintaan ke aplikasi Express.
// ============================================================================
import app from '../server/index.js'

export const config = {
  maxDuration: 60,
  // Badan permintaan dibiarkan utuh agar express.json() (JSON) dan multer
  // (multipart/form-data untuk lampiran izin) dapat membacanya sendiri.
  api: { bodyParser: false },
}

export default function handler(req, res) {
  const kueri = { ...(req.query || {}) }
  const asal = kueri.asal

  if (asal !== undefined) {
    const bagian = Array.isArray(asal) ? asal.join('/') : String(asal)
    delete kueri.asal
    const sisa = new URLSearchParams(kueri).toString()
    req.url = `/api/${bagian}${sisa ? `?${sisa}` : ''}`
  } else if (req.url && !req.url.startsWith('/api/')) {
    // Jaring pengaman bila parameter 'asal' tidak ada.
    req.url = `/api${req.url}`
  }

  // Bila platform terlanjur membaca badan permintaan, tandai agar
  // express.json() tidak menunggu aliran yang sudah habis (mencegah hang).
  if (req.body !== undefined && req.body !== null) req._body = true

  return app(req, res)
}
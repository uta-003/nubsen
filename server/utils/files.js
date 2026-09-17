import path from 'node:path'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Folder unggahan lama (menyimpan berkas yang diunggah SEBELUM migrasi ke
// penyimpanan dalam database). Dapat dipindah lewat env UPLOAD_DIR.
export const uploadsDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads')

// Membuat folder unggahan bila memungkinkan. Pada lingkungan serverless
// (Vercel) filesystem read-only — kegagalan TIDAK boleh mematikan aplikasi.
export function ensureUploadsDir() {
  try {
    mkdirSync(uploadsDir, { recursive: true })
    return true
  } catch {
    return false
  }
}

// ============================================================================
//  Penyimpanan selfie & lampiran
//  Sejak deploy serverless (Vercel Function) + database Turso, berkas TIDAK lagi
//  ditulis ke disk: dataURL base64 disimpan langsung pada kolom TEXT database.
//  Keuntungan: tahan cold start tanpa persistent disk. Tetap kompatibel dengan
//  baris lama berisi "/uploads/xxx.jpg" — frontend membiarkan data: dan http(s):
//  apa adanya (lihat assetUrl() di src/api.js).
// ============================================================================

// Memvalidasi dataURL gambar lalu mengembalikannya untuk disimpan apa adanya.
export function saveDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null
  const koma = dataUrl.indexOf(',')
  if (koma < 12) return null
  const meta = dataUrl.slice(5, koma)
  const isi = dataUrl.slice(koma + 1)
  if (!/^image\/[\w.+-]+;base64$/i.test(meta) || !isi) return null
  return dataUrl
}

// Mengubah buffer hasil upload (multer memoryStorage) menjadi dataURL.
export function bufferToDataUrl(mimetype, buffer) {
  if (!buffer || !buffer.length) return null
  return `data:${mimetype || 'application/octet-stream'};base64,${Buffer.from(buffer).toString('base64')}`
}

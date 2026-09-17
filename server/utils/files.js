import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Folder unggahan dapat dipindah lewat env UPLOAD_DIR — dipakai saat hosting
// (mis. Render: /var/data/uploads pada persistent disk). Default: server/uploads.
export const uploadsDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads')
mkdirSync(uploadsDir, { recursive: true })

// Menyimpan dataURL base64 (selfie dari kamera) sebagai file di folder uploads/.
// Mengembalikan path publik "/uploads/<nama>" atau null jika tidak valid.
export function saveDataUrl(dataUrl, prefix = 'selfie') {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null
  const [meta, base64] = dataUrl.split(',')
  if (!base64) return null
  const ext = (meta.match(/image\/(\w+)/)?.[1] || 'jpg').replace('jpeg', 'jpg')
  const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  writeFileSync(path.join(uploadsDir, name), Buffer.from(base64, 'base64'))
  return `/uploads/${name}`
}

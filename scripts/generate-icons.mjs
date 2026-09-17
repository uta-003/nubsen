// Generator ikon PNG untuk manifest PWA — murni Node.js (tanpa dependensi).
// Menggambar gradasi indigo→fuchsia + tanda centang putih, disimpan ke public/icons/.
// Jalankan sekali: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

// ---------- CRC32 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

// ---------- Menggambar ----------
function distKeSegmen(x, y, [x1, y1], [x2, y2], s) {
  x1 *= s; y1 *= s; x2 *= s; y2 *= s
  const dx = x2 - x1, dy = y2 - y1
  const L2 = dx * dx + dy * dy
  let t = L2 ? ((x - x1) * dx + (y - y1) * dy) / L2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

function buatIkon(size, { maskable = false } = {}) {
  const INDIGO = [99, 102, 241]   // #6366f1
  const FUCHSIA = [217, 70, 239]  // #d946ef
  // Polyline tanda centang (koordinat relatif 0..1)
  const titik = maskable
    ? [[0.36, 0.55], [0.47, 0.66], [0.68, 0.42]] // lebih kecil: aman utk maskable
    : [[0.28, 0.55], [0.44, 0.71], [0.76, 0.34]]
  const tebal = size * (maskable ? 0.085 : 0.11)

  const raw = Buffer.alloc((size * 4 + 1) * size)
  let off = 0
  for (let y = 0; y < size; y++) {
    raw[off++] = 0 // filter byte per baris
    for (let x = 0; x < size; x++) {
      const g = (x / size + y / size) / 2 // gradasi diagonal
      raw[off++] = Math.round(INDIGO[0] + (FUCHSIA[0] - INDIGO[0]) * g)
      raw[off++] = Math.round(INDIGO[1] + (FUCHSIA[1] - INDIGO[1]) * g)
      raw[off++] = Math.round(INDIGO[2] + (FUCHSIA[2] - INDIGO[2]) * g)
      // alpha tanda centang (anti-alias sederhana)
      let d = Infinity
      for (let i = 0; i < titik.length - 1; i++) {
        d = Math.min(d, distKeSegmen(x, y, titik[i], titik[i + 1], size))
      }
      const r = tebal / 2
      raw[off++] = d <= r ? 255 : d <= r + 1.5 ? Math.round((255 * (r + 1.5 - d)) / 1.5) : 0
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const target = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['maskable-512.png', 512, true],
]
for (const [nama, size, maskable] of target) {
  writeFileSync(path.join(outDir, nama), buatIkon(size, { maskable }))
  console.log(`✔ dibuat: public/icons/${nama} (${size}x${size}${maskable ? ', maskable' : ''})`)
}

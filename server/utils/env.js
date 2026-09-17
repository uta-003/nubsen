// ============================================================================
//  Pemuat variabel lingkungan sederhana (tanpa dependensi).
//  Membaca berkas .env pada akar proyek (dan server/.env) HANYA untuk variabel
//  yang belum diisi, sehingga:
//    * pengembangan lokal cukup menyalin .env.example -> .env,
//    * deployment (Vercel/Render) tetap memakai variabel lingkungan platform,
//    * kegagalan membaca berkas tidak pernah menghentikan aplikasi.
// ============================================================================
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const akar = path.join(__dirname, '..', '..')

let sudah = false

export function muatEnv() {
  if (sudah) return false
  sudah = true
  let adaYangDimuat = false

  for (const berkas of ['.env', '.env.local', 'server/.env']) {
    const jalur = path.join(akar, berkas)
    if (!existsSync(jalur)) continue
    let isi
    try {
      isi = readFileSync(jalur, 'utf8')
    } catch {
      continue
    }
    for (const baris of isi.split(/\r?\n/)) {
      const cocok = baris.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (!cocok) continue
      const kunci = cocok[1]
      let nilai = cocok[2].trim()
      if (/^".*"$/.test(nilai) || /^'.*'$/.test(nilai)) nilai = nilai.slice(1, -1)
      if (!process.env[kunci]) {
        process.env[kunci] = nilai
        adaYangDimuat = true
      }
    }
  }
  return adaYangDimuat
}

export default muatEnv
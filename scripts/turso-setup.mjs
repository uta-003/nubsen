// ============================================================================
//  scripts/turso-setup.mjs — membuat SELURUH tabel NUBSEN di database Turso
//  (libSQL) lalu mengisi data demo. Aman dijalankan berulang (idempotent).
//
//  Cara pakai (PowerShell):
//    $env:TURSO_DATABASE_URL = 'libsql://nubsen-uta-003.aws-ap-northeast-1.turso.io'
//    $env:TURSO_AUTH_TOKEN   = '<token>'
//    node scripts/turso-setup.mjs
//
//  Skema diambil dari server/schema.js (satu sumber kebenaran) sehingga tabel
//  di Turso selalu identik dengan yang dibuat otomatis oleh server saat menyala.
// ============================================================================
import { muatEnv } from '../server/utils/env.js'

// Muat nilai dari berkas .env (bila ada) supaya tidak perlu mengetik token.
muatEnv()

const url = (process.env.TURSO_DATABASE_URL || '').trim()
const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim()

if (!url || !authToken) {
  console.error('❌ Set TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN lebih dahulu')
  console.error('   (isi berkas .env — lihat .env.example).')
  process.exit(1)
}

const { createClient } = await import('@libsql/client/web')
const { SKEMA } = await import('../server/schema.js')
const client = createClient({ url, authToken })

console.log(`🔧 Membuat tabel di ${url} ...`)
await client.executeMultiple(SKEMA)
console.log('✅ Skema dieksekusi (CREATE TABLE/INDEX IF NOT EXISTS).')

// Pakai kode aplikasi yang sama (server/db.js + server/seed.js) supaya migrasi
// ringan & data demo persis sama dengan yang dilakukan server saat menyala.
const { dbSiap, db } = await import('../server/db.js')
const { seedIfEmpty } = await import('../server/seed.js')
await dbSiap()
console.log(`🗄️  Driver terdeteksi: ${db.mode}`)
await seedIfEmpty()

// ---------------- Laporan akhir: daftar tabel + jumlah baris ----------------
const daftar = await client.execute(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
)
console.log('\n📋 Tabel di Turso:')
let total = 0
for (const baris of daftar.rows) {
  const nama = baris.name ?? baris[0]
  const hitung = await client.execute(`SELECT COUNT(*) AS n FROM "${nama}"`)
  const n = Number(hitung.rows[0].n ?? hitung.rows[0][0] ?? 0)
  total += n
  console.log(`   ✓ ${nama.padEnd(16)} ${String(n).padStart(4)} baris`)
}
console.log(`\n🎉 Selesai — ${daftar.rows.length} tabel, ${total} baris total.`)
client.close()

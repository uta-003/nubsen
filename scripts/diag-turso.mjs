// Diagnostik sementara: memastikan koneksi Turso via @libsql/client/web.
import { muatEnv } from '../server/utils/env.js'

muatEnv()
const url = (process.env.TURSO_DATABASE_URL || '').trim()
const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim()

console.log('URL   :', url)
console.log('Token :', authToken.length, 'karakter')

const host = url.replace(/^libsql:\/\//, 'https://').replace(/^wss:\/\//, 'https://').replace(/\/+$/, '')
const headers = { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }
const badan = JSON.stringify({
  requests: [
    { type: 'execute', stmt: { sql: 'SELECT 1 AS ok' } },
    { type: 'close' },
  ],
})

for (const jalur of ['/v2/pipeline', '/v3/pipeline']) {
  try {
    const res = await fetch(host + jalur, { method: 'POST', headers, body: badan })
    const teks = await res.text()
    console.log(`${res.ok ? '✅' : '❌'} fetch ${jalur} -> ${res.status} ${teks.slice(0, 160)}`)
  } catch (e) {
    console.log(`💥 fetch ${jalur} ->`, e.message)
  }
}

// Uji client lagi untuk membandingkan, sekaligus melihat URL yang dituju.
const { createClient } = await import('@libsql/client/web')
try {
  const c = createClient({ url, authToken })
  const r = await c.execute('SELECT 1 AS ok')
  console.log('✅ @libsql/client ->', JSON.stringify(r.rows))
} catch (e) {
  console.log('❌ @libsql/client ->', e.message, '| cause:', e.cause?.message)
}


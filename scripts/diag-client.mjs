// Diagnostik: menyadap permintaan yang dikirim @libsql/client ke server.
import { createServer } from 'node:http'

const respons = JSON.stringify({
  baton: null,
  base_url: null,
  results: [
    {
      type: 'ok',
      response: {
        type: 'execute',
        result: {
          cols: [{ name: 'ok', decltype: null }],
          rows: [[{ type: 'integer', value: '1' }]],
          affected_row_count: 0,
          last_insert_rowid: null,
        },
      },
    },
    { type: 'ok', response: { type: 'close' } },
  ],
})

const server = createServer((req, res) => {
  let isi = ''
  req.on('data', (c) => { isi += c })
  req.on('end', () => {
    console.log('--- PERMINTAAN CLIENT ---')
    console.log('metode :', req.method)
    console.log('url    :', req.url)
    console.log('header :', JSON.stringify(req.headers, null, 2))
    console.log('badan  :', isi.slice(0, 200))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(respons)
  })
})

await new Promise((r) => server.listen(8787, '127.0.0.1', r))
console.log('proxy uji jalan di http://127.0.0.1:8787')

const { createClient } = await import('@libsql/client/web')
const c = createClient({ url: 'http://127.0.0.1:8787', authToken: 'TOKEN-UJI-123' })
try {
  const r = await c.execute('SELECT 1 AS ok')
  console.log('hasil  :', JSON.stringify(r.rows))
} catch (e) {
  console.log('gagal  :', e.message)
}
server.close()
// Uji cepat endpoint produksi (Render/Turso): identitas perusahaan, tren, & nomor surat.
const base = process.argv[2] || 'https://nubsen.vercel.app'
const r = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'afriani.putri@perusahaan.co.id', pin: '123456' }),
})
const token = (await r.json())?.data?.token
const p = await fetch(`${base}/api/admin/perusahaan`, { headers: { authorization: `Bearer ${token}` } })
console.log('PERUSAHAAN:', p.status, (await p.text()).slice(0, 160))
const t = await fetch(`${base}/api/admin/tren`, { headers: { authorization: `Bearer ${token}` } })
console.log('TREN:', t.status, (await t.text()).slice(0, 220))

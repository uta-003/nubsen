// Pemeriksa cepat endpoint online NUBSEN.
// Pakai: node scripts/cek-online.mjs [baseUrl]
const BASE = (process.argv[2] || 'https://nubsen.vercel.app').replace(/\/+$/, '')

async function tanya(nama, path, opsi = {}) {
  const url = BASE + path
  try {
    const res = await fetch(url, {
      method: opsi.method || 'GET',
      headers: opsi.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opsi.body ? JSON.stringify(opsi.body) : undefined,
    })
    const teks = await res.text()
    const isi = teks.length > 400 ? `${teks.slice(0, 400)}…` : teks
    const tanda = res.ok ? '✅' : '❌'
    console.log(`${tanda} ${nama}  [${res.status}]`)
    console.log(`   ${isi.replace(/\s+/g, ' ')}`)
    return { status: res.status, teks }
  } catch (err) {
    console.log(`💥 ${nama}  [GAGAL] ${err.message}`)
    return { status: 0, teks: '' }
  }
}

console.log(`🔎 Memeriksa ${BASE}\n`)
await tanya('halaman depan   GET  /', '/')
const sehat = await tanya('kesehatan       GET  /api/health', '/api/health')
await tanya('login           POST /api/auth/login', '/api/auth/login', {
  method: 'POST',
  body: { email: 'afriani.putri@perusahaan.co.id', pin: '123456' },
})
await tanya('endpoint ngawur GET  /api/tidak-ada', '/api/tidak-ada')

if (sehat.status === 200) {
  const token = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'afriani.putri@perusahaan.co.id', pin: '123456' }),
  }).then((r) => r.json()).then((j) => j?.data?.token).catch(() => null)

  if (token) {
    const h = { Authorization: `Bearer ${token}` }
    const profil = await fetch(`${BASE}/api/profile`, { headers: h }).then((r) => r.json()).catch(() => null)
    console.log(`\n👤 Profil: ${profil?.data?.nama || '-'} | jabatan: ${profil?.data?.jabatan || '-'} | sisa cuti: ${profil?.data?.sisaCuti ?? '-'}`)
    const riwayat = await fetch(`${BASE}/api/attendance/history`, { headers: h }).then((r) => r.json()).catch(() => null)
    console.log(`📚 Riwayat: ${riwayat?.data?.length ?? 0} catatan`)
    const notif = await fetch(`${BASE}/api/notifications`, { headers: h }).then((r) => r.json()).catch(() => null)
    console.log(`🔔 Notifikasi: ${notif?.data?.items?.length ?? 0} item (${notif?.data?.belumDibaca ?? 0} belum dibaca)`)
  }
}

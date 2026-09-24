// ============================================================================
//  Uji end-to-end alur PIKET (tugas jaga tambahan, berbayar).
//
//  Jalankan dengan DATA_DIR sementara supaya database kerja TIDAK tersentuh:
//    $env:DATA_DIR="$env:TEMP\nubsen-uji-piket"; $env:VERCEL="1"
//    node scripts/uji-piket.mjs
//
//  Cakupan: pengajuan karyawan (validasi) → daftar karyawan/admin → biaya piket
//  (pengaturan admin) → persetujuan/penolakan + notifikasi → penghitung gaji →
//  slip gaji karyawan. Server dijalankan di port acak pada proses ini.
// ============================================================================
import { app } from '../server/index.js'

let lulus = 0
let gagal = 0
const cek = (nama, syarat, info = '') => {
  if (syarat) { lulus++; console.log(`PASS  ${nama}${info ? ' → ' + info : ''}`) }
  else { gagal++; console.log(`FAIL  ${nama}${info ? ' → ' + info : ''}`) }
}

const server = app.listen(0)
await new Promise((r) => server.once('listening', r))
const BASE = `http://127.0.0.1:${server.address().port}`

async function req(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, data: json.data, error: json.error }
}

// ---- 1. Akun uji: database baru KOSONG → "Pengaturan Awal" lalu tambah karyawan.
// (seed hanya mengisi kalender libur resmi, bukan karyawan demo)
const butuh = await req('/api/auth/needs-setup')
cek('database baru butuh pengaturan awal', butuh.data?.butuhSetup === true, JSON.stringify(butuh.data))

const setup = await req('/api/auth/setup', { method: 'POST', body: { nama: 'Admin Uji', email: 'admin.uji@uji.local', pin: '123456' } })
cek('pengaturan awal → admin pertama + token', setup.status < 300 && !!setup.data?.token, setup.data?.karyawan?.nama || setup.error)
const tA = setup.data?.token

const karyawanBaru = await req('/api/admin/employees', {
  method: 'POST',
  token: tA,
  body: { nama: 'Karyawan Uji', email: 'karyawan.uji@uji.local', jabatan: 'Tester', departemen: 'QA', nip: 'UJI-PIKET', pin: '654321' },
})
cek('admin menambah karyawan uji', karyawanBaru.status === 201 && karyawanBaru.data?.id > 0, `id=${karyawanBaru.data?.id} ${karyawanBaru.error || ''}`)

const loginKaryawan = await req('/api/auth/login', { method: 'POST', body: { email: 'karyawan.uji@uji.local', pin: '654321' } })
cek('login karyawan uji', loginKaryawan.status === 200 && !!loginKaryawan.data?.token, loginKaryawan.error)
const tK = loginKaryawan.data?.token

// Rentang periode penggajian: pakai periode yang sudah ada, atau tetapkan baru
// (tanggal piket uji diambil dari rentang ini agar pasti ikut terhitung).
let rentang = { dari: '2026-09-01', sampai: '2026-09-30' }
const periodeAda = await req('/api/admin/gaji/periode', { token: tA })
if ((periodeAda.data || []).length) {
  const p = periodeAda.data.find((x) => x.aktif) || periodeAda.data[0]
  rentang = { dari: p.dari, sampai: p.sampai }
} else {
  const baru = await req('/api/admin/gaji/periode', { method: 'POST', token: tA, body: { nama: 'Uji Piket', ...rentang } })
  cek('tetapkan periode penggajian uji', baru.status < 300, JSON.stringify(baru.data || baru.error))
  if (baru.data?.dari) rentang = { dari: baru.data.dari, sampai: baru.data.sampai }
}
console.log(`      periode uji: ${rentang.dari} s.d. ${rentang.sampai}`)

// ---- 2. Pengajuan piket oleh karyawan ----
const awal = await req('/api/piket', { token: tK })
cek('karyawan melihat daftar piket + biaya', awal.status === 200 && Array.isArray(awal.data?.items) && typeof awal.data?.biaya === 'number', `biaya=${awal.data?.biaya}`)

const ajukan = await req('/api/piket', {
  method: 'POST',
  token: tK,
  body: { tanggal: rentang.dari, jam_mulai: '17:00', jam_selesai: '19:30', keterangan: 'Piket aula' },
})
cek('ajukan piket → 201 & Menunggu', ajukan.status === 201 && ajukan.data?.status === 'Menunggu', JSON.stringify(ajukan.data))
const idPiket = ajukan.data?.id

cek('tanggal piket salah format → 400', (await req('/api/piket', { method: 'POST', token: tK, body: { tanggal: '10-09-2026' } })).status === 400)
cek('jam hanya diisi salah satu → 400', (await req('/api/piket', { method: 'POST', token: tK, body: { tanggal: rentang.sampai, jam_mulai: '17:00' } })).status === 400)
cek('jam selesai ≤ jam mulai → 400', (await req('/api/piket', { method: 'POST', token: tK, body: { tanggal: rentang.sampai, jam_mulai: '19:00', jam_selesai: '18:00' } })).status === 400)
const dobel = await req('/api/piket', { method: 'POST', token: tK, body: { tanggal: rentang.dari } })
cek('tanggal sama tidak boleh dobel → 400', dobel.status === 400 && /sudah ada/i.test(dobel.error || ''), dobel.error)

const sesudah = await req('/api/piket', { token: tK })
cek('riwayat karyawan memuat pengajuan baru', sesudah.status === 200 && sesudah.data.items.some((x) => x.id === idPiket))

// ---- 3. Panel admin: daftar, biaya piket, persetujuan ----
const adminList = await req('/api/admin/piket', { token: tA })
cek('admin melihat piket seluruh karyawan (+nama)', adminList.status === 200 && adminList.data.items.some((x) => x.id === idPiket && !!x.nama), adminList.data.items?.[0]?.nama)

const setBiaya = await req('/api/admin/piket/biaya', { method: 'PUT', token: tA, body: { biaya: 75000 } })
cek('PUT /piket/biaya (tidak dibaca sebagai id) → 75000', setBiaya.status === 200 && setBiaya.data?.biaya === 75000, JSON.stringify(setBiaya.data))
cek('GET /piket/biaya', (await req('/api/admin/piket/biaya', { token: tA })).data?.biaya === 75000)
cek('biaya negatif dinormalkan → 0', (await req('/api/admin/piket/biaya', { method: 'PUT', token: tA, body: { biaya: -5 } })).data?.biaya === 0)
await req('/api/admin/piket/biaya', { method: 'PUT', token: tA, body: { biaya: 75000 } })
cek('karyawan melihat biaya terbaru', (await req('/api/piket', { token: tK })).data?.biaya === 75000)

cek('status asing ditolak → 400', (await req(`/api/admin/piket/${idPiket}`, { method: 'PUT', token: tA, body: { status: 'Entah' } })).status === 400)
cek('tolak tanpa alasan → 400', (await req(`/api/admin/piket/${idPiket}`, { method: 'PUT', token: tA, body: { status: 'Ditolak' } })).status === 400)
cek('piket tak dikenal → 404', (await req('/api/admin/piket/999999', { method: 'PUT', token: tA, body: { status: 'Disetujui' } })).status === 404)

const setuju = await req(`/api/admin/piket/${idPiket}`, { method: 'PUT', token: tA, body: { status: 'Disetujui' } })
cek('setujui piket → Disetujui', setuju.status === 200 && setuju.data?.status === 'Disetujui', JSON.stringify(setuju.data))

const notif = await req('/api/notifications', { token: tK })
cek('notifikasi karyawan berjenis piket', (notif.data?.items || []).some((n) => n.jenis === 'piket'), (notif.data?.items || []).find((n) => n.jenis === 'piket')?.judul)

// ---- 4. Piket DISETUJUI ikut dibayar: penghitung gaji + slip karyawan ----
const profil = await req('/api/profile', { token: tK })
const idKaryawan = profil.data?.id
const gaji = await req(`/api/admin/gaji?dari=${rentang.dari}&sampai=${rentang.sampai}`, { token: tA })
const barisK = (gaji.data?.baris || []).find((r) => r.id === idKaryawan)
cek('penghitung gaji memuat kolom piket & biayaPiket', !!barisK && barisK.biayaPiket === 75000, JSON.stringify(barisK && { piket: barisK.piket, subPiket: barisK.subPiket }))
cek('subPiket = jumlah piket × biaya piket', !!barisK && barisK.subPiket === barisK.piket * 75000, `piket=${barisK?.piket}`)
cek('total gaji = gaji + makan + lembur + piket', !!barisK && barisK.total === barisK.subGaji + barisK.subMakan + barisK.subLembur + barisK.subPiket, `total=${barisK?.total}`)

const slip = await req('/api/slip', { token: tK })
cek('slip gaji periode aktif memuat piket', slip.status === 200 && (slip.data?.slip?.piket || 0) >= 1, JSON.stringify(slip.data?.slip && { piket: slip.data.slip.piket, subPiket: slip.data.slip.subPiket }))
cek('total slip = gaji + makan + lembur + piket', !!slip.data?.slip && slip.data.slip.total === slip.data.slip.subGaji + slip.data.slip.subMakan + slip.data.slip.subLembur + slip.data.slip.subPiket)

// Piket DITOLAK tidak menambah bayaran gaji.
const kedua = await req('/api/piket', { method: 'POST', token: tK, body: { tanggal: rentang.sampai, keterangan: 'Piket gudang' } })
cek('pengajuan piket kedua (tanpa jam) → 201', kedua.status === 201, JSON.stringify(kedua.data))
await req(`/api/admin/piket/${kedua.data?.id}`, { method: 'PUT', token: tA, body: { status: 'Ditolak', alasan: 'Sudah ada petugas lain' } })
const gaji2 = await req(`/api/admin/gaji?dari=${rentang.dari}&sampai=${rentang.sampai}`, { token: tA })
const barisK2 = (gaji2.data?.baris || []).find((r) => r.id === idKaryawan)
cek('piket ditolak TIDAK dihitung dibayar', barisK2?.subPiket === barisK?.subPiket, `subPiket=${barisK2?.subPiket}`)
const adminPiket2 = await req('/api/admin/piket', { token: tA })
cek('alasan penolakan tersimpan', (adminPiket2.data.items.find((x) => x.id === kedua.data?.id)?.alasanTolak || '').includes('petugas lain'))
cek('karyawan melihat alasan penolakan di riwayatnya', ((await req('/api/piket', { token: tK })).data.items.find((x) => x.id === kedua.data?.id)?.alasanTolak || '').includes('petugas lain'))

// ---- 5. Hapus ----
cek('admin menghapus piket', (await req(`/api/admin/piket/${kedua.data?.id}`, { method: 'DELETE', token: tA })).status === 200)
const akhir = await req('/api/admin/piket', { token: tA })
cek('piket terhapus dari daftar admin', !akhir.data.items.some((x) => x.id === kedua.data?.id))
cek('karyawan tidak bisa ikut endpoint admin', (await req('/api/admin/piket', { token: tK })).status === 403)

server.close()
console.log(gagal === 0 ? `\nSemua uji piket LULUS ✅ (${lulus} pemeriksaan)` : `\n${gagal} uji GAGAL ❌ dari ${lulus + gagal} pemeriksaan`)
process.exit(gagal === 0 ? 0 : 1)

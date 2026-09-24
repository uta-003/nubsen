// ============================================================================
//  Uji end-to-end SEMANTIK "Izin Datang Terlambat" (karyawan tetap masuk kerja).
//
//  Jalankan dengan DATA_DIR sementara supaya database kerja TIDAK tersentuh:
//    $env:DATA_DIR="$env:TEMP\nubsen-uji-izin-datang"; $env:VERCEL="1"
//    node scripts/uji-izin-datang.mjs
//
//  Aturan yang diuji (sumber kebenaran: STATUS ABSENSI, bukan pengajuan):
//    • Hari izin datang yang DISETUJUI = HADIR (gaji harian + uang makan),
//      DIBERIKAN CATATAN (izinDatang), dan TIDAK PERNAH masuk kolom Izin.
//    • Penolakan mengembalikan efeknya penuh (kembali Terlambat, uang makan hangus).
//    • Izin datang tanpa absensi TIDAK menutup hari menjadi Hadir maupun Izin
//      → hari itu tetap Alpha (tidak ada jejak kehadiran).
// ============================================================================
import { app } from '../server/index.js'

const server = app.listen(0)
await new Promise((r) => server.once('listening', r))
const BASE = `http://127.0.0.1:${server.address().port}`
let lulus = 0
let gagal = 0
const cek = (nama, syarat, info = '') => {
  if (syarat) { lulus++; console.log(`PASS  ${nama}${info ? ' → ' + info : ''}`) }
  else { gagal++; console.log(`FAIL  ${nama}${info ? ' → ' + info : ''}`) }
}
async function req(path, { method = 'GET', body, token, isForm = false } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !isForm) headers['Content-Type'] = 'application/json'
  const res = await fetch(BASE + path, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, data: json.data, error: json.error }
}

const setup = await req('/api/auth/setup', { method: 'POST', body: { nama: 'Admin Uji', email: 'a@uji.local', pin: '123456' } })
const tA = setup.data.token
const k = await req('/api/admin/employees', { method: 'POST', token: tA, body: { nama: 'Karyawan Uji', email: 'k@uji.local', jabatan: 'Tester', departemen: 'QA', nip: 'U1', pin: '654321', gajiHarian: 100000, uangMakan: 15000, tarifLembur: 20000 } })
const idK = k.data.id
const tK = (await req('/api/auth/login', { method: 'POST', body: { email: 'k@uji.local', pin: '654321' } })).data.token
await req('/api/admin/jadwal', { method: 'PUT', token: tA, body: { hariKerja: [0, 1, 2, 3, 4, 5, 6] } })

// Hari uji = kemarin (pastus lewat) supaya Alpha tidak dikecualikan "hari ini".
const d = new Date(Date.now() - 86400000)
const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Absensi dibuat langsung (endpoint check-in hanya untuk hari ini) dengan status Terlambat.
const { db } = await import('../server/db.js')
await db.run(
  `INSERT INTO attendance (employee_id, tanggal, check_in, check_out, status, lat, lon, alamat)
   VALUES (?, ?, '08:30', '17:00', 'Terlambat', -6.17, 106.9, 'Kantor')`,
  [idK, iso],
)
const abs = (await req(`/api/admin/attendance?employeeId=${idK}`, { token: tA })).data.find((r) => r.tanggal === iso)

cek('absensi hari uji dibuat (Terlambat)', abs?.status === 'Terlambat', `${iso} ${abs?.status}`)

const laporan = async () => (await req(`/api/admin/reports?dari=${iso}&sampai=${iso}`, { token: tA })).data.baris.find((r) => r.id === idK)
const gaji = async () => (await req(`/api/admin/gaji?dari=${iso}&sampai=${iso}`, { token: tA })).data.baris.find((r) => r.id === idK)

// ---- 1. SEBELUM pengajuan disetujui: hari itu TERLAMBAT, belum dapat uang makan ----
const laporanSebelum = await laporan()
const gajiSebelum = await gaji()
cek('sebelum disetujui: terlambat 1, izin 0, izinDatang 0', laporanSebelum.terlambat === 1 && laporanSebelum.izin === 0 && laporanSebelum.izinDatang === 0, JSON.stringify({ t: laporanSebelum.terlambat, i: laporanSebelum.izin, id: laporanSebelum.izinDatang }))
cek('sebelum disetujui: gaji harian tetap dibayar', gajiSebelum.hariDibayar === 1 && gajiSebelum.subGaji === 100000, `dibayar=${gajiSebelum.hariDibayar} gaji=${gajiSebelum.subGaji}`)
cek('sebelum disetujui: uang makan hangus (0 hari makan)', gajiSebelum.hariMakan === 0 && gajiSebelum.subMakan === 0 && gajiSebelum.tanpaUangMakan === 1, `makan=${gajiSebelum.hariMakan}`)

// ---- 2. Pengajuan → disetujui: jadi HADIR + CATATAN, tanpa fallback ke kolom Izin ----
const fd = new FormData()
fd.append('jenis', 'Izin Datang Terlambat')
fd.append('mulai', iso)
fd.append('selesai', iso)
fd.append('keterangan', 'Uji semantik izin datang')
const lij = await req('/api/leaves', { method: 'POST', token: tK, body: fd, isForm: true })
cek('pengajuan izin datang dibuat', lij.status === 201, JSON.stringify(lij.data || lij.error))
await req(`/api/admin/leaves/${lij.data.id}`, { method: 'PUT', token: tA, body: { status: 'Disetujui' } })

const barisSesudah = await laporan()
cek('SETELAH disetujui: HADIR 1 (bukan Terlambat)', barisSesudah.hadir === 1 && barisSesudah.terlambat === 0, JSON.stringify({ h: barisSesudah.hadir, t: barisSesudah.terlambat }))
cek('SETELAH disetujui: izinDatang = 1 sebagai CATATAN', barisSesudah.izinDatang === 1, `izinDatang=${barisSesudah.izinDatang}`)
cek('SETELAH disetujui: kolom Izin = 0 (TIDAK fallback)', barisSesudah.izin === 0, `izin=${barisSesudah.izin}`)
cek('SETELAH disetujui: Alpha = 0', barisSesudah.alpha === 0, `alpha=${barisSesudah.alpha}`)
cek('SETELAH disetujui: % kehadiran = 100', barisSesudah.persen === 100, `${barisSesudah.persen}%`)

const gajiSesudah = await gaji()
cek(
  'UANG: gaji tetap, uang makan pulih sesuai aturan',
  gajiSesudah.subGaji === gajiSebelum.subGaji && gajiSesudah.subMakan - gajiSebelum.subMakan === gajiSesudah.uangMakan,
  `gaji ${gajiSebelum.subGaji}→${gajiSesudah.subGaji}, makan ${gajiSebelum.subMakan}→${gajiSesudah.subMakan}`,
)
cek('uang makan tetap diberikan (tanpa makan = 0)', gajiSesudah.hariMakan === 1 && gajiSesudah.tanpaUangMakan === 0, `makan=${gajiSesudah.hariMakan} tanpa=${gajiSesudah.tanpaUangMakan}`)

const { rekapHarian } = await import('../server/models.js')
const rekap = await rekapHarian(idK, iso, iso)
cek('rekapHarian: kategori Izin kosong', !rekap.kategori.has(iso), JSON.stringify([...rekap.kategori.entries()]))
cek('rekapHarian: bukan Alpha', rekap.alpha.length === 0, JSON.stringify(rekap.alpha))

// ---- 3. Riwayat karyawan menampilkan hari itu sebagai izin datang (bukan Izin) ----
const riwayat = (await req('/api/attendance/history', { token: tK })).data
const hariUji = riwayat.find((h) => h.tanggal === iso && h.sumber === 'absensi')
cek('riwayat: baris absensi berstatus Izin Terlambat', hariUji?.status === 'Izin Terlambat', `${hariUji?.status} — ${hariUji?.keterangan || ''}`)
cek('riwayat: keterangan menjelaskan alasan + uang makan', /izin datang/i.test(hariUji?.keterangan || ''), hariUji?.keterangan)

// ---- 4. Statistik: izin datang dihitung HADIR (dengan catatan), bukan Terlambat ----
// Pekanan dihitung dengan aturan HARI KERJA yang sama seperti server (jadwal global
// diuji = semua hari, supaya hari uji pasti masuk rekap tanpa terpengaruh kalender).
const { dataPekan } = await import('../src/utils/statistik.js')
const statistic = dataPekan(riwayat, { geser: 0, hariKerja: [0, 1, 2, 3, 4, 5, 6] })
const selUji = statistic.hari.find((h) => h.tanggal === iso)
cek('statistik: hari izin datang dihitung sebagai Hadir', !!selUji?.hariKerja && statistic.rekap.Hadir === 1 && statistic.rekap.Terlambat === 0 && statistic.rekap.izinDatang === 1, JSON.stringify(statistic.rekap))
cek('statistik: hari izin datang TIDAK masuk kolom Izin', statistic.rekap.Izin === 0, `izin=${statistic.rekap.Izin}`)
cek('statistik: % kehadiran = Hadir + Terlambat ÷ hari kerja', statistic.rekap.persen === Math.round(((statistic.rekap.Hadir + statistic.rekap.Terlambat) / statistic.rekap.hariKerja) * 100), `${statistic.rekap.persen}% dari ${statistic.rekap.Hadir + statistic.rekap.Terlambat}/${statistic.rekap.hariKerja}`)
cek('statistik: izinDatang ikut menyumbang hitungan Hadir', statistic.rekap.Hadir - statistic.rekap.izinDatang === 0, `hadir=${statistic.rekap.Hadir} catatan=${statistic.rekap.izinDatang}`)

// ---- 5. DITOLAK → efek penuh dikembalikan (kembali Terlambat, uang makan hangus) ----
const tolakTanpaAlasan = await req(`/api/admin/leaves/${lij.data.id}`, { method: 'PUT', token: tA, body: { status: 'Ditolak' } })
cek('tolak tanpa alasan → 400', tolakTanpaAlasan.status === 400, tolakTanpaAlasan.error || '')
const tolak = await req(`/api/admin/leaves/${lij.data.id}`, { method: 'PUT', token: tA, body: { status: 'Ditolak', alasan: 'Uji penolakan' } })
cek('tolak dengan alasan → 200', tolak.status === 200, tolak.error || '')

const laporanTolak = await laporan()
const gajiTolak = await gaji()
cek('setelah ditolak: kembali Terlambat 1, Hadir 0', laporanTolak.terlambat === 1 && laporanTolak.hadir === 0, JSON.stringify({ h: laporanTolak.hadir, t: laporanTolak.terlambat }))
cek('setelah ditolak: catatan izinDatang hilang & kolom Izin tetap 0', laporanTolak.izinDatang === 0 && laporanTolak.izin === 0, `izinDatang=${laporanTolak.izinDatang} izin=${laporanTolak.izin}`)
cek('setelah ditolak: gaji tetap dibayar, uang makan hangus lagi', gajiTolak.subGaji === gajiSesudah.subGaji && gajiTolak.hariMakan === 0 && gajiTolak.subMakan === 0, `gaji=${gajiTolak.subGaji} makan=${gajiTolak.hariMakan}`)
const rekapTolak = await rekapHarian(idK, iso, iso)
cek('setelah ditolak: rekapHarian tetap kehadiran (bukan Alpha)', rekapTolak.alpha.length === 0 && !rekapTolak.kategori.has(iso), JSON.stringify({ alpha: rekapTolak.alpha, kategori: [...rekapTolak.kategori.entries()] }))

// ---- 6. Izin datang TANPA absensi tidak menutup hari (tetap Alpha, bukan Izin) ----
const d2 = new Date(Date.now() - 2 * 86400000)
const iso2 = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}-${String(d2.getDate()).padStart(2, '0')}`
const fd2 = new FormData()
fd2.append('jenis', 'Izin Datang Terlambat')
fd2.append('mulai', iso2)
fd2.append('selesai', iso2)
fd2.append('keterangan', 'Uji tanpa absensi')
const lij2 = await req('/api/leaves', { method: 'POST', token: tK, body: fd2, isForm: true })
cek('pengajuan izin datang tanpa absensi dibuat', lij2.status === 201, JSON.stringify(lij2.data || lij2.error))
await req(`/api/admin/leaves/${lij2.data.id}`, { method: 'PUT', token: tA, body: { status: 'Disetujui' } })
const laporanTanpaAbsen = (await req(`/api/admin/reports?dari=${iso2}&sampai=${iso2}`, { token: tA })).data.baris.find((r) => r.id === idK)
cek('tanpa absensi: TIDAK dihitung Hadir', laporanTanpaAbsen.hadir === 0 && laporanTanpaAbsen.izinDatang === 0, JSON.stringify({ h: laporanTanpaAbsen.hadir, id: laporanTanpaAbsen.izinDatang }))
cek('tanpa absensi: TIDAK fallback ke kolom Izin', laporanTanpaAbsen.izin === 0, `izin=${laporanTanpaAbsen.izin}`)
cek('tanpa absensi: tetap Alpha', laporanTanpaAbsen.alpha === 1, `alpha=${laporanTanpaAbsen.alpha}`)

server.close()
console.log(gagal === 0 ? `\nSemua uji izin datang LULUS ✅ (${lulus} pemeriksaan)` : `\n${gagal} uji GAGAL ❌ dari ${lulus + gagal} pemeriksaan`)
process.exit(gagal === 0 ? 0 : 1)

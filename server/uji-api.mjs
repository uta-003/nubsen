// Uji end-to-end cepat untuk semua endpoint AbsenKu (dijalankan sekali pakai).
const BASE = 'http://localhost:9091'
let lulus = 0
let gagal = 0

function cek(nama, syarat, info = '') {
  if (syarat) { lulus++; console.log(`PASS  ${nama}${info ? ' → ' + info : ''}`) }
  else { gagal++; console.log(`FAIL  ${nama}${info ? ' → ' + info : ''}`) }
}

async function req(path, { method = 'GET', body, token, isForm = false } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (!isForm && body) headers['Content-Type'] = 'application/json'
  const res = await fetch(BASE + path, {
    method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, data: json.data, error: json.error }
}

// ---- 1. Login & proteksi sesi ----
const admin = await req('/api/auth/login', { method: 'POST', body: { email: 'afriani.putri@perusahaan.co.id', pin: '123456' } })
cek('login admin', admin.status === 200 && !!admin.data?.token, admin.data?.karyawan?.nama)
const tA = admin.data.token

const budi = await req('/api/auth/login', { method: 'POST', body: { email: 'budi.santoso@perusahaan.co.id', pin: '654321' } })
cek('login karyawan', budi.status === 200 && !!budi.data?.token, budi.data?.karyawan?.nama)
const tB = budi.data.token
// Simpan daftar notifikasi awal supaya sisa notifikasi dari alur uji bisa dibersihkan nanti.
const notifAwalIds = new Set(((await req('/api/notifications', { token: tB })).data.items || []).map((n) => n.id))

cek('login PIN salah → 401', (await req('/api/auth/login', { method: 'POST', body: { email: 'afriani.putri@perusahaan.co.id', pin: '000000' } })).status === 401)
cek('endpoint tanpa token → 401', (await req('/api/profile')).status === 401)
cek('non-admin ke /api/admin/overview → 403', (await req('/api/admin/overview', { token: tB })).status === 403)

const ov = await req('/api/admin/overview', { token: tA })
cek('admin overview', ov.status === 200, JSON.stringify(ov.data))

// ---- 2. CRUD Karyawan ----
const tambah = await req('/api/admin/employees', { method: 'POST', token: tA, body: { nama: 'Uji Coba', email: 'uji.coba@perusahaan.co.id', jabatan: 'Tester', departemen: 'QA', nip: 'UJI-001', pin: '111111' } })
cek('tambah karyawan', tambah.status === 201 && tambah.data?.id > 0, `id=${tambah.data?.id}`)
const idUji = tambah.data?.id

const ubah = await req(`/api/admin/employees/${idUji}`, { method: 'PUT', token: tA, body: { jabatan: 'Senior Tester', cutiTahunan: 15 } })
cek('ubah karyawan', ubah.status === 200 && ubah.data?.jabatan === 'Senior Tester', `cuti=${ubah.data?.cutiTahunan}`)

const loginUji = await req('/api/auth/login', { method: 'POST', body: { email: 'uji.coba@perusahaan.co.id', pin: '111111' } })
cek('PIN karyawan baru bisa dipakai login', loginUji.status === 200)
const tUji = loginUji.data?.token

// ---- 3. Lembur: pengajuan karyawan → persetujuan admin → notifikasi ----
const lemburBaru = await req('/api/overtime', { method: 'POST', token: tB, body: { tanggal: '2026-09-20', jam_mulai: '18:00', jam_selesai: '21:00', keterangan: 'Penyelesaian rilis' } })
cek('ajukan lembur', lemburBaru.status === 201 && lemburBaru.data?.status === 'Menunggu', JSON.stringify(lemburBaru.data))
const idLembur = lemburBaru.data?.id

cek('validasi jam lembur → 400', (await req('/api/overtime', { method: 'POST', token: tB, body: { tanggal: '2026-09-20', jam_mulai: '20:00', jam_selesai: '18:00' } })).status === 400)

const listLemburB = await req('/api/overtime', { token: tB })
cek('karyawan lihat lembur sendiri', listLemburB.status === 200 && listLemburB.data.some((x) => x.id === idLembur))

const notifSebelum = await req('/api/notifications', { token: tB })
const jmlSebelum = notifSebelum.data?.items?.length ?? 0
cek('notifikasi otomatis saat ajukan lembur', notifSebelum.data.items[0]?.jenis === 'lembur', notifSebelum.data.items[0]?.judul)

const adminLembur = await req('/api/admin/overtime', { token: tA })
cek('admin lihat semua lembur + nama', adminLembur.status === 200 && adminLembur.data.some((x) => x.id === idLembur && x.nama))

const setuju = await req(`/api/admin/overtime/${idLembur}`, { method: 'PUT', token: tA, body: { status: 'Disetujui' } })
cek('admin setujui lembur', setuju.status === 200 && setuju.data?.status === 'Disetujui')
cek('status lembur tidak valid → 400', (await req(`/api/admin/overtime/${idLembur}`, { method: 'PUT', token: tA, body: { status: 'Sah' } })).status === 400)

const notifSetelah = await req('/api/notifications', { token: tB })
cek('notifikasi persetujuan sampai ke karyawan', (notifSetelah.data?.items?.length ?? 0) === jmlSebelum + 1 && notifSetelah.data.items[0].judul.includes('disetujui'), notifSetelah.data.items[0]?.judul)

// ---- 4. Pemberitahuan admin → muncul di notifikasi SEMUA karyawan ----
// Jumlah penerima harus sama dengan jumlah karyawan yang terdaftar.
const jumlahKaryawan = (await req('/api/admin/employees', { token: tA })).data.length
const kirimBroadcast = await req('/api/admin/notifications', { method: 'POST', token: tA, body: { judul: '📣 Pengumuman uji', pesan: 'Rapat umum Senin 08:00.', jenis: 'pengumuman' } })
cek('admin kirim pengumuman ke semua karyawan', kirimBroadcast.status === 201 && kirimBroadcast.data?.jumlah === jumlahKaryawan && !!kirimBroadcast.data?.grupId, `penerima=${kirimBroadcast.data?.jumlah}/${jumlahKaryawan} grup=${kirimBroadcast.data?.grupId}`)
const grupUji = kirimBroadcast.data?.grupId

cek('pengumuman tanpa judul → 400', (await req('/api/admin/notifications', { method: 'POST', token: tA, body: { pesan: 'kosong' } })).status === 400)
cek('jenis notifikasi tak dikenal → 400', (await req('/api/admin/notifications', { method: 'POST', token: tA, body: { judul: 'x', jenis: 'ngawur' } })).status === 400)

const notifBudi = await req('/api/notifications', { token: tB })
const barisBudi = notifBudi.data.items.find((n) => n.grupId === grupUji)
const barisAfriani = (await req('/api/notifications', { token: tA })).data.items.find((n) => n.grupId === grupUji)
cek('pengumuman muncul di notifikasi karyawan', !!barisBudi && barisBudi.jenis === 'pengumuman', barisBudi?.judul)
cek('pengumuman muncul juga di karyawan lain (baris terpisah)', !!barisAfriani && barisAfriani.id !== barisBudi?.id, `id ${barisAfriani?.id} vs ${barisBudi?.id}`)

const personalBudi = await req('/api/admin/notifications', { method: 'POST', token: tA, body: { employeeId: budi.data.karyawan.id, judul: ' Notif personal uji', pesan: 'Hanya untuk Budi.', jenis: 'info' } })
const idNotifPersonal = personalBudi.data?.id
cek('notif personal tidak terlihat karyawan lain', !(await req('/api/notifications', { token: tA })).data.items.some((n) => n.id === idNotifPersonal))

// Status baca per karyawan harus terpisah (tidak saling menghapus badge).
await req('/api/notifications/read', { method: 'POST', token: tB })
const sesudahBudi = await req('/api/notifications', { token: tB })
const sesudahAfriani = await req('/api/notifications', { token: tA })
cek('Budi tandai dibaca → salinannya tercentang', sesudahBudi.data.items.find((n) => n.grupId === grupUji)?.dibaca === true)
cek('badge Budi kembali 0', sesudahBudi.data.belumDibaca === 0, `belumDibaca=${sesudahBudi.data.belumDibaca}`)
cek('salinan Afriani TETAP belum dibaca', sesudahAfriani.data.items.find((n) => n.grupId === grupUji)?.dibaca === false, `dibaca=${sesudahAfriani.data.items.find((n) => n.grupId === grupUji)?.dibaca}`)
cek('badge Afriani tidak ikut terhapus', sesudahAfriani.data.belumDibaca > 0, `belumDibaca=${sesudahAfriani.data.belumDibaca}`)

// Panel admin: 1 kartu per pengumuman + statistik baca + nama yang belum membaca.
const listAdminNotif = await req('/api/admin/notifications', { token: tA })
const kartuGrup = listAdminNotif.data.find((n) => n.grupId === grupUji)
cek('admin lihat pengumuman terkelompok (1 kartu)', !!kartuGrup && kartuGrup.total === jumlahKaryawan, `total=${kartuGrup?.total}/${jumlahKaryawan}`)
cek('admin lihat 1 sudah dibaca + daftar belum baca', kartuGrup?.dibaca === 1 && kartuGrup?.belumBaca.length === jumlahKaryawan - 1 && kartuGrup?.belumBaca.includes('Afriani Putri'), `dibaca=${kartuGrup?.dibaca} belum=[${kartuGrup?.belumBaca?.join(', ')}]`)

// Edit pengumuman → semua penerima melihat versi terbaru, status baca direset.
const editGrup = await req(`/api/admin/notifications/grup/${grupUji}`, { method: 'PUT', token: tA, body: { judul: ' Pengumuman uji (revisi)', jenis: 'penting' } })
cek('admin edit pengumuman', editGrup.status === 200 && editGrup.data?.judul.includes('revisi') && editGrup.data?.jenis === 'penting')
const editPesan = await req(`/api/admin/notifications/grup/${grupUji}`, { method: 'PUT', token: tA, body: { pesan: 'Rapat diundur ke 09:00.' } })
cek('edit mengubah isi & reset status baca', editPesan.data?.dibaca === 0 && editPesan.data?.pesan.includes('09:00'), `dibaca=${editPesan.data?.dibaca}`)
cek('karyawan melihat versi terbaru', (await req('/api/notifications', { token: tB })).data.items.find((n) => n.grupId === grupUji)?.judul.includes('revisi'))
cek('edit grup tidak ada → 404', (await req('/api/admin/notifications/grup/tidakada', { method: 'PUT', token: tA, body: { judul: 'x' } })).status === 404)

// Hapus pengumuman → hilang dari semua karyawan sekaligus.
cek('admin hapus pengumuman (semua baris)', (await req(`/api/admin/notifications/grup/${grupUji}`, { method: 'DELETE', token: tA })).data?.dihapus === jumlahKaryawan, `dihapus harus ${jumlahKaryawan}`)
cek('pengumuman terhapus dari karyawan', !(await req('/api/notifications', { token: tB })).data.items.some((n) => n.grupId === grupUji))
cek('hapus grup tidak ada → 404', (await req(`/api/admin/notifications/grup/${grupUji}`, { method: 'DELETE', token: tA })).status === 404)
cek('admin hapus notifikasi personal', (await req(`/api/admin/notifications/${idNotifPersonal}`, { method: 'DELETE', token: tA })).status === 200)

// ---- 5. Izin: pengajuan karyawan → admin setujui ----
const fd = new FormData()
fd.append('jenis', 'Sakit')
fd.append('mulai', '2026-09-25')
fd.append('selesai', '2026-09-26')
fd.append('keterangan', 'Demam tinggi (uji)')
const izinBaru = await req('/api/leaves', { method: 'POST', token: tB, body: fd, isForm: true })
cek('ajukan izin (multipart)', izinBaru.status === 201, `id=${izinBaru.data?.id}`)
const idIzin = izinBaru.data?.id

cek('validasi tanggal izin → 400', (await req('/api/leaves', { method: 'POST', token: tB, body: (() => { const f = new FormData(); f.append('jenis', 'Izin'); f.append('mulai', '2026-09-30'); f.append('selesai', '2026-09-01'); return f })(), isForm: true })).status === 400)

const listIzinAdmin = await req('/api/admin/leaves', { token: tA })
cek('admin lihat izin semua karyawan', listIzinAdmin.data.some((x) => x.id === idIzin && x.nama))
cek('admin setujui izin', (await req(`/api/admin/leaves/${idIzin}`, { method: 'PUT', token: tA, body: { status: 'Disetujui' } })).status === 200)
cek('admin tolak izin (status valid)', (await req(`/api/admin/leaves/${idIzin}`, { method: 'PUT', token: tA, body: { status: 'Ditolak' } })).status === 200)

// ---- 5b. Kuota cuti: Menunggu/Diketujui memotong, Ditolak mengembalikan ----
const cutiAwal = (await req('/api/profile', { token: tB })).data.sisaCuti
const fc = new FormData()
fc.append('jenis', 'Cuti Tahunan')
fc.append('mulai', '2026-10-05')
fc.append('selesai', '2026-10-07')
fc.append('keterangan', 'Cuti keluarga (uji kuota)')
const cutiBaru = await req('/api/leaves', { method: 'POST', token: tB, body: fc, isForm: true })
const idCuti = cutiBaru.data?.id
const cutiMenunggu = (await req('/api/profile', { token: tB })).data.sisaCuti
cek('cuti (Menunggu) memotong kuota 3 hari', cutiMenunggu === cutiAwal - 3, `${cutiAwal} → ${cutiMenunggu}`)

await req(`/api/admin/leaves/${idCuti}`, { method: 'PUT', token: tA, body: { status: 'Ditolak' } })
const cutiDitolak = (await req('/api/profile', { token: tB })).data.sisaCuti
cek('cuti Ditolak mengembalikan kuota', cutiDitolak === cutiAwal, `${cutiMenunggu} → ${cutiDitolak}`)

await req(`/api/admin/leaves/${idCuti}`, { method: 'PUT', token: tA, body: { status: 'Disetujui' } })
const cutiDisetujui = (await req('/api/profile', { token: tB })).data.sisaCuti
cek('cuti Disetujui memotong kuota', cutiDisetujui === cutiAwal - 3, `${cutiDitolak} → ${cutiDisetujui}`)

// ---- 6. Absensi: check-in karyawan + koreksi & hapus oleh admin ----
const hariIni = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()
// Bersihkan catatan absensi hari ini agar uji bisa diulang berkali-kali.
const bersihkanHariIni = async (empId) => {
  const rows = (await req(`/api/admin/attendance?employeeId=${empId}`, { token: tA })).data || []
  for (const r of rows.filter((x) => x.tanggal === hariIni)) {
    await req(`/api/admin/attendance/${r.id}`, { method: 'DELETE', token: tA })
  }
}
await bersihkanHariIni(budi.data.karyawan.id)
await bersihkanHariIni(loginUji.data.karyawan.id)

const masuk = await req('/api/attendance/check-in', { method: 'POST', token: tB, body: { lat: -6.1765782, lon: 106.899041, alamat: 'Kantor Pusat', selfie: null } })
cek('check-in (geofence 0 m)', masuk.status === 200 && masuk.data?.diLuarArea === false, `jarak=${masuk.data?.jarak} m, status=${masuk.data?.status}`)

cek('check-in duplikat → 409', (await req('/api/attendance/check-in', { method: 'POST', token: tB, body: { lat: -6.1765782, lon: 106.899041 } })).status === 409)

const absJauh = await req('/api/attendance/check-in', { method: 'POST', token: tUji, body: { lat: -6.1770000, lon: 106.9000000, alamat: 'Luar area', selfie: null } })
cek('check-in luar radius ditandai', absJauh.status === 200 && absJauh.data?.diLuarArea === true, `jarak=${absJauh.data?.jarak} m`)

const keluar = await req('/api/attendance/check-out', { method: 'POST', token: tB, body: { lat: -6.1765782, lon: 106.899041, alamat: 'Kantor Pusat' } })
cek('check-out karyawan', keluar.status === 200 && !!keluar.data?.checkOut)

const daftarAbsAdmin = await req(`/api/admin/attendance?employeeId=${budi.data.karyawan.id}`, { token: tA })
const barisAbs = daftarAbsAdmin.data.find((a) => a.tanggal === masuk.data.tanggal)
cek('admin lihat absensi + filter karyawan', !!barisAbs && !!barisAbs.nama, `id=${barisAbs?.id}`)

const koreksi = await req(`/api/admin/attendance/${barisAbs.id}`, { method: 'PUT', token: tA, body: { checkIn: '07:45', status: 'Hadir' } })
cek('admin koreksi absensi', koreksi.status === 200 && koreksi.data?.checkIn === '07:45', `status=${koreksi.status} data=${JSON.stringify(koreksi.data)} err=${koreksi.error}`)

// ---- 7. Bersihkan data uji ----
await req(`/api/admin/leaves/${idCuti}`, { method: 'DELETE', token: tA })
await req(`/api/admin/leaves/${idIzin}`, { method: 'DELETE', token: tA })
await req(`/api/admin/overtime/${idLembur}`, { method: 'DELETE', token: tA })
cek('admin hapus absensi', (await req(`/api/admin/attendance/${barisAbs.id}`, { method: 'DELETE', token: tA })).status === 200)
cek('hapus karyawan uji (cascade)', (await req(`/api/admin/employees/${idUji}`, { method: 'DELETE', token: tA })).status === 200)

// Hapus sisa notifikasi yang lahir dari alur uji agar data demo tetap bersih.
let sisaNotif = 0
for (const n of (await req('/api/admin/notifications', { token: tA })).data || []) {
  if (n.employeeId === budi.data.karyawan.id && !notifAwalIds.has(n.id)) {
    await req(`/api/admin/notifications/${n.id}`, { method: 'DELETE', token: tA })
    sisaNotif++
  }
}
cek('sisa notifikasi uji dibersihkan', (await req('/api/notifications', { token: tB })).data.items.every((n) => notifAwalIds.has(n.id)), `${sisaNotif} dihapus`)

// Kuota akun demo harus tetap utuh setelah pengujian (tidak tercemar data uji).
const profilDemo = await req('/api/profile', { token: tB })
cek('kuota akun demo tetap utuh setelah bersih-bersih', profilDemo.data?.sisaCuti === cutiAwal, `${cutiAwal} → ${profilDemo.data?.sisaCuti}`)

// ---- 8. Logout ----
cek('logout admin', (await req('/api/auth/logout', { method: 'POST', token: tA })).status === 200)
cek('token setelah logout → 401', (await req('/api/profile', { token: tA })).status === 401)
await req('/api/auth/logout', { method: 'POST', token: tB })

console.log(`\n=== RINGKASAN: ${lulus} lulus, ${gagal} gagal ===`)
process.exit(gagal ? 1 : 0)
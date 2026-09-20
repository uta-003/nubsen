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
cek('admin tolak izin TANPA alasan → 400', (await req(`/api/admin/leaves/${idIzin}`, { method: 'PUT', token: tA, body: { status: 'Ditolak' } })).status === 400)
cek('admin tolak izin (dengan alasan)', (await req(`/api/admin/leaves/${idIzin}`, { method: 'PUT', token: tA, body: { status: 'Ditolak', alasan: 'Uji penolakan — kebutuhan proyek' } })).status === 200)

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

await req(`/api/admin/leaves/${idCuti}`, { method: 'PUT', token: tA, body: { status: 'Ditolak', alasan: 'Uji penolakan kuota cuti' } })
const cutiDitolak = (await req('/api/profile', { token: tB })).data.sisaCuti
cek('cuti Ditolak mengembalikan kuota', cutiDitolak === cutiAwal, `${cutiMenunggu} → ${cutiDitolak}`)

await req(`/api/admin/leaves/${idCuti}`, { method: 'PUT', token: tA, body: { status: 'Disetujui' } })
const cutiDisetujui = (await req('/api/profile', { token: tB })).data.sisaCuti
cek('cuti Disetujui memotong kuota', cutiDisetujui === cutiAwal - 3, `${cutiDitolak} → ${cutiDisetujui}`)

// ---- 5c. Jadwal kerja (hari kerja) & laporan kehadiran ----
const tanggalISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const hariIniUji = tanggalISO()

const jadwal0 = (await req('/api/admin/jadwal', { token: tA })).data
cek('admin lihat jadwal (jam + hari kerja)', !!jadwal0?.jamMasukBatas && Array.isArray(jadwal0?.hariKerja), `hari kerja: ${jadwal0?.hariKerja?.join(',')}`)

const setJadwal = (hariKerja) => req('/api/admin/jadwal', { method: 'PUT', token: tA, body: { jamMasukBatas: jadwal0.jamMasukBatas, jamPulang: jadwal0.jamPulang, hariKerja } })

const ubahJadwal = await setJadwal([1, 2, 3, 4, 5, 6])
cek('ubah hari kerja (Sen–Sab)', ubahJadwal.status === 200 && ubahJadwal.data?.hariKerja?.length === 6, `→ ${ubahJadwal.data?.hariKerja?.join(',')}`)

cek('hari kerja kosong → 400', (await setJadwal([])).status === 400)
cek('hari kerja tidak valid → 400', (await setJadwal([9])).status === 400)
cek('jam jadwal tidak valid → 400', (await req('/api/admin/jadwal', { method: 'PUT', token: tA, body: { jamMasukBatas: '25:00', jamPulang: '17:00' } })).status === 400)

const lap = await req(`/api/admin/reports?dari=${hariIniUji.slice(0, 7)}-01&sampai=${hariIniUji}`, { token: tA })
cek('laporan kehadiran admin', lap.status === 200 && Array.isArray(lap.data?.baris) && lap.data?.ringkasan?.totalKaryawan > 0, `hari kerja=${lap.data?.hariKerja}, karyawan=${lap.data?.ringkasan?.totalKaryawan}`)
cek('laporan memakai hari kerja dari jadwal', lap.data?.hariKerjaHari?.length === 6, lap.data?.hariKerjaHari?.join(','))
cek('laporan punya rekap departemen', Array.isArray(lap.data?.rekap) && lap.data.rekap.length > 0, `${lap.data?.rekap?.length} departemen`)
cek('laporan punya kolom hadirLibur', lap.data?.ringkasan?.hadirLibur != null && lap.data.baris.every((r) => r.hadirLibur != null))

// ---- 5d. Penghitung gaji (per karyawan/hari + uang makan + lembur) ----
const gaji = await req(`/api/admin/gaji?dari=${hariIniUji.slice(0, 7)}-01&sampai=${hariIniUji}`, { token: tA })
cek('laporan gaji admin', gaji.status === 200 && Array.isArray(gaji.data?.baris) && typeof gaji.data?.ringkasan?.total === 'number', `total=${gaji.data?.ringkasan?.total}`)
cek('laporan gaji punya tarif & subtotal', gaji.data?.baris?.every((r) => r.gajiHarian != null && r.uangMakan != null && r.tarifLembur != null && r.total != null))
cek('alasan penolakan ikut tersimpan', Array.isArray(gaji.data?.baris)) // laporan gaji tak terpengaruh status penolakan
cek('reports non-admin → 403', (await req('/api/admin/reports', { token: tB })).status === 403)
cek('reports tanggal salah → 400', (await req('/api/admin/reports?dari=17-09-2026', { token: tA })).status === 400)
cek('reports dari > sampai → 400', (await req(`/api/admin/reports?dari=${hariIniUji}&sampai=${hariIniUji.slice(0, 7)}-01`, { token: tA })).status === 400)

// Kembalikan jadwal ke pengaturan awal agar data demo tidak berubah.
const kembali = await setJadwal(jadwal0.hariKerja)
cek('jadwal dikembalikan seperti semula', kembali.status === 200 && kembali.data?.hariKerja?.join(',') === jadwal0.hariKerja.join(','), kembali.data?.hariKerja?.join(','))

// ---- 5e. Status karyawan + aturan uang makan (telat) + periode penggajian ----
// Status kepegawaian dari form Karyawan: nilai sah tersimpan, nilai asing ditolak.
const ubahStatus = await req(`/api/admin/employees/${idUji}`, { method: 'PUT', token: tA, body: { statusKaryawan: 'Karyawan Kontrak' } })
cek('ubah status karyawan → Karyawan Kontrak', ubahStatus.status === 200 && ubahStatus.data?.statusKaryawan === 'Karyawan Kontrak', ubahStatus.data?.statusKaryawan)
cek('status karyawan tak dikenal → 400', (await req(`/api/admin/employees/${idUji}`, { method: 'PUT', token: tA, body: { statusKaryawan: 'Freelance' } })).status === 400)

// Rincian kuota cuti ikut dikirim ke aplikasi karyawan (sisa cuti berkurang live).
const profilUji = await req('/api/profile', { token: tUji })
cek('profil memuat status + rincian cuti', profilUji.data?.statusKaryawan === 'Karyawan Kontrak' && profilUji.data?.cutiTerpakai != null && profilUji.data?.cutiDisetujui != null, `terpakai=${profilUji.data?.cutiTerpakai} disetujui=${profilUji.data?.cutiDisetujui} menunggu=${profilUji.data?.cutiMenunggu}`)

// Satu hari TERLAMBAT → hari dibayar 1, tetapi uang makan 0 (tidak dapat).
await setJadwal([0, 1, 2, 3, 4, 5, 6]) // pastikan hari ini hari kerja
const absensiHariIni = async (empId) => ((await req(`/api/admin/attendance?employeeId=${empId}`, { token: tA })).data || []).filter((r) => r.tanggal === hariIniUji)
const bersihkanAbsensiHariIni = async (empId) => {
  for (const r of await absensiHariIni(empId)) await req(`/api/admin/attendance/${r.id}`, { method: 'DELETE', token: tA })
}
await bersihkanAbsensiHariIni(idUji)
await req(`/api/admin/employees/${idUji}`, { method: 'PUT', token: tA, body: { gajiHarian: 100000, uangMakan: 15000, tarifLembur: 20000 } })
await req('/api/attendance/check-in', { method: 'POST', token: tUji, body: { lat: -6.1765782, lon: 106.899041, alamat: 'Kantor Pusat', selfie: null } })
const recUji = (await absensiHariIni(idUji))[0]
await req(`/api/admin/attendance/${recUji.id}`, { method: 'PUT', token: tA, body: { status: 'Terlambat' } })

const gajiHariIni = await req(`/api/admin/gaji?dari=${hariIniUji}&sampai=${hariIniUji}`, { token: tA })
const barisTerlambat = gajiHariIni.data?.baris?.find((r) => r.id === idUji)
cek('telat: 1 hari dibayar & 0 hari uang makan', barisTerlambat?.terlambat === 1 && barisTerlambat?.hariDibayar === 1 && barisTerlambat?.hariMakan === 0 && barisTerlambat?.tanpaUangMakan === 1, `dibayar=${barisTerlambat?.hariDibayar} makan=${barisTerlambat?.hariMakan} telat=${barisTerlambat?.terlambat}`)
cek('telat: gaji harian dibayar, uang makan hangus', barisTerlambat?.subGaji === 100000 && barisTerlambat?.subMakan === 0 && barisTerlambat?.potonganUangMakan === 15000, `subGaji=${barisTerlambat?.subGaji} subMakan=${barisTerlambat?.subMakan} potongan=${barisTerlambat?.potonganUangMakan}`)
cek('ringkasan gaji memuat total tanpa uang makan', (gajiHariIni.data?.ringkasan?.tanpaUangMakan ?? 0) >= 1 && gajiHariIni.data?.ringkasan?.potonganUangMakan >= 15000, `tanpaUangMakan=${gajiHariIni.data?.ringkasan?.tanpaUangMakan}`)

// Periode penggajian → slip gaji karyawan mengikuti periode yang AKTIF.
const periodeAwal = (await req('/api/admin/gaji/periode', { token: tA })).data || []
const periodeAwalAktif = periodeAwal.find((p) => p.aktif) || null
const periodeBaru = await req('/api/admin/gaji/periode', { method: 'POST', token: tA, body: { nama: '', dari: hariIniUji, sampai: hariIniUji } })
cek('tetapkan periode penggajian (nama otomatis)', periodeBaru.status === 201 && !!periodeBaru.data?.nama && periodeBaru.data?.aktif === true, periodeBaru.data?.nama)
cek('periode dengan tanggal tidak valid → 400', (await req('/api/admin/gaji/periode', { method: 'POST', token: tA, body: { dari: '1-9-2026', sampai: hariIniUji } })).status === 400)
cek('periode dari > sampai → 400', (await req('/api/admin/gaji/periode', { method: 'POST', token: tA, body: { dari: hariIniUji, sampai: '2026-01-01' } })).status === 400)

const slip = await req('/api/slip', { token: tUji })
cek('slip gaji karyawan mengikuti periode aktif', slip.status === 200 && slip.data?.periode?.id === periodeBaru.data?.id && !!slip.data?.slip, `periode=${slip.data?.periode?.nama}`)
cek('slip gaji = gaji + uang makan + lembur', slip.data?.slip?.total === (slip.data?.slip?.subGaji + slip.data?.slip?.subMakan + slip.data?.slip?.subLembur), `total=${slip.data?.slip?.total}`)
cek('slip gaji: telat tidak dapat uang makan', slip.data?.slip?.hariMakan === 0 && slip.data?.slip?.subMakan === 0 && slip.data?.slip?.total === 100000 && slip.data?.slip?.hariMakan === (slip.data?.slip?.hadir + slip.data?.slip?.hadirLibur), `makan=${slip.data?.slip?.hariMakan} total=${slip.data?.slip?.total}`)
cek('karyawan dapat notifikasi slip gaji', (await req('/api/notifications', { token: tUji })).data.items.some((n) => n.jenis === 'gaji'))
cek('admin lihat daftar periode penggajian', (await req('/api/admin/gaji/periode', { token: tA })).data.some((p) => p.id === periodeBaru.data.id))
cek('aktifkan periode tak ada → 404', (await req('/api/admin/gaji/periode/999999/aktif', { method: 'PUT', token: tA })).status === 404)
cek('hapus periode penggajian', (await req(`/api/admin/gaji/periode/${periodeBaru.data.id}`, { method: 'DELETE', token: tA })).status === 200)

// Tanpa periode aktif → slip kosong (bukan galat), lalu periode demo dipulihkan.
const slipKosong = await req('/api/slip', { token: tB })
cek('tanpa periode aktif → slip kosong', slipKosong.status === 200 && slipKosong.data?.periode === null && slipKosong.data?.slip === null)
if (periodeAwalAktif) {
  const pulih = await req(`/api/admin/gaji/periode/${periodeAwalAktif.id}/aktif`, { method: 'PUT', token: tA })
  cek('periode penggajian demo dipulihkan', pulih.status === 200 && pulih.data?.aktif === true, pulih.data?.nama)
}

// Bersihkan absensi & jadwal uji agar data demo kembali seperti semula.
await bersihkanAbsensiHariIni(idUji)
await setJadwal(jadwal0.hariKerja)

// ---- 5f. Alpha otomatis, lampiran & foto selfie diambil sesuai kebutuhan ----
// "Jejak" data = satu pengajuan izin di masa lalu (7 hari ke belakang); tanpa
// jejak, riwayat sengaja tidak mengarang alpha untuk hari-hari lampau.
const hariMundur = (n) => {
  const d = new Date(`${hariIniUji}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
const berkasUji = () => {
  const f = new FormData()
  f.append('jenis', 'Izin')
  f.append('mulai', hariMundur(7))
  f.append('selesai', hariMundur(7))
  f.append('keterangan', 'Uji alpha otomatis & lampiran')
  f.append('lampiran', new Blob([Buffer.from('uji-lampiran')], { type: 'image/png' }), 'uji.png')
  return f
}
const izinLampiran = await req('/api/leaves', { method: 'POST', token: tUji, isForm: true, body: berkasUji() })
const idIzinLampiran = izinLampiran.data?.id
cek('ajukan izin + lampiran', izinLampiran.status === 201 && izinLampiran.data?.adaLampiran === true, `adaLampiran=${izinLampiran.data?.adaLampiran}`)

// Muatan daftar harus RINGAN: lampiran base64 tidak ikut, hanya penandanya.
const daftarIzinUji = await req('/api/leaves', { token: tUji })
const barisLampiran = (daftarIzinUji.data || []).find((x) => x.id === idIzinLampiran)
cek('daftar izin ringan (tanpa base64, hanya penanda)', barisLampiran?.adaLampiran === true && barisLampiran?.lampiran === null, `lampiran=${String(barisLampiran?.lampiran)}`)

const lampiranPemilik = await req(`/api/leaves/${idIzinLampiran}/lampiran`, { token: tUji })
cek('pemilik bisa buka lampirannya', lampiranPemilik.status === 200 && /^data:image\/png;base64,/.test(String(lampiranPemilik.data?.lampiran)), String(lampiranPemilik.data?.lampiran).slice(0, 30))
cek('karyawan lain dilarang buka lampiran → 403', (await req(`/api/leaves/${idIzinLampiran}/lampiran`, { token: tB })).status === 403)
const lampiranAdmin = await req(`/api/admin/leaves/${idIzinLampiran}/lampiran`, { token: tA })
cek('admin bisa lihat lampiran pengajuan', lampiranAdmin.status === 200 && /^data:image\/png;base64,/.test(String(lampiranAdmin.data?.lampiran)), String(lampiranAdmin.data?.lampiran).slice(0, 30))
cek('lampiran tak ada → 404', (await req(`/api/admin/leaves/${idIzinLampiran + 999}/lampiran`, { token: tA })).status === 404)

// Hari kerja tanpa absen & tanpa pengajuan → ALPHA otomatis. Jam pulang dibuat
// sudah lewat agar hari ini dianggap hari yang sudah selesai.
await req('/api/admin/jadwal', { method: 'PUT', token: tA, body: { jamMasukBatas: '23:59', jamPulang: '00:01', hariKerja: [0, 1, 2, 3, 4, 5, 6] } })
const riwayatUji = await req(`/api/attendance/history?dari=${hariMundur(10)}&sampai=${hariIniUji}`, { token: tUji })
const alphaHariIni = (riwayatUji.data || []).find((r) => r.tanggal === hariIniUji)
cek('hari kerja tanpa absen → Alpha otomatis', alphaHariIni?.status === 'Alpha' && alphaHariIni?.sumber === 'alpha', `status=${alphaHariIni?.status} ket="${alphaHariIni?.keterangan}"`)
cek('hari yang ada pengajuan izin TIDAK dihitung Alpha', !(riwayatUji.data || []).some((r) => r.tanggal === hariMundur(7) && r.status === 'Alpha'))

// Foto selfie: daftar riwayat ringan, foto diambil hanya saat dibutuhkan.
const selfieKecil = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
const absenSelfie = await req('/api/attendance/check-in', { method: 'POST', token: tUji, body: { lat: -6.1765782, lon: 106.899041, alamat: 'Kantor Pusat', selfie: selfieKecil } })
cek('check-in dengan selfie', absenSelfie.status === 200, `status=${absenSelfie.status}`)
const riwayatSelfie = await req(`/api/attendance/history?dari=${hariIniUji}&sampai=${hariIniUji}`, { token: tUji })
const barisSelfie = (riwayatSelfie.data || []).find((r) => r.tanggal === hariIniUji && r.status !== 'Alpha')
cek('riwayat ringan: selfie null + penanda adaSelfie', barisSelfie?.selfie === null && barisSelfie?.adaSelfie === true, `adaSelfie=${barisSelfie?.adaSelfie}`)
const fotoMasuk = await req(`/api/attendance/${barisSelfie?.id}/foto?jenis=masuk`, { token: tUji })
cek('pemilik bisa ambil foto selfie-nya', fotoMasuk.status === 200 && String(fotoMasuk.data?.foto).startsWith('data:image/png;base64,'), String(fotoMasuk.data?.foto).slice(0, 26))
cek('karyawan lain dilarang ambil foto → 403', (await req(`/api/attendance/${barisSelfie?.id}/foto`, { token: tB })).status === 403)
const fotoAdmin = await req(`/api/admin/attendance/${barisSelfie?.id}/foto?jenis=pulang`, { token: tA })
cek('admin bisa ambil foto absensi', fotoAdmin.status === 200 && fotoAdmin.data?.jenis === 'pulang', `jenis=${fotoAdmin.data?.jenis}`)

// Bersihkan: absensi uji hari ini, jadwal, dan pengajuan lampiran kembali semula.
await bersihkanAbsensiHariIni(idUji)
await setJadwal(jadwal0.hariKerja)
await req(`/api/admin/leaves/${idIzinLampiran}`, { method: 'DELETE', token: tA })

// ---- 5g. Hari libur: tidak Alpha, tidak dihitung hari kerja laporan/gaji ----
// 2027-03-08 = hari Senin (hari kerja pada jadwal default Senin–Jumat).
const TGL_LIBUR = '2027-03-08'
const lapor0 = await req('/api/admin/reports?dari=2027-03-08&sampai=2027-03-08', { token: tA })
cek('laporan: hari kerja sebelum ditetapkan libur = 1', lapor0.data?.hariKerja === 1, `hariKerja=${lapor0.data?.hariKerja}`)
cek('libur: tanggal tidak valid → 400', (await req('/api/admin/libur', { method: 'POST', token: tA, body: { tanggal: '8-3-2027', nama: 'Salah' } })).status === 400)
cek('libur: nama terlalu pendek → 400', (await req('/api/admin/libur', { method: 'POST', token: tA, body: { tanggal: TGL_LIBUR, nama: 'Ya' } })).status === 400)
const tambahLibur = await req('/api/admin/libur', { method: 'POST', token: tA, body: { tanggal: TGL_LIBUR, nama: 'Libur Uji Otomatis' } })
cek('admin tetapkan hari libur (broadcast notifikasi)', tambahLibur.status === 201 && tambahLibur.data?.sumber === 'admin', JSON.stringify(tambahLibur.data || {}))
const lapor1 = await req('/api/admin/reports?dari=2027-03-08&sampai=2027-03-08', { token: tA })
cek('laporan: hari libur tidak dihitung hari kerja', lapor1.data?.hariKerja === 0, `hariKerja=${lapor1.data?.hariKerja}`)
cek('gaji: hari libur tidak dihitung', (await req('/api/admin/gaji?dari=2027-03-08&sampai=2027-03-08', { token: tA })).data?.baris?.every((r) => r.hariDibayar === 0 && r.hariMakan === 0) === true)
cek('jadwal karyawan memuat libur dari admin', (await req('/api/jadwal', { token: tUji })).data?.libur?.some((l) => l.tanggal === TGL_LIBUR) === true)
// Riwayat rentang satu hari libur (tanpa absen) tidak boleh mengarang Alpha.
const riwayatLibur = await req('/api/attendance/history?dari=2027-03-08&sampai=2027-03-08', { token: tUji })
cek('tidak ada Alpha otomatis pada hari libur', (riwayatLibur.data || []).every((r) => r.status !== 'Alpha'), JSON.stringify((riwayatLibur.data || []).map((r) => r.status)))
cek('admin lihat daftar libur', (await req('/api/admin/libur?tahun=2027', { token: tA })).data.some((l) => l.tanggal === TGL_LIBUR))
cek('admin hapus hari libur', (await req(`/api/admin/libur/${TGL_LIBUR}`, { method: 'DELETE', token: tA })).status === 200)
cek('laporan kembali hari kerja = 1', (await req('/api/admin/reports?dari=2027-03-08&sampai=2027-03-08', { token: tA })).data?.hariKerja === 1)
cek('hapus libur yang tak ada → 404', (await req(`/api/admin/libur/${TGL_LIBUR}`, { method: 'DELETE', token: tA })).status === 404)
cek('libur nasional 2026 terseed otomatis', (await req('/api/admin/libur?tahun=2026', { token: tA })).data.some((l) => l.tanggal === '2026-12-25' && l.sumber === 'resmi'))

// ---- 6. Absensi: check-in karyawan + koreksi & hapus oleh admin ----
const hariIni = hariIniUji
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

// Absensi di luar hari kerja harus ditandai hariLibur: hari ini sengaja dikeluarkan
// dari daftar hari kerja, lalu jadwal dikembalikan setelah pengujian.
const hariIniIdx = new Date(`${hariIni}T00:00:00Z`).getUTCDay()
await setJadwal([0, 1, 2, 3, 4, 5, 6].filter((n) => n !== hariIniIdx))
await bersihkanHariIni(loginUji.data.karyawan.id)
const absLibur = await req('/api/attendance/check-in', { method: 'POST', token: tUji, body: { lat: -6.1765782, lon: 106.899041, alamat: 'Kantor Pusat', selfie: null } })
cek('check-in di luar hari kerja ditandai hariLibur', absLibur.status === 200 && absLibur.data?.hariLibur === true, `keterangan="${absLibur.data?.keterangan}"`)

// Laporan hari itu harus 0 hari kerja dan mencatat absensi tadi sebagai Hadir Libur.
const lapLibur = await req(`/api/admin/reports?dari=${hariIni}&sampai=${hariIni}`, { token: tA })
cek('laporan hari libur: hariKerja=0 & hadirLibur terisi', lapLibur.data?.hariKerja === 0 && lapLibur.data?.ringkasan?.hadirLibur >= 1, `hariKerja=${lapLibur.data?.hariKerja} hadirLibur=${lapLibur.data?.ringkasan?.hadirLibur} persen=${lapLibur.data?.ringkasan?.persen}%`)
await setJadwal(jadwal0.hariKerja)
await bersihkanHariIni(loginUji.data.karyawan.id)

const keluar = await req('/api/attendance/check-out', { method: 'POST', token: tB, body: { lat: -6.1765782, lon: 106.899041, alamat: 'Kantor Pusat' } })
cek('check-out karyawan', keluar.status === 200 && !!keluar.data?.checkOut)

// Data masuk & pulang tersimpan TERPISAH: check-out tidak menimpa detail masuk.
const histHariIni = await req(`/api/attendance/history?dari=${hariIni}&sampai=${hariIni}`, { token: tB })
const recHari = (histHariIni.data || []).find((r) => r.tanggal === hariIni && r.checkOut)
cek('riwayat: detail masuk utuh setelah check-out', !!recHari?.lokasi && !!recHari?.selfie !== undefined, `lokasi=${JSON.stringify(recHari?.lokasi)}`)
cek('riwayat: data pulang terpisah (lokasiPulang)', recHari?.lokasiPulang != null && recHari?.jarakPulang != null, `jarakPulang=${recHari?.jarakPulang} m`)
cek('riwayat: field selfiePulang tersedia', 'selfiePulang' in (recHari || {}))

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
  // Bersihkan juga BROADCAST yang lahir dari alur uji (PUT /jadwal menyiarkan
  // notifikasi employee_id NULL ke semua karyawan) — ciri: id tak ada di
  // daftar awal. Broadcast lama milik demo (id tercatat di awal) tetap aman.
  if ((!n.employeeId || n.employeeId === budi.data.karyawan.id) && !notifAwalIds.has(n.id)) {
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
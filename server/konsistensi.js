// ============================================================================
//  PEMERIKSA KONSISTENSI DATA → HITUNGAN GAJI
//
//  Memastikan SELURUH rantai data konsisten:
//    absensi → izin/cuti → lembur → hari kerja & hari libur → periode gaji
//            → laporan gaji admin → slip gaji karyawan → riwayat karyawan
//
//    periksaKonsistensi()          — audit (hanya membaca)
//    rapikanKonsistensi({ mode })  — perbaiki data lama agar sesuai aturan
//
//  Angka dihitung memakai fungsi model yang SAMA dengan panel admin & aplikasi
//  karyawan, jadi hasil audit = yang dilihat pengguna.
// ============================================================================
import { db, hariKerjaAktif, getJadwal, getJadwalGlobal } from './db.js'
import { jamSekarang, toISODate } from './utils/waktu.js'
import {
  listPeriodeGaji, laporanGaji, slipGajiKaryawan, rekapHarian,
  hitungStatusAbsen, rekonsiliasiIzinKehadiran, setStatusLembur, terapkanIzinDatang, satukanIzinDatang,
  STATUS_IZIN_DATANG, JENIS_IZIN_DATANG,
} from './models.js'

export const STATUS_TINJAUAN = 'Perlu Tinjauan'

const rupiah = (n) => Math.round(Number(n) || 0)

// Selisih dua jam 'HH:MM' dalam jam desimal (lintas tengah malam tetap dihitung).
function jamKerja(mulai, selesai) {
  const ke = (t) => Number(String(t || '').slice(0, 2)) * 60 + Number(String(t || '').slice(3, 5))
  let menit = ke(selesai) - ke(mulai)
  if (menit < 0) menit += 24 * 60
  return menit / 60
}

async function konteks() {
  const [periode, karyawan, hariAktif, liburRows] = await Promise.all([
    listPeriodeGaji(),
    db.all('SELECT id, nama, gaji_harian, uang_makan, tarif_lembur FROM employees ORDER BY id'),
    hariKerjaAktif(),
    db.all('SELECT tanggal FROM holidays'),
  ])
  return {
    periode,
    karyawan,
    tarif: new Map(karyawan.map((k) => [k.id, k])),
    hariAktif: new Set(hariAktif),
    libur: new Set(liburRows.map((r) => r.tanggal)),
  }
}

// Hari kerja efektif: bukan akhir pekan (menurut pengaturan) dan bukan hari libur.
const hariKerjaPada = (tanggal, ctx) =>
  ctx.hariAktif.has(new Date(`${tanggal}T00:00:00Z`).getUTCDay()) && !ctx.libur.has(tanggal)

// Nilai izin yang keliru dibayar: izin hanya dibayar gaji harian dan HANYA pada
// hari kerja sungguhan (bukan akhir pekan / hari libur), tanpa uang makan.
function nilaiIzin(row, ctx) {
  if (!hariKerjaPada(row.tanggal, ctx)) return 0
  return Number((ctx.tarif.get(row.employee_id) || {}).gaji_harian || 0)
}

// Nilai rupiah yang berhenti dibayar bila sebuah hari kehadiran dibatalkan.
function nilaiHari(row, t, ctx) {
  const k = ctx.tarif.get(row.employee_id) || {}
  const gaji = Number(k.gaji_harian || 0)
  const makan = Number(k.uang_makan || 0)
  if (row.hari_libur) return gaji + makan      // hari libur: dibayar + uang makan
  if (!hariKerjaPada(t, ctx)) return 0          // akhir pekan tanpa tanda hadir-libur
  // Hadir tepat waktu ATAU datang terlambat/siang dengan izin: dibayar + uang makan.
  return ['Hadir', ...STATUS_IZIN_DATANG].includes(row.status) ? gaji + makan : gaji
}

export async function periksaKonsistensi() {
  const ctx = await konteks()
  const masalah = []
  const tambah = (tingkat, jenis, pesan, nilai = 0, detail = []) =>
    masalah.push({ tingkat, jenis, pesan, rupiah: rupiah(nilai), detail })

  // ---------- 1. Periode gaji: tumpang tindih ----------
  for (let i = 0; i < ctx.periode.length; i++) {
    for (let j = i + 1; j < ctx.periode.length; j++) {
      const a = ctx.periode[i]
      const b = ctx.periode[j]
      if (a.dari <= b.sampai && a.sampai >= b.dari) {
        tambah('BAHAYA', 'periode-tumpang',
          `Periode "${a.nama}" (${a.dari}..${a.sampai}) bertumpuk dengan "${b.nama}" (${b.dari}..${b.sampai}) — satu tanggal masuk dua slip.`,
          0, [{ a: a.nama, b: b.nama }])
      }
    }
  }

  const semuaAbs = await db.all('SELECT * FROM attendance ORDER BY tanggal')

  // ---------- 2. Per periode: laporan gaji vs absensi mentah vs slip ----------
  const perPeriode = []
  for (const p of ctx.periode) {
    const lap = await laporanGaji({ dari: p.dari, sampai: p.sampai })
    const absMentah = await db.all(
      'SELECT * FROM attendance WHERE tanggal >= ? AND tanggal <= ? ORDER BY employee_id, tanggal',
      [p.dari, p.sampai],
    )
    const ot = await db.all(
      "SELECT * FROM overtime WHERE status = 'Disetujui' AND tanggal >= ? AND tanggal <= ?",
      [p.dari, p.sampai],
    )
    const baris = []
    let totalBaris = 0
    for (const r of lap.baris) {
      totalBaris += r.total
      const abs = absMentah.filter((a) => a.employee_id === r.id)
      const rk = await rekapHarian(r.id, p.dari, p.sampai)
      const kategori = { Izin: 0, Sakit: 0, Cuti: 0 }
      for (const [, v] of rk.kategori) kategori[v] = (kategori[v] || 0) + 1
      const jamOt = ot.filter((o) => o.employee_id === r.id)
        .reduce((t, o) => t + jamKerja(o.jam_mulai, o.jam_selesai), 0)
      const slip = (await slipGajiKaryawan(r.id, p.id))?.slip

      const beda = []
      let rincianHari = null
      const uji = (nama, a, b) => { if (a !== b) beda.push(`${nama}: laporan=${a} ↔ mentah/slip=${b}`) }
      uji('Hadir', r.hadir, abs.filter((a) => ['Hadir', ...STATUS_IZIN_DATANG].includes(a.status) && !a.hari_libur).length)
      uji('Terlambat', r.terlambat, abs.filter((a) => a.status === 'Terlambat' && !a.hari_libur).length)
      uji('HadirLibur', r.hadirLibur, abs.filter((a) => ['Hadir', 'Terlambat'].includes(a.status) && a.hari_libur).length)
      uji('IzinDatang', r.izinDatang, abs.filter((a) => STATUS_IZIN_DATANG.includes(a.status) && !a.hari_libur).length)
      uji('Izin', r.izin, kategori.Izin)
      uji('Sakit', r.sakit, kategori.Sakit)
      uji('Cuti', r.cuti, kategori.Cuti)
      uji('Alpha', r.alpha, rk.alpha.length)
      uji('Lembur', r.lembur, Math.round(jamOt * 10) / 10)
      uji('hariDibayar', r.hariDibayar, r.hadir + r.terlambat + r.hadirLibur + r.izin + r.sakit + r.cuti)
      // ---- PEMERIKSAAN DALAM: setiap hari kerja periode ini harus TERHITUNG ----
      // Hari kerja (bukan akhir pekan/libur) yang sudah melewati jejak pertama
      // karyawan & bukan "hari ini yang belum berakhir" WAJIB masuk salah satu
      // keranjang (Hadir/Terlambat/Izin/Sakit/Cuti/Alpha) — kalau jumlahnya beda,
      // ada absensi yang HILANG dari laporan/slip. Absen di hari libur (Hadir
      // Libur) tidak dihitung di sini karena bukan bagian hari kerja.
      const jejak = await db.get(
        `SELECT MIN(t) AS awal FROM (
           SELECT MIN(tanggal) AS t FROM attendance WHERE employee_id = ?
           UNION ALL SELECT MIN(mulai) AS t FROM leaves WHERE employee_id = ?
         )`,
        [r.id, r.id],
      )
      const jamPulangKaryawan = (await getJadwal(r.id)).jamPulang
      const hariIniISO = toISODate()
      // Pengajuan non-ditolak milik karyawan ini — hari yang TERTUTUP pengajuan
      // (termasuk hari ini) selalu terhitung izin/sakit/cuti, tanpa menunggu jam pulang.
      const izinKaryawan = await db.all(
        `SELECT mulai, selesai FROM leaves WHERE employee_id = ? AND status <> 'Ditolak'`,
        [r.id],
      )
      const tercakupPengajuan = (t) => izinKaryawan.some((x) => x.mulai <= t && t <= x.selesai)
      let hariWajib = 0
      const himpunanWajib = new Set()
      // Tanpa satu pun jejak (absensi/pengajuan) laporan sengaja TIDAK mengarang
      // Alpha (anti-alpha-fiktif) → tidak ada hari yang wajib dihitung.
      if (jejak?.awal) {
        for (let d = new Date(`${p.dari}T00:00:00Z`); toISODate(d) <= p.sampai; d.setUTCDate(d.getUTCDate() + 1)) {
          const tgl = toISODate(d)
          if (!hariKerjaPada(tgl, ctx)) continue
          if (tgl < jejak.awal) continue
          // Hari ini yang BELUM berakhir (belum lewat jam pulang) hanya dilewati bila
          // belum ada catatan masuk DAN tidak tertutup pengajuan izin/cuti/sakit.
          const row = abs.find((a) => a.tanggal === tgl)
          const sudahTerhitung = !!row && ['Hadir', 'Terlambat', 'Izin', ...STATUS_IZIN_DATANG].includes(row.status)
          if (tgl === hariIniISO && jamSekarang() < jamPulangKaryawan && !sudahTerhitung && !tercakupPengajuan(tgl)) continue
          hariWajib++
          himpunanWajib.add(tgl)
        }
      }
      // Absensi di LUAR hari kerja (mis. masuk hari Sabtu) tetap dihitung laporan
      // sebagai Hadir/Terlambat (bukan bagian hari kerja wajib) → dimasukkan ke sisi
      // "wajib" agar pemeriksaan ini tidak salah menyebut ada selisih.
      const tanggalDihitung = new Set()
      for (const a of abs) {
        if (['Hadir', 'Terlambat'].includes(a.status)) tanggalDihitung.add(a.tanggal)
        else if (STATUS_IZIN_DATANG.includes(a.status) && !a.hari_libur) tanggalDihitung.add(a.tanggal)
      }
      const sisiWajib = new Set([...himpunanWajib, ...tanggalDihitung])
      const sisiTerhitung = new Set([...rk.alpha, ...rk.kategori.keys()])
      for (const a of abs) {
        // Hari dengan absensi Hadir/Terlambat ATAU izin datang (terlambat/siang)
        // sama-sama TERHITUNG di laporan (kolom Hadir) walaupun tidak masuk
        // kategori izin — jangan sampai muncul sebagai "hari hilang".
        if (['Hadir', 'Terlambat'].includes(a.status)) sisiTerhitung.add(a.tanggal)
        else if (STATUS_IZIN_DATANG.includes(a.status) && !a.hari_libur) sisiTerhitung.add(a.tanggal)
      }
      const hariHilang = [...sisiWajib].filter((t) => !sisiTerhitung.has(t)).sort()
      const hariLebih = [...sisiTerhitung].filter((t) => !sisiWajib.has(t)).sort()
      if (hariHilang.length || hariLebih.length) {
        beda.push(`hari kerja periode: wajib=${sisiWajib.size} ↔ terhitung=${sisiTerhitung.size}`)
        rincianHari = { hilang: hariHilang, lebih: hariLebih }
      }
      uji('subGaji', r.subGaji, Math.round(r.hariDibayar * r.gajiHarian))
      uji('subMakan', r.subMakan, Math.round(r.hariMakan * r.uangMakan))
      uji('subLembur', r.subLembur, Math.round(r.lembur * r.tarifLembur))
      uji('subPiket', r.subPiket || 0, Math.round((r.piket || 0) * (r.biayaPiket || 0)))
      uji('total', r.total, r.subGaji + r.subMakan + r.subLembur + (r.subPiket || 0))
      uji('slip total', r.total, slip?.total)
      uji('slip hariDibayar', r.hariDibayar, slip?.hariDibayar)

      if (beda.length) {
        tambah('BAHAYA', 'laporan-beda',
          `${r.nama} pada ${p.nama}: ${beda.length} angka tidak cocok (laporan admin vs absensi mentah vs slip karyawan).`,
          0, { karyawan: r.nama, periode: p.nama, beda, rincianHari })
      }
      if (r.hariDibayar > 0 && r.gajiHarian === 0) {
        tambah('BAHAYA', 'tarif-kosong',
          `${r.nama} punya ${r.hariDibayar} hari dibayar tetapi tarif gaji 0 → slip ${rupiah(r.total)}.`,
          0, [{ karyawan: r.nama }])
      }
      baris.push({
        id: r.id, nama: r.nama, hadir: r.hadir, terlambat: r.terlambat, hadirLibur: r.hadirLibur,
        izinDatang: r.izinDatang || 0,
        izin: r.izin, sakit: r.sakit, cuti: r.cuti, alpha: r.alpha, lembur: r.lembur,
        hariDibayar: r.hariDibayar, hariMakan: r.hariMakan, total: r.total,
        slipTotal: slip?.total ?? null, cocok: beda.length === 0,
      })
    }
    if (rupiah(lap.ringkasan.total) !== rupiah(totalBaris)) {
      tambah('BAHAYA', 'ringkasan-beda',
        `Ringkasan ${p.nama} (${rupiah(lap.ringkasan.total)}) ≠ jumlah baris (${rupiah(totalBaris)}).`)
    }
    perPeriode.push({
      id: p.id, nama: p.nama, dari: p.dari, sampai: p.sampai, aktif: p.aktif,
      hariKerja: lap.hariKerja, baris, total: rupiah(lap.ringkasan.total),
    })
  }

  // ---------- 3. Absensi di luar semua periode (tidak pernah dihitung gaji) ----------
  const didalam = (t) => ctx.periode.some((p) => t >= p.dari && t <= p.sampai)
  const luarPeriode = ctx.periode.length ? semuaAbs.filter((a) => !didalam(a.tanggal)) : []
  if (luarPeriode.length) {
    tambah('PENTING', 'absensi-luar-periode',
      `${luarPeriode.length} catatan absensi berada di luar SEMUA periode gaji sehingga tidak pernah masuk hitungan.`,
      0, luarPeriode.slice(0, 20).map((a) => ({ tanggal: a.tanggal, status: a.status, employeeId: a.employee_id })))
  }

  // ---------- 3b. Absensi yang masuk DUA periode sekaligus (pembayaran ganda) ----------
  const gandaPeriode = []
  for (const a of semuaAbs) {
    const kena = ctx.periode.filter((p) => a.tanggal >= p.dari && a.tanggal <= p.sampai)
    if (kena.length > 1) {
      gandaPeriode.push({
        id: a.id, employeeId: a.employee_id, nama: (ctx.tarif.get(a.employee_id) || {}).nama,
        tanggal: a.tanggal, status: a.status,
        periode: kena.map((p) => `${p.nama} (${p.dari}..${p.sampai})`).join(' + '),
      })
    }
  }
  if (gandaPeriode.length) {
    tambah('BAHAYA', 'absensi-ganda-periode',
      `${gandaPeriode.length} catatan absensi berada di DUA periode penggajian sekaligus → berpotensi dibayar dua kali.`,
      0, gandaPeriode)
  }

  // ---------- 3c. Lembur Disetujui di luar semua periode (tidak pernah dibayar) ----------
  const otLuar = ctx.periode.length
    ? (await db.all("SELECT * FROM overtime WHERE status = 'Disetujui'")).filter((o) => !didalam(o.tanggal))
    : []
  if (otLuar.length) {
    tambah('PENTING', 'lembur-luar-periode',
      `${otLuar.length} lembur disetujui berada di luar SEMUA periode gaji sehingga tidak pernah masuk slip.`,
      0, otLuar.slice(0, 20).map((o) => ({ id: o.id, employeeId: o.employee_id, tanggal: o.tanggal, jam: `${o.jam_mulai}-${o.jam_selesai}` })))
  }

  // ---------- 4. Status absensi di luar daftar resmi ----------
  const statusResmi = ['Hadir', 'Terlambat', 'Izin', 'Alpha', STATUS_TINJAUAN, ...STATUS_IZIN_DATANG]
  const statusAneh = semuaAbs.filter((a) => !statusResmi.includes(a.status))
  if (statusAneh.length) {
    tambah('PENTING', 'status-aneh',
      `${statusAneh.length} catatan absensi memakai status di luar daftar resmi (tidak dihitung kehadiran maupun izin).`,
      0, statusAneh.map((a) => ({ tanggal: a.tanggal, status: a.status, employeeId: a.employee_id })))
  }

  // ---------- 5. Jam absen tidak wajar yang masih berstatus Hadir/Terlambat ----------
  const jamAneh = []
  let nilaiJamAneh = 0
  for (const a of semuaAbs) {
    if (!['Hadir', 'Terlambat'].includes(a.status) || !a.check_in) continue
    const jadwal = await getJadwal(a.employee_id)
    if (hitungStatusAbsen(jadwal, a.check_in).status !== STATUS_TINJAUAN) continue
    const nilai = nilaiHari(a, a.tanggal, ctx)
    jamAneh.push({
      id: a.id, employeeId: a.employee_id, nama: (ctx.tarif.get(a.employee_id) || {}).nama,
      tanggal: a.tanggal, checkIn: a.check_in, statusLama: a.status, nilai,
    })
    nilaiJamAneh += nilai
  }
  if (jamAneh.length) {
    tambah('PENTING', 'jam-tidak-wajar',
      `${jamAneh.length} catatan absensi berjam tidak wajar masih dihitung Hadir/Terlambat (${rupiah(nilaiJamAneh)} masih ikut dibayar). Sesuai aturan baru seharusnya "Perlu Tinjauan".`,
      nilaiJamAneh, jamAneh)
  }

  // ---------- 6. Lembur disetujui tanpa absensi pada tanggalnya ----------
  const otSemua = await db.all("SELECT * FROM overtime WHERE status = 'Disetujui' ORDER BY tanggal")
  const lemburTanpaAbsen = []
  let nilaiLemburTanpaAbsen = 0
  for (const o of otSemua) {
    const ada = await db.get(
      'SELECT 1 AS ok FROM attendance WHERE employee_id = ? AND tanggal = ? LIMIT 1',
      [o.employee_id, o.tanggal],
    )
    if (ada) continue
    const k = ctx.tarif.get(o.employee_id) || {}
    const nilai = rupiah(jamKerja(o.jam_mulai, o.jam_selesai) * Number(k.tarif_lembur || 0))
    lemburTanpaAbsen.push({
      id: o.id, employeeId: o.employee_id, nama: k.nama, tanggal: o.tanggal,
      jam: `${o.jam_mulai}-${o.jam_selesai}`, nilai,
    })
    nilaiLemburTanpaAbsen += nilai
  }
  if (lemburTanpaAbsen.length) {
    tambah('PENTING', 'lembur-tanpa-absen',
      `${lemburTanpaAbsen.length} lembur disetujui tanpa absensi pada tanggalnya (${rupiah(nilaiLemburTanpaAbsen)}) — tidak sesuai aturan "wajib absen dulu".`,
      nilaiLemburTanpaAbsen, lemburTanpaAbsen)
  }

  // ---------- 7. Baris absensi izin (Izin/Izin Terlambat/Izin Datang Siang) tanpa
  // pengajuan yang sah ----------
  const rekonsiliasi = await rekonsiliasiIzinKehadiran({ kering: true })
  let nilaiIzinGantung = 0
  for (const d of rekonsiliasi.dihapus) {
    const row = semuaAbs.find((a) => a.id === d.id)
    if (row) nilaiIzinGantung += nilaiIzin(row, ctx)
  }
  const totalIzinGantung = rekonsiliasi.dihapus.length + rekonsiliasi.dipulihkan.length
  if (totalIzinGantung) {
    tambah('BAHAYA', 'izin-tanpa-dasar',
      `${totalIzinGantung} baris absensi berstatus izin (Izin / Izin Terlambat / Izin Datang Siang) tidak punya pengajuan yang sah ` +
      `(${rekonsiliasi.dihapus.length} penanda tanpa check-in → dihapus, ${rekonsiliasi.dipulihkan.length} punya check-in → status dipulihkan). ` +
      `Perkiraan nilai yang keliru dibayar: ${rupiah(nilaiIzinGantung)}.`,
      nilaiIzinGantung, [...rekonsiliasi.dihapus, ...rekonsiliasi.dipulihkan])
  }

  // ---------- 7b. Izin "datang terlambat/siang" disetujui tetapi manfaat uang
  // makan belum diterapkan (hari masih berstatus Terlambat). Bisa terjadi pada
  // data lama sebelum aturan manfaat ini berlaku.
  const izinDatangDisetujui = await db.all(
    `SELECT * FROM leaves WHERE status = 'Disetujui' AND jenis IN (?, ?) ORDER BY mulai`,
    [...JENIS_IZIN_DATANG],
  )
  const datangBelumDiterapkan = []
  let nilaiDatang = 0
  for (const l of izinDatangDisetujui) {
    const pratinjau = await terapkanIzinDatang(l, { kering: true })
    for (const d of pratinjau.diterapkan) {
      const k = ctx.tarif.get(l.employee_id) || {}
      const nilai = hariKerjaPada(d.tanggal, ctx) ? Number(k.uang_makan || 0) : 0
      datangBelumDiterapkan.push({ ...d, nama: k.nama, jenis: l.jenis, leaveId: l.id, nilai })
      nilaiDatang += nilai
    }
  }
  if (datangBelumDiterapkan.length) {
    tambah('PENTING', 'izin-datang-belum-diterapkan',
      `${datangBelumDiterapkan.length} hari berstatus Terlambat sudah punya izin datang terlambat/siang yang disetujui, ` +
      `tetapi uang makan (${rupiah(nilaiDatang)}) belum dipulihkan.`,
      nilaiDatang, datangBelumDiterapkan)
  }

  // ---------- 8. Karyawan bertarif 0 tetapi punya absensi ----------
  for (const k of ctx.karyawan) {
    if (Number(k.gaji_harian)) continue
    if (!semuaAbs.some((a) => a.employee_id === k.id)) continue
    tambah('BAHAYA', 'tarif-kosong',
      `${k.nama} belum diisi tarif gaji (Rp0) padahal punya catatan absensi → seluruh slip-nya Rp0.`,
      0, [{ id: k.id, nama: k.nama }])
  }

  // ---------- 9. Data izin datang dengan nama LAMA (belum disatukan) ----------
  const izinLama = await satukanIzinDatang({ kering: true })
  if (izinLama.total) {
    tambah('CATATAN', 'izin-datang-lama',
      `${izinLama.total} data memakai nama lama "Izin Datang Siang" (${izinLama.jenisDiubah} pengajuan, ${izinLama.statusDiubah} absensi). ` +
      'Aturan sekarang hanya memakai satu jenis: "Izin Datang Terlambat" — datanya bisa disatukan otomatis.',
      0, izinLama.detail)
  }

  const bahaya = masalah.filter((m) => m.tingkat === 'BAHAYA').length
  const penting = masalah.filter((m) => m.tingkat === 'PENTING').length
  return {
    waktu: new Date().toISOString(),
    jadwal: await getJadwalGlobal(),
    ringkasan: {
      periode: ctx.periode.length,
      karyawan: ctx.karyawan.length,
      absensi: semuaAbs.length,
      izin: (await db.get('SELECT COUNT(*) AS n FROM leaves'))?.n ?? 0,
      lembur: (await db.get('SELECT COUNT(*) AS n FROM overtime'))?.n ?? 0,
      masalah: masalah.length,
      bahaya,
      penting,
      catatan: masalah.length - bahaya - penting,
      nilaiTerindikasi: rupiah(masalah.reduce((t, m) => t + (m.rupiah || 0), 0)),
    },
    masalah,
    perPeriode,
    bersih: masalah.length === 0,
  }
}

// ============================================================================
//  RAPIKAN DATA LAMA agar sesuai aturan yang berlaku sekarang.
//  mode: 'tinjau-jam' | 'tolak-lembur-tanpa-absen' | 'rekon-izin' | 'semua'
//  kering: true → hanya MENGHITUNG dampak (tanpa mengubah apa pun).
// ============================================================================
export const MODE_RAPIKAN = ['tinjau-jam', 'tolak-lembur-tanpa-absen', 'rekon-izin', 'terapkan-izin-datang', 'satukan-izin-datang']

export async function rapikanKonsistensi({ mode = 'semua', kering = false } = {}) {
  const ctx = await konteks()
  const audit = await periksaKonsistensi()
  const jalankan = (m) => mode === 'semua' || mode === m
  const ambil = (jenis) => audit.masalah.find((x) => x.jenis === jenis)?.detail || []
  const tindakan = []

  // (1) Jam absen tidak wajar → "Perlu Tinjauan" (tidak lagi dibayar otomatis).
  if (jalankan('tinjau-jam')) {
    const rincian = []
    let nilai = 0
    for (const k of ambil('jam-tidak-wajar')) {
      const jadwal = await getJadwal(k.employeeId)
      const { status, alasan } = hitungStatusAbsen(jadwal, k.checkIn)
      if (!kering) await db.run('UPDATE attendance SET status = ?, keterangan = ? WHERE id = ?', [status, alasan, k.id])
      nilai += k.nilai
      rincian.push({ ...k, statusBaru: status })
    }
    tindakan.push({ mode: 'tinjau-jam', jumlah: rincian.length, rupiah: rupiah(nilai), rincian })
  }

  // (2) Lembur disetujui tanpa absensi → ditolak (karyawan tetap dapat notifikasi).
  if (jalankan('tolak-lembur-tanpa-absen')) {
    const rincian = []
    let nilai = 0
    for (const k of ambil('lembur-tanpa-absen')) {
      if (!kering) {
        await setStatusLembur(k.id, 'Ditolak', 'Otomatis: tanggal lembur belum ada absensi masuk (aturan wajib absen dulu).')
      }
      nilai += k.nilai
      rincian.push({ ...k, statusBaru: 'Ditolak' })
    }
    tindakan.push({ mode: 'tolak-lembur-tanpa-absen', jumlah: rincian.length, rupiah: rupiah(nilai), rincian })
  }

  // (3) Baris absensi 'Izin' tanpa pengajuan sah → dihapus/dipulihkan.
  if (jalankan('rekon-izin')) {
    const pratinjau = await rekonsiliasiIzinKehadiran({ kering: true })
    let nilai = 0
    for (const d of pratinjau.dihapus) {
      const row = await db.get('SELECT * FROM attendance WHERE id = ?', [d.id])
      if (row) nilai += nilaiIzin(row, ctx)
    }
    const nyata = kering ? pratinjau : await rekonsiliasiIzinKehadiran({ kering: false })
    tindakan.push({
      mode: 'rekon-izin',
      jumlah: pratinjau.dihapus.length + pratinjau.dipulihkan.length,
      rupiah: rupiah(nilai),
      rincian: [
        ...nyata.dihapus.map((x) => ({ ...x, aksi: 'dihapus' })),
        ...nyata.dipulihkan.map((x) => ({ ...x, aksi: 'dipulihkan' })),
      ],
    })
  }

  // (4) Izin "datang terlambat/siang" yang disetujui → uang makan hari itu
  // dipulihkan (status Terlambat dinaikkan menjadi status izin datang).
  if (jalankan('terapkan-izin-datang')) {
    const rincian = []
    let nilai = 0
    for (const k of ambil('izin-datang-belum-diterapkan')) {
      const nyata = await terapkanIzinDatang(
        { jenis: k.jenis, employee_id: k.employeeId, mulai: k.tanggal, selesai: k.tanggal },
        { kering },
      )
      nilai += k.nilai
      rincian.push(...nyata.diterapkan.map((x) => ({ ...x, jenis: k.jenis })))
    }
    tindakan.push({ mode: 'terapkan-izin-datang', jumlah: rincian.length, rupiah: rupiah(nilai), rincian })
  }

  // (5) Nama lama "Izin Datang Siang" → disatukan ke "Izin Datang Terlambat".
  if (jalankan('satukan-izin-datang')) {
    const hasilSatukan = await satukanIzinDatang({ kering })
    tindakan.push({
      mode: 'satukan-izin-datang',
      jumlah: hasilSatukan.total,
      rupiah: 0,
      rincian: hasilSatukan.detail,
    })
  }

  return {
    mode,
    kering,
    waktu: new Date().toISOString(),
    tindakan,
    totalPerubahan: tindakan.reduce((t, x) => t + x.jumlah, 0),
    totalRupiah: rupiah(tindakan.reduce((t, x) => t + x.rupiah, 0)),
    auditSesudah: kering ? null : await periksaKonsistensi(),
  }
}

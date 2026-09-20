// ============ Pembuat berkas Excel "laporan kehadiran" (ExcelJS) ============
//
// Fungsi MURNI: menerima data laporan dari API (api.adminLaporan) + namespace
// pustaka ExcelJS, lalu mengembalikan workbook siap ditulis
// (await wb.xlsx.writeBuffer()). Tidak menyentuh DOM maupun plugin native
// sehingga bisa diuji langsung dengan Node (scripts/uji-laporan-excel.mjs) —
// pola yang sama dengan utils/berkas.js. Berkas akhirnya diunduh lewat
// utils/unduh.js (unduh peramban di web, simpan ke folder Unduhan di Android).
//
// Gaya visual (kekinian): banner judul navy, sub-banner periode indigo muda,
// baris meta, blok KPI berwarna per metrik, header tabel indigo/teal dengan
// teks putih, baris belang (zebra), garis tipis rapi, baris TOTAL tegas,
// tombol filter otomatis (autoFilter), dan kolom Nama dibekukan agar tetap
// terlihat saat tabel digeser mendatar di layar sempit.

// Palet warna — format ARGB ExcelJS ('FF' + RRGGBB); semuanya dari keluarga
// warna Tailwind yang sama dengan tema aplikasi (navy/indigo/teal/slate).
const NAVY = 'FF0A1D57'
const INDIGO = 'FF4F46E5'
const TEAL = 'FF0D9488'
const INDIGO_MUDA = 'FFE0E7FF'
const INDIGO_SUB = 'FFEEF2FF'
const INDIGO_TEKS = 'FF312E81'
const ZEBRA = 'FFF1F5F9'
const GARIS = 'FFCBD5E1'
const SLATE = 'FF334155'
const ABU = 'FF64748B'
const PUTIH = 'FFFFFFFF'

// Kolom tabel laporan — sumber tunggal untuk header Excel dan tabel PDF.
export const KOLOM_LAPORAN = ['Nama', 'NIP', 'Jabatan', 'Departemen', 'Hadir', 'Terlambat', 'Hadir Libur', 'Izin', 'Sakit', 'Cuti', 'Alpha', 'Lembur (jam)', 'Hari Kerja', '% Kehadiran']

// Satu baris Excel dari data karyawan. % Kehadiran dikirim sebagai ANGKA
// (bukan teks "94%") supaya bisa difilter, dijumlah, dan dirata-rata di Excel;
// tanda % ditampilkan lewat format sel '0"%"'.
export function barisLaporanExcel(r) {
  return [r.nama, r.nip, r.jabatan, r.departemen, r.hadir, r.terlambat, r.hadirLibur, r.izin, r.sakit, r.cuti, r.alpha, r.lembur, r.hariKerja, r.persen]
}

const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] // indeks getDay()
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

// 'YYYY-MM-DD' → '20 Sep 2026' (sama dengan formatTanggalPendek di utils/date,
// ditiru di sini supaya modul ini bebas impor dan gampang diuji dengan Node).
function tanggalPendek(iso) {
  const d = new Date(iso)
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

// Stempel waktu unduh 'dd/mm/yyyy HH:MM' untuk baris meta.
function stempelWaktu(d = new Date()) {
  const dua = (n) => String(n).padStart(2, '0')
  return `${dua(d.getDate())}/${dua(d.getMonth() + 1)}/${d.getFullYear()} ${dua(d.getHours())}:${dua(d.getMinutes())}`
}

// Nama sheet maksimal 31 karakter & tanpa karakter terlarang; nama ganda
// diberi nomor (aturan yang sama dengan versi lama di Admin.jsx).
function namaSheetExcel(departemen, dipakai) {
  const dasar = (departemen || 'Tanpa Departemen').replace(/[/\\*?:[\]]/g, ' ').trim().slice(0, 28) || 'Departemen'
  let nama = dasar
  let n = 2
  while (dipakai.has(nama.toLowerCase())) nama = `${dasar} (${n++})`
  dipakai.add(nama.toLowerCase())
  return nama
}

// Blok KPI: [label, warnaLatarSoft, warnaTeks, nilai, numFmt?] — warna dari
// kartu rekap panel admin (indigo/emerald/amber/sky/rose/teal, dll.). Warna
// % Kehadiran mengikuti ambang: ≥90 hijau, ≥75 kuning, di bawahnya merah.
function kpiLaporan(ringkasan, hariKerja) {
  const warnaPersen = ringkasan.persen >= 90
    ? ['FFD1FAE5', 'FF047857']
    : ringkasan.persen >= 75
      ? ['FFFEF3C7', 'FFB45309']
      : ['FFFFE4E6', 'FFE11D48']
  return [
    ['Karyawan', 'FFE0E7FF', 'FF3730A3', ringkasan.totalKaryawan],
    ['Hari Kerja', 'FFF1F5F9', SLATE, hariKerja],
    ['Hadir', 'FFD1FAE5', 'FF047857', ringkasan.hadir],
    ['Terlambat', 'FFFEF3C7', 'FFB45309', ringkasan.terlambat],
    ['Hadir Libur', 'FFCCFBF1', 'FF0F766E', ringkasan.hadirLibur],
    ['Izin', 'FFE0F2FE', 'FF0369A1', ringkasan.izin],
    ['Sakit', 'FFFCE7F3', 'FFBE185D', ringkasan.sakit],
    ['Cuti', 'FFEDE9FE', 'FF6D28D9', ringkasan.cuti],
    ['Alpha', 'FFFFE4E6', 'FFE11D48', ringkasan.alpha],
    ['Lembur (jam)', 'FFE0E7FF', 'FF4338CA', ringkasan.lembur, '0.0'],
    ['% Kehadiran', warnaPersen[0], warnaPersen[1], ringkasan.persen, '0"%"'],
  ]
}

// Huruf kolom ke-n (1 → 'A', 14 → 'N') untuk penulisan rentang merge/filter.
function hurufKolom(n) {
  let huruf = ''
  while (n > 0) {
    huruf = String.fromCharCode(65 + ((n - 1) % 26)) + huruf
    n = Math.floor((n - 1) / 26)
  }
  return huruf
}

const BARIS_HEADER = 9 // baris header tabel (banner + KPI berada di atasnya)
const BARIS_DATA = 10  // baris data pertama

// Mengisi satu worksheet dengan gaya lengkap (banner, KPI, tabel, TOTAL).
function isiSheet(wb, nama, data, ringkasan, baris, aksen, labelDept) {
  const ws = wb.addWorksheet(nama, {
    // Kolom pertama (Nama) tetap terlihat saat tabel digeser mendatar.
    views: [{ state: 'frozen', xSplit: 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  const nKol = KOLOM_LAPORAN.length // 14 → kolom N
  const kolomN = hurufKolom(nKol)

  // Lebar kolom (satuan karakter): angka sempit, nama/jabatan lega.
  const lebar = [24, 13, 20, 20, 8.5, 11, 11.5, 8.5, 8.5, 8.5, 8.5, 12, 11, 12.5]
  lebar.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  const garis = { style: 'thin', color: { argb: GARIS } }
  const bingkai = { top: garis, bottom: garis, left: garis, right: garis }

  // 1) Banner judul (navy, teks putih, merge selebar tabel).
  ws.mergeCells(`A1:${kolomN}1`)
  const judul = ws.getCell('A1')
  judul.value = labelDept
    ? `LAPORAN KEHADIRAN — ${String(labelDept).toUpperCase()}`
    : 'LAPORAN KEHADIRAN KARYAWAN — NUBSEN'
  judul.font = { name: 'Calibri', size: 14, bold: true, color: { argb: PUTIH } }
  judul.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  judul.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 34

  // 2) Sub-banner periode & parameter laporan.
  ws.mergeCells(`A2:${kolomN}2`)
  const sub = ws.getCell('A2')
  const bagian = [
    `Periode: ${tanggalPendek(data.dari)} s.d. ${tanggalPendek(data.sampai)}`,
    `Hari kerja: ${data.hariKerja} hari${(data.hariKerjaHari || []).length ? ` (${data.hariKerjaHari.map((n) => NAMA_HARI[n]).join('/')})` : ''}`,
  ]
  if (!labelDept) bagian.push(`Departemen: ${data.departemen || 'Semua'}`)
  sub.value = bagian.join('   •   ')
  sub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: INDIGO_TEKS } }
  sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_SUB } }
  sub.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(2).height = 20

  // 3) Baris meta (waktu unduh + jumlah karyawan + rata-rata kehadiran).
  ws.mergeCells(`A3:${kolomN}3`)
  const meta = ws.getCell('A3')
  meta.value = `Diunduh: ${stempelWaktu()}   •   ${ringkasan.totalKaryawan} karyawan   •   Rata-rata kehadiran ${ringkasan.persen}%   •   Dibuat otomatis oleh NUBSEN`
  meta.font = { name: 'Calibri', size: 9, italic: true, color: { argb: ABU } }
  meta.alignment = { vertical: 'middle', horizontal: 'left' }
  ws.getRow(3).height = 16
  ws.getRow(4).height = 6 // jeda visual

  // 4) Blok KPI (baris 5 = label kecil, baris 6 = angka besar berwarna).
  kpiLaporan(ringkasan, data.hariKerja).forEach(([label, latar, teks, nilai, fmt], i) => {
    const kol = i + 1
    const selLabel = ws.getCell(5, kol)
    selLabel.value = label
    selLabel.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: ABU } }
    selLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: latar } }
    selLabel.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

    const selNilai = ws.getCell(6, kol)
    selNilai.value = nilai
    if (fmt) selNilai.numFmt = fmt
    selNilai.font = { name: 'Calibri', size: 12, bold: true, color: { argb: teks } }
    selNilai.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: latar } }
    selNilai.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  ws.getRow(5).height = 15
  ws.getRow(6).height = 24
  ws.getRow(7).height = 6 // jeda visual

  // 5) Judul seksi tabel.
  ws.mergeCells(`A8:${kolomN}8`)
  const seksi = ws.getCell('A8')
  seksi.value = 'REKAP PER KARYAWAN'
  seksi.font = { name: 'Calibri', size: 10, bold: true, color: { argb: aksen } }
  seksi.alignment = { vertical: 'middle', horizontal: 'left' }
  ws.getRow(8).height = 18

  // 6) Header tabel (fill warna aksen + teks putih).
  KOLOM_LAPORAN.forEach((teks, i) => {
    const sel = ws.getCell(BARIS_HEADER, i + 1)
    sel.value = teks
    sel.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PUTIH } }
    sel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: aksen } }
    sel.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    sel.border = bingkai
  })
  ws.getRow(BARIS_HEADER).height = 22

  // 7) Baris data: belang, bingkai tipis, teks di kiri & angka di tengah.
  baris.forEach((r, i) => {
    const no = BARIS_DATA + i
    barisLaporanExcel(r).forEach((v, j) => {
      const sel = ws.getCell(no, j + 1)
      sel.value = v
      sel.border = bingkai
      sel.font = { name: 'Calibri', size: 10, color: { argb: SLATE } }
      sel.alignment = { vertical: 'middle', horizontal: j <= 3 ? 'left' : 'center' }
      if (j === 11) sel.numFmt = '0.0'   // Lembur (jam)
      if (j === 13) sel.numFmt = '0"%"'  // % Kehadiran
      if (i % 2 === 1) sel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }
    })
    ws.getRow(no).height = 16
  })

  // 8) Baris TOTAL (di luar rentang autofilter): latar indigo muda + garis
  //    atas tegas berwarna aksen. A:D digabung jadi satu sel "TOTAL".
  const barisTotal = BARIS_DATA + baris.length
  ws.mergeCells(`A${barisTotal}:D${barisTotal}`)
  const totalNilai = [
    ringkasan.hadir, ringkasan.terlambat, ringkasan.hadirLibur, ringkasan.izin,
    ringkasan.sakit, ringkasan.cuti, ringkasan.alpha, ringkasan.lembur,
    data.hariKerja, ringkasan.persen,
  ]
  for (let j = 1; j <= nKol; j++) {
    const sel = ws.getCell(barisTotal, j)
    sel.border = {
      top: { style: 'medium', color: { argb: aksen } },
      bottom: garis, left: garis, right: garis,
    }
    sel.font = { name: 'Calibri', size: 10, bold: true, color: { argb: INDIGO_TEKS } }
    sel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_MUDA } }
    if (j === 1) {
      sel.value = 'TOTAL'
      sel.alignment = { vertical: 'middle', horizontal: 'center' }
    } else if (j >= 5) {
      sel.value = totalNilai[j - 5]
      sel.alignment = { vertical: 'middle', horizontal: 'center' }
      if (j === 12) sel.numFmt = '0.0'
      if (j === 14) sel.numFmt = '0"%"'
    }
  }
  ws.getRow(barisTotal).height = 18

  // 9) Filter otomatis pada header + baris data (TOTAL tidak ikut terfilter).
  ws.autoFilter = {
    from: { row: BARIS_HEADER, column: 1 },
    to: { row: BARIS_DATA + baris.length - 1, column: nKol },
  }

  return ws
}

// Workbook laporan lengkap: sheet Ringkasan (semua karyawan + TOTAL) dan satu
// sheet per departemen (dengan TOTAL departemen masing-masing, aksen teal).
export async function buatWorkbookLaporan(data, ExcelJS) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'NUBSEN'
  wb.created = new Date()

  isiSheet(wb, 'Ringkasan', data, data.ringkasan, data.baris, INDIGO)

  const dipakai = new Set(['ringkasan'])
  const grup = new Map()
  for (const r of data.baris) {
    if (!grup.has(r.departemen)) grup.set(r.departemen, [])
    grup.get(r.departemen).push(r)
  }
  for (const [namaDept, list] of grup) {
    const jumlah = (k) => list.reduce((t, r) => t + r[k], 0)
    const target = data.hariKerja * list.length
    const masuk = list.reduce((t, r) => t + r.hadir + r.terlambat, 0)
    const ringkasanDept = {
      totalKaryawan: list.length,
      hadir: jumlah('hadir'),
      terlambat: jumlah('terlambat'),
      hadirLibur: jumlah('hadirLibur'),
      izin: jumlah('izin'),
      sakit: jumlah('sakit'),
      cuti: jumlah('cuti'),
      alpha: jumlah('alpha'),
      lembur: Math.round(jumlah('lembur') * 10) / 10,
      persen: target ? Math.min(100, Math.round((masuk / target) * 100)) : 0,
    }
    isiSheet(wb, namaSheetExcel(namaDept, dipakai), data, ringkasanDept, list, TEAL, namaDept)
  }
  return wb
}

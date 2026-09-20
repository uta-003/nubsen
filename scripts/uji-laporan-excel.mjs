// Uji pembuat Excel laporan (laporan-excel.js) — jalur murni tanpa DOM:
//   node scripts/uji-laporan-excel.mjs
//
// Workbook dibuat lewat ExcelJS langsung di Node (pustaka yang sama dengan
// aplikasi), ditulis ke buffer, lalu diperiksa strukturnya: tanda tangan ZIP
// 'PK' (.xlsx valid), jumlah sheet, banner/header, baris data, dan TOTAL.
import { buatWorkbookLaporan, KOLOM_LAPORAN, barisLaporanExcel } from '../src/utils/laporan-excel.js'

let gagal = 0
const sama = (nama, dapat, harus) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus)
  if (!ok) {
    gagal++
    console.error(`✗ ${nama}\n  dapat: ${JSON.stringify(dapat)}\n  harus: ${JSON.stringify(harus)}`)
  } else {
    console.log(`✓ ${nama}`)
  }
}

// Interop exceljs: sebagian bentuk ekspor menaruh Workbook di `default`,
// sebagian langsung di modul.
const mod = await import('exceljs')
const ExcelJS = mod.default?.Workbook ? mod.default : mod.Workbook ? mod : mod.default || mod

const data = {
  dari: '2026-09-01',
  sampai: '2026-09-20',
  departemen: '',
  hariKerja: 15,
  hariKerjaHari: [1, 2, 3, 4, 5, 6],
  baris: [
    { nama: 'Budi Santoso', nip: 'NIP-002', jabatan: 'Staf', departemen: 'Produksi', hadir: 10, terlambat: 2, hadirLibur: 1, izin: 1, sakit: 1, cuti: 0, alpha: 1, lembur: 3.5, hariKerja: 15, persen: 80 },
    { nama: 'Afriani Putri', nip: 'NIP-001', jabatan: 'Kepala Departemen', departemen: 'Produksi', hadir: 13, terlambat: 0, hadirLibur: 2, izin: 0, sakit: 0, cuti: 0, alpha: 0, lembur: 0, hariKerja: 15, persen: 100 },
    { nama: 'Citra Dewi', nip: 'NIP-003', jabatan: 'Staf', departemen: 'HR', hadir: 9, terlambat: 1, hadirLibur: 0, izin: 2, sakit: 2, cuti: 1, alpha: 0, lembur: 2, hariKerja: 15, persen: 67 },
  ],
  ringkasan: { totalKaryawan: 3, hadir: 32, terlambat: 3, hadirLibur: 3, izin: 3, sakit: 3, cuti: 1, alpha: 1, lembur: 5.5, persen: 86 },
  rekap: [],
}

// ---------- pemetaan kolom & baris ----------
sama('KOLOM_LAPORAN berisi 14 kolom', KOLOM_LAPORAN.length, 14)
sama('kolom pertama = Nama', KOLOM_LAPORAN[0], 'Nama')
sama('kolom terakhir = % Kehadiran', KOLOM_LAPORAN[13], '% Kehadiran')
sama('baris Excel berisi 14 sel', barisLaporanExcel(data.baris[0]).length, 14)
sama('% Kehadiran berupa ANGKA (bisa dirata-rata di Excel)', barisLaporanExcel(data.baris[0])[13], 80)

// ---------- workbook ----------
const wb = await buatWorkbookLaporan(data, ExcelJS)
sama('jumlah sheet = Ringkasan + 2 departemen', wb.worksheets.length, 3)
sama('sheet pertama bernama Ringkasan', wb.worksheets[0].name, 'Ringkasan')

const ws = wb.worksheets[0]
sama('banner judul', ws.getCell('A1').value, 'LAPORAN KEHADIRAN KARYAWAN — NUBSEN')
sama('header tabel kolom pertama (A9)', ws.getCell('A9').value, 'Nama')
sama('header tabel kolom terakhir (N9)', ws.getCell('N9').value, '% Kehadiran')
sama('KPI Hadir (C6) dari ringkasan', ws.getCell('C6').value, 32)
sama('baris data pertama = karyawan pertama', ws.getCell('A10').value, 'Budi Santoso')
sama('% kehadiran baris data (N10)', ws.getCell('N10').value, 80)
sama('TOTAL di bawah data (A13)', ws.getCell('A13').value, 'TOTAL')
sama('TOTAL hadir (E13)', ws.getCell('E13').value, 32)
sama('autofilter aktif', ws.autoFilter ? true : false, true)

// Sheet departemen (aksen teal, judul memuat nama departemen).
const wsProduksi = wb.worksheets[1]
sama('sheet kedua = Produksi', wsProduksi.name, 'Produksi')
sama('banner departemen', wsProduksi.getCell('A1').value, 'LAPORAN KEHADIRAN — PRODUKSI')
sama('TOTAL hadir departemen (E12)', wsProduksi.getCell('E12').value, 23)

// ---------- berkas .xlsx valid ----------
const buffer = await wb.xlsx.writeBuffer()
const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
sama('tanda tangan ZIP "PK" (xlsx valid)', String.fromCharCode(bytes[0], bytes[1]), 'PK')
sama('ukuran berkas wajar (> 4 kB)', bytes.byteLength > 4096, true)

console.log(gagal === 0 ? '\nSemua uji laporan-excel LULUS ✅' : `\n${gagal} uji GAGAL ❌`)
process.exit(gagal === 0 ? 0 : 1)

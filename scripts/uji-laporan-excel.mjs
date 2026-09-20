// Uji pembuat Excel laporan (laporan-excel.js) — jalur murni tanpa DOM:
//   node scripts/uji-laporan-excel.mjs
//
// Workbook dibuat lewat ExcelJS langsung di Node (pustaka yang sama dengan
// aplikasi), ditulis ke buffer, lalu diperiksa strukturnya: tanda tangan ZIP
// 'PK' (.xlsx valid), jumlah sheet, banner/header, baris data, dan TOTAL.
import { buatWorkbookLaporan, buatWorkbookGaji, KOLOM_LAPORAN, KOLOM_GAJI, barisLaporanExcel, barisGajiExcel } from '../src/utils/laporan-excel.js'

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

// ---------- workbook penghitung gaji ----------
// Perhitungan contoh (aturan baru: Terlambat TIDAK dapat uang makan):
// Budi hariDibayar=15 (10+2+1+1+1+0), hariMakan=11 (10+1 — 2 hari telat tidak dapat),
// subGaji=2.250.000, subMakan=220.000, subLembur=87.500 → total 2.557.500;
// Afriani hariDibayar=15, hariMakan=15, total 3.075.000. Ringkasan = 5.632.500.
const dataGaji = {
  dari: '2026-09-01',
  sampai: '2026-09-20',
  departemen: '',
  hariKerja: 15,
  hariKerjaHari: [1, 2, 3, 4, 5, 6],
  baris: [
    { id: 1, nama: 'Budi Santoso', nip: 'NIP-002', departemen: 'Produksi', hadir: 10, terlambat: 2, hadirLibur: 1, izin: 1, sakit: 1, cuti: 0, alpha: 1, lembur: 3.5, gajiHarian: 150000, uangMakan: 20000, tarifLembur: 25000 },
    { id: 2, nama: 'Afriani Putri', nip: 'NIP-001', departemen: 'Produksi', hadir: 13, terlambat: 0, hadirLibur: 2, izin: 0, sakit: 0, cuti: 0, alpha: 0, lembur: 0, gajiHarian: 180000, uangMakan: 25000, tarifLembur: 30000 },
  ],
  ringkasan: {
    totalKaryawan: 2,
    hariDibayar: 30,
    hariMakan: 26,
    tanpaUangMakan: 2,
    potonganUangMakan: 40000,
    lembur: 3.5,
    subGaji: 4950000,
    subMakan: 595000,
    subLembur: 87500,
    total: 5632500,
  },
}

sama('KOLOM_GAJI berisi 13 kolom', KOLOM_GAJI.length, 13)
sama('kolom terakhir gaji = TOTAL GAJI (Rp)', KOLOM_GAJI[12], 'TOTAL GAJI (Rp)')
sama('baris gaji 13 sel', barisGajiExcel(dataGaji.baris[0]).length, 13)

const wbGaji = await buatWorkbookGaji(dataGaji, ExcelJS)
sama('workbook gaji: 2 sheet (Ringkasan + Produksi)', wbGaji.worksheets.length, 2)
const wsG = wbGaji.worksheets[0]
sama('banner gaji', wsG.getCell('A1').value, 'PENGHITUNG GAJI KARYAWAN — NUBSEN')
sama('header kolom terakhir gaji (M9)', wsG.getCell('M9').value, 'TOTAL GAJI (Rp)')
sama('KPI TOTAL GAJI (H6)', wsG.getCell('H6').value, 5632500)
sama('baris data gaji pertama (A10)', wsG.getCell('A10').value, 'Budi Santoso')
sama('TOTAL gaji keseluruhan (M12)', wsG.getCell('M12').value, 5632500)
sama('TOTAL sub gaji (J12)', wsG.getCell('J12').value, 4950000)
sama('catatan aturan uang makan (telat) di Excel', /Terlambat tidak dapat/.test(String(wsG.getCell('A3').value)), true)

const bufGaji = await wbGaji.xlsx.writeBuffer()
const bytesGaji = Buffer.isBuffer(bufGaji) ? bufGaji : Buffer.from(bufGaji)
sama('xlsx gaji valid (PK)', String.fromCharCode(bytesGaji[0], bytesGaji[1]), 'PK')

console.log(gagal === 0 ? '\nSemua uji laporan-excel LULUS ✅' : `\n${gagal} uji GAGAL ❌`)
process.exit(gagal === 0 ? 0 : 1)

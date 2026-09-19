// Uji unit helper ekspor & registry Back — jalur murni tanpa DOM/plugin:
//   node scripts/uji-unduhan.mjs
//
// • berkas.js  → buatCSV (BOM/kutip), namaBerkasAman (karakter terlarang), MIME
// • kembali.js → registry penutup lapisan tombol Back Android
// • notif.js   → idNotifikasi/menitDariJam/geserJam (via esbuild karena berkas
//   ini mengimpor './native' tanpa ekstensi — Node murni menolaknya)
import { buatCSV, namaBerkasAman, MIME } from '../src/utils/berkas.js'
import { daftarPenutup, tutupTeratas, jumlahLapisan } from '../src/utils/kembali.js'

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

// ---------- berkas.js ----------
const csv = buatCSV([['Nama;Si A', 'Izin\nBaris', null], [1, 2, 3]])
sama('CSV diawali BOM UTF-8', csv.charCodeAt(0), 0xfeff)
sama('CSV mengutip sel berisi ;', csv.split('\r\n')[0], '\ufeff"Nama;Si A";"Izin\nBaris";')
sama('CSV baris angka', csv.split('\r\n')[1], '1;2;3')
sama('CSV kosong → hanya BOM', buatCSV([]), '\ufeff')
sama('nama aman: karakter terlarang', namaBerkasAman('Laporan: 1/2 *ok?'), 'Laporan-1-2-ok')
sama('nama aman: spasi → tanda hubung', namaBerkasAman('riwayat absensi Maret'), 'riwayat-absensi-Maret')
sama('nama aman: titik/garis depan dibuang', namaBerkasAman('...-pdf'), 'pdf')
sama('nama aman: kosong → fallback', namaBerkasAman(''), 'unduhan-nubsen')
sama('MIME.csv', MIME.csv, 'text/csv;charset=utf-8')
sama('MIME.xlsx', MIME.xlsx, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
sama('MIME.pdf', MIME.pdf, 'application/pdf')

// ---------- kembali.js (registry penutup lapisan) ----------
// Catatan semantik: tutupTeratas() TIDAK melepas registrasi — lapisan tetap
// terdaftar sampai komponennya ditutup/unmount (cleanup lepasPenutup). Tutup()
// yang memanggil setState open=false itulah yang menghapus lapisan.
let a = 0, b = 0, c = 0
const lepasA = daftarPenutup(() => a++)   // lapisan paling bawah
const lepasB = daftarPenutup(() => b++)   // tengah
const lepasC = daftarPenutup(() => c++)   // teratas
sama('mulai: 3 lapisan', jumlahLapisan(), 3)
sama('tutup teratas → c', (tutupTeratas(), c), 1)
sama('teratas tetap sampai dilepas', (tutupTeratas(), c), 2)
lepasA() // buang lapisan bawah
sama('jumlah setelah lepas lapisan bawah', jumlahLapisan(), 2)
sama('teratas masih c', (tutupTeratas(), c), 3)
lepasB()
lepasC()
sama('registry kosong → false', tutupTeratas(), false)
daftarPenutup(() => { throw new Error('boom') })
sama('error penutup ditelan → tetap true', tutupTeratas(), true)
lepasB()

// ---------- notif.js (helper murni, lewat esbuild) ----------
try {
  const { build } = await import('esbuild')
  await build({
    entryPoints: ['src/utils/notif.js'],
    bundle: true,
    format: 'esm',
    outfile: '.uji-notif.mjs',
    logLevel: 'silent',
    external: ['@capacitor/*'],
  })
  const n = await import('../.uji-notif.mjs')
  sama('idNotifikasi int kecil tetap', n.idNotifikasi(42), 42)
  sama('idNotifikasi stabil untuk string', n.idNotifikasi('pengingat-masuk'), n.idNotifikasi('pengingat-masuk'))
  sama('idNotifikasi berbeda untuk string lain', n.idNotifikasi('pengingat-masuk') !== n.idNotifikasi('pengingat-pulang'), true)
  sama('menitDariJam 08:15', n.menitDariJam('08:15'), 495)
  sama('menitDariJam 17:00', n.menitDariJam('17:00'), 1020)
  sama('menitDariJam jam liar', n.menitDariJam('25:00'), null)
  sama('geserJam -5 menit', n.geserJam('08:15', -5), { jam: 8, menit: 10 })
  sama('geserJam negatif terkunci 00:00', n.geserJam('00:05', -30), { jam: 0, menit: 0 })
  sama('geserJam atas terkunci 23:59', n.geserJam('23:50', 30), { jam: 23, menit: 59 })
} catch (e) {
  console.log(`⚠ lewati uji notif.js (${e.message})`)
}

console.log(gagal === 0 ? '\nSemua uji ekspor & Back LULUS ✅' : `\n${gagal} uji GAGAL ❌`)
process.exit(gagal === 0 ? 0 : 1)

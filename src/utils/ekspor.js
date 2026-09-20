// Pustaka export (exceljs + jspdf + jspdf-autotable) berukuran besar.
// Dimuat lewat import() dinamis saat tombol export benar-benar diklik, lalu
// hasilnya di-cache — bukan saat aplikasi dibuka. Vite otomatis memecah paket
// ini menjadi chunk terpisah, sehingga bundel awal (login & absensi) tetap ringan.
//
// Bila chunk gagal dimuat (bundel basi setelah deploy baru — "failed to fetch
// dynamically imported module"), cache Service Worker dibersihkan dan halaman
// dimuat ulang SEKALI otomatis; user cukup mengulang unduhan setelah terbuka.
import { pulihkanBundel, terakhirGagalMuat } from './pulihkan'

let pustaka = null

const muat = async () => {
  const [exceljs, jspdf, autoTabel] = await Promise.all([
    import('exceljs'),
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  return {
    // Interop: sebagian paket mengekspor lewat `default`, sebagian sebagai named export.
    ExcelJS: exceljs.default?.Workbook ? exceljs.default : exceljs.Workbook ? exceljs : exceljs.default || exceljs,
    jsPDF: jspdf.jsPDF || jspdf.default?.jsPDF || jspdf.default,
    autoTable: autoTabel.default || autoTabel,
  }
}

export async function muatPustakaEkspor() {
  if (pustaka) return pustaka
  try {
    pustaka = await muat()
  } catch (e) {
    const memuatUlang = await pulihkanBundel()
    if (memuatUlang) {
      throw new Error('Aplikasi sedang diperbarui otomatis — buka unduhan sekali lagi setelah halaman terbuka.')
    }
    if (terakhirGagalMuat(e) && navigator.onLine === false) {
      throw new Error('Butuh koneksi internet sekali untuk menyiapkan unduhan. Sambungkan internet lalu coba lagi.')
    }
    pustaka = await muat() // percobaan kedua setelah cache dibersihkan
  }
  return pustaka
}


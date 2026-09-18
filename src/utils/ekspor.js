// Pustaka export (xlsx + jspdf + jspdf-autotable) berukuran besar (± 380 kB).
// Dimuat lewat import() dinamis saat tombol export benar-benar diklik, lalu
// hasilnya di-cache — bukan saat aplikasi dibuka. Vite otomatis memecah paket
// ini menjadi chunk terpisah, sehingga bundel awal (login & absensi) tetap ringan.
let pustaka = null

export async function muatPustakaEkspor() {
  if (!pustaka) {
    const [xlsx, jspdf, autoTabel] = await Promise.all([
      import('xlsx'),
      import('jspdf'),
      import('jspdf-autotable'),
    ])
    pustaka = {
      // Interop: sebagian paket mengekspor lewat `default`, sebagian sebagai named export.
      XLSX: xlsx.default || xlsx,
      jsPDF: jspdf.jsPDF || jspdf.default?.jsPDF || jspdf.default,
      autoTable: autoTabel.default || autoTabel,
    }
  }
  return pustaka
}
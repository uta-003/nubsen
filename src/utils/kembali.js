// Registry "penutup lapisan" untuk tombol Back Android.
//
// Tombol Back harus menutup lapisan teratas lebih dulu (modal/sheet/dialog),
// BARU kembali ke Beranda, dan terakhir menawarkan keluar dari aplikasi.
// Setiap komponen yang menampilkan lapisan mendaftarkan fungsi penutupnya
// lewat usePenutupKembali (hooks/useTombolKembali.js).
const penutup = []

// Daftarkan penutup; kembalikan fungsi pelepas (dipakai useEffect cleanup).
export function daftarPenutup(tutup) {
  penutup.push(tutup)
  return () => {
    const i = penutup.lastIndexOf(tutup)
    if (i >= 0) penutup.splice(i, 1)
  }
}

// Tutup lapisan teratas. true = ada yang ditutup (Back "dipakai").
export function tutupTeratas() {
  const tutup = penutup[penutup.length - 1]
  if (!tutup) return false
  try {
    tutup()
  } catch {
    // Penutup gagal bukan alasan memblokir navigasi Back.
  }
  return true
}

export function jumlahLapisan() {
  return penutup.length
}
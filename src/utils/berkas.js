// Helper MURNI seputar berkas ekspor — tidak menyentuh API peramban maupun
// plugin native, sehingga bisa diuji langsung dengan Node
// (lihat scripts/uji-unduhan.mjs). Semua logika platform ada di utils/unduh.js.

export const MIME = {
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
}

// Nama berkas aman di Android, Windows, dan iOS: karakter terlarang diganti,
// spasi → tanda hubung, tidak diawali titik, panjang wajar.
export function namaBerkasAman(nama, bawaan = 'unduhan-nubsen') {
  const bersih = String(nama ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\-]+/, '')
    .replace(/[.\-]+$/, '')
    .slice(0, 120)
  return bersih || bawaan
}

// CSV ramah Excel Indonesia: BOM UTF-8 (aksen/emoji tidak rusak) + pemisah ';'
// + tanda kutip hanya bila isi sel mengandung ';' kutip atau baris baru.
// Sel dengan koma/emoji TIDAK perlu dikutip karena pemisahnya titik koma.
export function buatCSV(baris) {
  const sel = (nilai) => {
    const teks = nilai == null ? '' : String(nilai)
    return /[";\r\n]/.test(teks) ? `"${teks.replace(/"/g, '""')}"` : teks
  }
  return '\ufeff' + (baris || [])
    .map((r) => (Array.isArray(r) ? r : [r]).map(sel).join(';'))
    .join('\r\n')
}

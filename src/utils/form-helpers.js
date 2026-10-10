// Helper form angka untuk input rupiah (Gaji Harian, Uang Makan, Tarif Lembur)
// di panel admin. Input memakai type="text" + inputMode="numeric" supaya keyboard
// ponsel menampilkan angka dan teks bebas diketik — type="number" di beberapa
// peramban/ponsel menolak input dan menyisakan nilai "0" sementara yang merusak
// data. Nilai tersimpan sebagai STRING berformat ribuan ("150.000") dan diubah
// menjadi angka oleh parseNumeric() sebelum dikirim ke server.
import { useCallback } from 'react'

// Batas digit: 10 digit (maksimal Rp9.999.999.999). formatRupiah selalu
// memotong ke 10 digit lebih dulu, jadi string hasil format tidak pernah
// melewati batas aman dan slice tidak pernah memotong nilai yang sah.
const MAKS_DIGIT = 10

// Angka → string berformat ribuan ("150000" → "150.000"). Karakter non-digit
// (termasuk titik hasil tempelan) dibuang agar format selalu valid.
export function formatRupiah(nilai) {
  const digit = String(nilai ?? '').replace(/\D/g, '').slice(0, MAKS_DIGIT)
  if (!digit) return ''
  return digit.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// String berformat → angka siap kirim ("150.000" → 150000, kosong → 0).
export function parseNumeric(nilai) {
  const digit = String(nilai ?? '').replace(/\D/g, '').slice(0, MAKS_DIGIT)
  return digit ? Number(digit) : 0
}

// Props untuk input angka terformat:
//   • value selalu tampil berformat ribuan,
//   • onKeyDown memblokir huruf/simbol (izinkan digit + tombol navigasi/hapus,
//     serta pintasan Ctrl/Cmd untuk salin/tempel — hasil tempelan dibersihkan
//     onChange),
//   • onChange memformat ulang setiap perubahan.
// Pakai: <input {...useNumericInput(form.gajiHarian, (v) => set('gajiHarian', v))} />
export function useNumericInput(nilai, onUbah) {
  const tekan = useCallback((e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return // salin/tempel/undo tetap jalan
    const boleh = /^\d$/.test(e.key) ||
      ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab'].includes(e.key)
    if (!boleh) e.preventDefault()
  }, [])

  return {
    type: 'text',
    inputMode: 'numeric',
    autoComplete: 'off',
    value: String(nilai ?? ''),
    onChange: (e) => onUbah(formatRupiah(e.target.value)),
    onKeyDown: tekan,
  }
}

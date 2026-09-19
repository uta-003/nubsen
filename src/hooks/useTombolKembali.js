import { useEffect, useRef } from 'react'
import { diAplikasi, muatPlugin } from '../utils/native'
import { daftarPenutup } from '../utils/kembali'

// Tombol Back Android → diserahkan ke aplikasi (App.jsx menentukan: tutup modal →
// kembali ke Beranda → tawarkan keluar). Handler disimpan di ref supaya listener
// native cukup dipasang SEKALI dan selalu memanggil versi terbaru.
export function useTombolKembali(saatKembali) {
  const ref = useRef(saatKembali)
  ref.current = saatKembali

  useEffect(() => {
    if (!diAplikasi()) return undefined
    let batal = false
    let handle = null
    muatPlugin('App')
      .then((App) => App.addListener('backButton', () => ref.current?.()))
      .then((h) => {
        if (batal) h.remove()
        else handle = h
      })
      .catch(() => {
        // Tanpa plugin (mis. APK lama) tombol Back kembali ke perilaku bawaan.
      })
    return () => {
      batal = true
      try {
        handle?.remove()
      } catch {
        // handle belum siap — tidak ada yang perlu dilepas.
      }
    }
  }, [])
}

// Modal/sheet: selama terbuka, tombol Back menutupnya lebih dulu.
export function usePenutupKembali(aktif, tutup) {
  const ref = useRef(tutup)
  ref.current = tutup

  useEffect(() => {
    if (!aktif) return undefined
    return daftarPenutup(() => ref.current?.())
  }, [aktif])
}

export default useTombolKembali
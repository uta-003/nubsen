// ============ Unduh berkas hasil ekspor (Excel / PDF / CSV) ============
//
// ADA DUA JALUR karena perilaku peramban dan aplikasi Android berbeda:
//
// 1. PERAMBAN (PWA & desktop) — Blob + <a download>. Dua jebakan klasik yang
//    membuat unduhan gagal SENYAP sudah dihindari di sini:
//      • anchor wajib DITEMPELKAN ke DOM (Firefox/Safari mengabaikan anchor lepas);
//      • object URL tidak boleh dicabut seketika setelah click() — pencabutan
//        langsung membatalkan unduhan di sebagian peramban/WebView.
//
// 2. APLIKASI ANDROID (Capacitor WebView) — WebView tidak punya UI unduhan untuk
//    skema blob:/data: (Bridge.launchIntent mengembalikan false untuk kedua skema
//    itu, dan tidak ada setDownloadListener) sehingga a.click() tidak menghasilkan
//    apa pun. Karena itu berkas ditulis ke folder Cache aplikasi lewat plugin
//    Filesystem, lalu dibuka dengan lembar "Bagikan/Simpan" Android (plugin Share)
//    supaya user bisa menyimpannya ke File/Files atau mengirimnya ke aplikasi lain.
import { MIME, namaBerkasAman } from './berkas'
import { diAplikasi, muatPlugin } from './native'

// Cukup lama agar unduhan besar tidak terpotong, tapi tetap membersihkan memori.
const TUNGGU_CABUT_MS = 15000
const PESAN_GAGAL = 'Berkas gagal disiapkan di perangkat ini.'

// Blob → base64 (tanpa awalan "data:...;base64,") untuk plugin Filesystem.
export function blobKeBase64(blob) {
  return new Promise((selesai, gagal) => {
    const pembaca = new FileReader()
    pembaca.onerror = () => gagal(new Error(PESAN_GAGAL))
    pembaca.onload = () => {
      const hasil = String(pembaca.result || '')
      const koma = hasil.indexOf(',')
      if (koma < 0) return gagal(new Error(PESAN_GAGAL))
      selesai(hasil.slice(koma + 1))
    }
    pembaca.readAsDataURL(blob)
  })
}

// Unduh berkas. `isi` boleh string (CSV) atau Blob (hasil XLSX.write / jsPDF.output).
// Hasil: { cara: 'unduh' | 'bagikan', nama, uri, tanpaLembarBagikan? }
export async function unduhBerkas({ nama, isi, mime = 'application/octet-stream', judul }) {
  const namaAman = namaBerkasAman(nama)
  const blob = isi instanceof Blob ? isi : new Blob([isi], { type: mime })

  if (diAplikasi()) {
    const [{ Filesystem: FS, Directory }, Share] = await Promise.all([
      muatPlugin('Filesystem'),
      muatPlugin('Share'),
    ])
    const base64 = await blobKeBase64(blob)
    const { uri } = await FS.writeFile({
      path: `unduhan/${namaAman}`,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    })
    // canShare() false (mis. perangkat tanpa aplikasi penerima) → berkas tetap
    // tersimpan di cache aplikasi; pemanggil memberi tahu lokasinya.
    let bisaBagikan = true
    try {
      bisaBagikan = (await Share.canShare())?.value !== false
    } catch {
      bisaBagikan = true
    }
    if (bisaBagikan) {
      await Share.share({
        title: judul || namaAman,
        files: [uri],
        dialogTitle: 'Simpan atau bagikan berkas',
      })
      return { cara: 'bagikan', nama: namaAman, uri }
    }
    return { cara: 'bagikan', nama: namaAman, uri, tanpaLembarBagikan: true }
  }

  const url = URL.createObjectURL(blob)
  const tautan = document.createElement('a')
  tautan.href = url
  tautan.download = namaAman
  tautan.rel = 'noopener'
  tautan.style.display = 'none'
  document.body.appendChild(tautan)
  tautan.click()
  setTimeout(() => {
    tautan.remove()
    URL.revokeObjectURL(url)
  }, TUNGGU_CABUT_MS)
  return { cara: 'unduh', nama: namaAman, uri: url }
}

// Kalimat siap tampil untuk toast/banner setelah unduhan.
export function pesanHasilUnduh(hasil, label = 'Berkas') {
  if (!hasil) return ''
  if (hasil.cara !== 'bagikan') return `${label} berhasil diunduh (${hasil.nama}).`
  return hasil.tanpaLembarBagikan
    ? `${label} tersimpan di aplikasi (${hasil.nama}) — bagikan lewat aplikasi File.`
    : `${label} siap — pilih "Simpan"/"Bagikan" pada dialog Android.`
}

// Unduh + kembalikan pesan siap tampil; melempar Error berpesan ramah bila gagal.
export async function unduhDanPesan({ nama, isi, mime, judul, label }) {
  const hasil = await unduhBerkas({ nama, isi, mime, judul })
  return { hasil, pesan: pesanHasilUnduh(hasil, label) }
}

export { MIME, namaBerkasAman }

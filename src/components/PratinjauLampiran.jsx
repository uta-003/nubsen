// ============ Pratinjau lampiran / foto (modal) ============
// Menampilkan lampiran pengajuan (gambar atau PDF) dan foto selfie absensi.
// Isi berkas dikirim server HANYA saat dibuka, jadi daftar tetap ringan.
import { useEffect, useState } from 'react'
import { X, Loader2, Download, FileText, ExternalLink, TriangleAlert } from 'lucide-react'
import { usePenutupKembali } from '../hooks/useTombolKembali'
import { unduhBerkas, pesanHasilUnduh, MIME } from '../utils/unduh'

// dataURL ('data:image/png;base64,....') → Blob (untuk unduh / buka tab baru).
export function dataUrlKeBlob(dataUrl) {
  const cocok = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(dataUrl || ''))
  if (!cocok) return null
  const [, mime = 'application/octet-stream', base64, isi] = cocok
  if (!base64) return new Blob([decodeURIComponent(isi)], { type: mime })
  const biner = atob(isi)
  const buf = new Uint8Array(biner.length)
  for (let i = 0; i < biner.length; i++) buf[i] = biner.charCodeAt(i)
  return new Blob([buf], { type: mime })
}

export default function PratinjauLampiran({ buka, judul = 'Lampiran', isi, memuat = false, galat = null, onClose, toast }) {
  const [unduh, setUnduh] = useState(false)
  usePenutupKembali(!!buka, onClose)

  const tipe = String(isi || '').slice(0, 30).toLowerCase()
  const gambar = tipe.startsWith('data:image') || /^https?:/i.test(String(isi || ''))
  const pdf = tipe.startsWith('data:application/pdf')

  // Buka PDF di tab baru (objek URL aman untuk dataURL — sama seperti unduhan).
  const bukaPdf = () => {
    const blob = dataUrlKeBlob(isi)
    if (!blob) return
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const unduhIsi = async () => {
    if (!isi) return
    setUnduh(true)
    try {
      const ekstensi = pdf ? 'pdf' : 'jpg'
      const hasil = await unduhBerkas({
        nama: `${judul}.${ekstensi}`,
        isi: dataUrlKeBlob(isi) || isi,
        mime: pdf ? MIME.pdf : 'image/jpeg',
        judul,
      })
      toast?.(pesanHasilUnduh(hasil, 'Lampiran'), 'success')
    } catch (e) {
      toast?.(e.message || 'Gagal menyiapkan berkas.', 'error')
    } finally {
      setUnduh(false)
    }
  }

  if (!buka) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="animate-slide-up flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-slate-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h3 className="truncate text-sm font-extrabold">{judul}</h3>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800" aria-label="Tutup">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {memuat ? (
            <p className="flex items-center justify-center gap-2 py-14 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" /> Memuat berkas…
            </p>
          ) : galat ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
              <TriangleAlert size={14} className="mr-1 inline" /> {galat}
            </p>
          ) : !isi ? (
            <p className="py-14 text-center text-xs text-slate-400">Berkas tidak tersedia.</p>
          ) : gambar ? (
            <img src={isi} alt={judul} className="w-full rounded-2xl bg-slate-100 object-contain dark:bg-slate-800" />
          ) : (
            <div className="space-y-3 py-6 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                <FileText size={24} />
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Berkas PDF tidak bisa dipratinjau di dalam aplikasi — buka di tab/jendela baru atau unduh.
              </p>
            </div>
          )}
        </div>

        {!!isi && (
          <div className="flex gap-2 border-t border-slate-100 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] dark:border-slate-800">
            {pdf && (
              <button onClick={bukaPdf} className="btn-ghost flex-1 !py-2.5 text-xs">
                <ExternalLink size={14} /> Buka PDF
              </button>
            )}
            <button onClick={unduhIsi} disabled={unduh} className="btn-primary flex-1 !py-2.5 text-xs">
              {unduh ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Unduh
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

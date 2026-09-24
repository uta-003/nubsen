// ============ Modal "Tolak dengan alasan" ============
// Dipakai panel admin untuk MENOLAK pengajuan izin/cuti maupun lembur. Alasan
// wajib (minimal 5 karakter) karena dikirim sebagai notifikasi ke karyawan dan
// tampil pada riwayat pengajuannya. Tampilan dirapikan: kepala modal yang jelas,
// ringkasan pengajuan, alasan cepat (chip), penghitung karakter, dan catatan.
import { useEffect, useState } from 'react'
import { X, Loader2, XCircle, TriangleAlert, MessageSquareQuote } from 'lucide-react'
import { usePenutupKembali } from '../hooks/useTombolKembali'

const ALASAN_CEPAT = {
  izin: [
    'Kuota cuti tahunan sudah habis',
    'Beban kerja sedang penuh',
    'Tanggal bertabrakan dengan rekan lain',
    'Keterangan pengajuan kurang jelas',
    'Dokumen pendukung tidak lengkap',
  ],
  lembur: [
    'Beban kerja bulan ini sudah terpenuhi',
    'Lembur belum masuk anggaran',
    'Bisa diselesaikan pada jam kerja',
    'Pengajuan melewati batas waktu',
    'Jadwal istirahat karyawan perlu dijaga',
  ],
  piket: [
    'Piket pada tanggal itu sudah ada petugas lain',
    'Piket belum masuk anggaran',
    'Tanggal tidak sesuai jadwal piket',
    'Tugas piket belum dikonfirmasi atasan',
    'Pengajuan melewati batas waktu',
  ],
}

const MAKS = 300

export default function ModalTolak({ buka, jenis = 'izin', nama, detail, onTutup, onKirim }) {
  const [alasan, setAlasan] = useState('')
  const [proses, setProses] = useState(false)
  const [galat, setGalat] = useState(null)
  // Tombol Back Android menutup modal ini lebih dulu.
  usePenutupKembali(!!buka, onTutup)

  // Setiap kali dibuka untuk pengajuan lain: alasan dikosongkan.
  useEffect(() => {
    if (buka) { setAlasan(''); setGalat(null) }
  }, [buka])

  if (!buka) return null

  const rapi = alasan.trim()
  const siap = rapi.length >= 5

  const kirim = async (e) => {
    e.preventDefault()
    if (!siap) return setGalat('Alasan minimal 5 karakter agar karyawan paham sebabnya.')
    setProses(true)
    setGalat(null)
    try {
      await onKirim(rapi)
    } catch (err) {
      setGalat(err?.message || 'Gagal mengirim alasan.')
    } finally {
      setProses(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex animate-fade-in items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center"
      onClick={onTutup}
    >
      <form
        onSubmit={kirim}
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-slate-900 sm:rounded-3xl"
      >
        {/* Kepala modal */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
              <XCircle size={20} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-extrabold">
                Tolak {jenis === 'lembur' ? 'Pengajuan Lembur' : jenis === 'piket' ? 'Pengajuan Piket' : 'Pengajuan Izin / Cuti'}
              </h3>
              <p className="truncate text-[11px] text-slate-400">Alasan wajib — sampai ke karyawan</p>
            </div>
          </div>
          <button type="button" onClick={onTutup} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90 dark:bg-slate-800" aria-label="Tutup">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {/* Ringkasan pengajuan yang ditolak */}
          <div className="rounded-2xl bg-slate-50 px-3.5 py-3 dark:bg-slate-800">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pengajuan</p>
            <p className="mt-0.5 text-sm font-bold text-slate-700 dark:text-slate-200">{nama || 'Karyawan'}</p>
            {detail && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{detail}</p>}
          </div>

          {/* Alasan cepat — sekali ketuk mengisi kolom alasan */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <MessageSquareQuote size={12} /> Pilih alasan cepat (bisa diedit)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(ALASAN_CEPAT[jenis] || ALASAN_CEPAT.izin).map((teks) => (
                <button
                  key={teks}
                  type="button"
                  onClick={() => { setAlasan(teks); setGalat(null) }}
                  className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition active:scale-95 ${
                    alasan === teks
                      ? 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {teks}
                </button>
              ))}
            </div>
          </div>

          {/* Alasan bebas + penghitung karakter */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="label !mb-0">Alasan penolakan *</label>
              <span className="text-[10px] font-semibold text-slate-400">{rapi.length}/{MAKS}</span>
            </div>
            <textarea
              className="input min-h-28 resize-none text-sm"
              placeholder={jenis === 'lembur'
                ? 'Contoh: Beban kerja bulan ini sudah penuh — lembur belum bisa disetujui.'
                : jenis === 'piket'
                  ? 'Contoh: Piket tanggal itu sudah ada petugas lain — silakan pilih tanggal lain.'
                  : 'Contoh: Kuota cuti tahunan sudah habis — silakan ajukan kembali bulan depan.'}
              value={alasan}
              maxLength={MAKS}
              onChange={(e) => { setAlasan(e.target.value); setGalat(null) }}
              autoFocus
            />
          </div>

          {galat && (
            <p className="rounded-2xl bg-rose-50 px-3.5 py-2.5 text-[11px] font-semibold leading-relaxed text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
              <TriangleAlert size={12} className="mr-1 inline" /> {galat}
            </p>
          )}

          <p className="rounded-2xl bg-amber-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            Alasan ini dikirim sebagai <b>notifikasi</b> ke karyawan dan tampil di <b>riwayat pengajuannya</b>.
          </p>
        </div>

        {/* Aksi */}
        <div className="flex gap-2 border-t border-slate-100 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] dark:border-slate-800">
          <button type="button" onClick={onTutup} className="btn-ghost flex-1 !py-3 text-xs">
            Batal
          </button>
          <button
            type="submit"
            disabled={proses || !siap}
            className="flex flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-rose-500 py-3 text-xs font-bold text-white shadow-lg shadow-rose-500/25 transition active:scale-95 disabled:opacity-40"
          >
            {proses ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
            {proses ? 'Mengirim…' : 'Tolak & kirim alasan'}
          </button>
        </div>
      </form>
    </div>
  )
}

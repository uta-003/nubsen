import { useState } from 'react'
import { HelpCircle, ChevronDown, X } from 'lucide-react'
import { usePenutupKembali } from '../hooks/useTombolKembali'

const FAQ = [
  {
    q: 'Bagaimana cara absen masuk & pulang?',
    a: 'Buka Beranda → tekan tombol besar "Absen Sekarang". Kamera selfie akan terbuka — posisikan wajah dalam bingkai lalu foto. Absen masuk sebelum 08:15 berstatus Hadir; setelah itu Terlambat. Jangan lupa check-out sebelum pulang.',
  },
  {
    q: 'Kenapa muncul "Di luar area kantor"?',
    a: 'Absensi hanya valid dalam radius 20 meter dari kantor. Pastikan GPS aktif dan izin lokasi browser diizinkan. Badge kuning berarti Anda di luar area — absen tetap tercatat namun ditandai.',
  },
  {
    q: 'Bagaimana cara mengajukan izin, sakit, atau cuti?',
    a: 'Buka tab Izin → pilih jenis (Izin, Sakit, Cuti Tahunan, Cuti Khusus, Izin Datang Terlambat), rentang tanggal, tulis keterangan, dan unggah lampiran (surat dokter, dsb.). Pengajuan yang mencakup hari ini otomatis mengubah status kehadiran. Sisa cuti tahunan terpotong otomatis saat cuti disetujui.',
  },
  {
    q: 'Bagaimana cara mengajukan lembur?',
    a: 'Buka tab Lembur → isi tanggal, jam mulai–selesai, dan deskripsi pekerjaan. PENTING: lembur hanya bisa diajukan untuk tanggal yang SUDAH ada absen masuknya — check-in dulu pada hari itu. Status pengajuan (Menunggu/Disetujui/Ditolak) muncul di daftar dan notifikasi.',
  },
  {
    q: 'Bagaimana cara mengajukan izin datang terlambat?',
    a: 'Buka tab Izin → pilih jenis "Datang Terlambat" (mencakup masuk lewat jam batas maupun masuk siang), lalu isi tanggal dan alasannya. Bagi karyawan yang memakai izin ini, hari yang disetujui tetap dihitung MASUK: gaji harian tetap dibayar dan UANG MAKAN TETAP DIBERIKAN walau jam masuknya lewat. Absen masuk tetap wajib dilakukan seperti biasa — setelah izin disetujui, status absensi hari itu otomatis menjadi "Izin Terlambat".',
  },
  {
    q: 'Bagaimana cara mengajukan piket?',
    a: 'Buka tab Pengajuan → sub-halaman Piket → isi tanggal piket (jam mulai/selesai bersifat opsional) dan keterangannya, lalu kirim. Pengajuan yang disetujui admin dibayar sebesar BIAYA PIKET yang ditetapkan perusahaan dan otomatis ikut terhitung pada slip gaji periode penggajian terkait. Satu tanggal hanya boleh punya satu pengajuan yang masih Menunggu/Disetujui.',
  },
  {
    q: 'Kenapa absensi saya berstatus "Perlu Tinjauan"?',
    a: 'Jam absen yang tidak wajar (mis. check-in lebih dari 4 jam sebelum jam masuk, atau setelah jam pulang) tidak otomatis dihitung Hadir. Catatan itu ditandai "Perlu Tinjauan" dan belum dihitung sebagai hari dibayar sampai admin mengoreksinya di panel Absensi. Kalau memang sah, hubungi admin agar statusnya diubah menjadi Hadir/Terlambat.',
  },
  {
    q: 'Di mana saya bisa melihat riwayat absensi?',
    a: 'Tab Riwayat menyediakan daftar + tampilan kalender bulanan, filter status, filter rentang tanggal, dan tombol CSV untuk unduh data ke Excel. Ketuk kartu untuk melihat detail: selfie, peta lokasi, dan durasi kerja.',
  },
  {
    q: 'Apa bedanya menu Pengumuman (megafon) dan Notifikasi (lonceng)?',
    a: 'Megafon = kabar perusahaan untuk semua orang (pengumuman, penting, jadwal, info). Tiap kartu bisa Anda tandai sendiri "sudah dibaca" lewat tombol centang, atau tekan "Tandai Semua". Lonceng = pesan pribadi Anda saja: hasil persetujuan izin/lembur, absensi, dan slip gaji. Badge merah di masing-masing menandakan masih ada yang belum dibaca — membuka halamannya otomatis menandai terbaca.',
  },
  {
    q: 'Lupa PIN atau lupa logout di HP lain?',
    a: 'Hubungi admin (HR) untuk mereset PIN Anda. Menu Profil → "Keluar dari NUBSEN" mengakhiri sesi di perangkat ini saja.',
  },
]

// Pusat Bantuan: modal FAQ akordeon — user tidak perlu tanya admin untuk hal dasar.
export default function Bantuan({ open, onClose }) {
  const [buka, setBuka] = useState(null)
  // Tombol Back Android menutup Pusat Bantuan lebih dulu.
  usePenutupKembali(!!open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="animate-slide-up max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] dark:bg-slate-900 sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-extrabold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              <HelpCircle size={18} />
            </span>
            Pusat Bantuan
          </h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800" aria-label="Tutup">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2">
          {FAQ.map((f, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setBuka(buka === i ? null : i)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-bold transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                {f.q}
                <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${buka === i ? 'rotate-180' : ''}`} />
              </button>
              {buka === i && (
                <p className="border-t border-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  {f.a}
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[11px] text-slate-400">
          Masih ada pertanyaan? Hubungi HR melalui email di menu Profil.
        </p>
      </div>
    </div>
  )
}

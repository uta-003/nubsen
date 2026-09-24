// ============ Slip Gaji karyawan (per PERIODE PENGGAJIAN) ============
// Periode ditetapkan admin di panel (tab Gaji → Periode Penggajian); periode yang
// AKTIF inilah yang tampil di sini. Karyawan bisa memilih periode lain dan
// mengunduh slipnya sebagai PDF. Rumusnya sama dengan panel admin:
//   • Hari Dibayar    = Hadir + Terlambat + Hadir Libur + Izin + Sakit + Cuti
//   • Hari Uang Makan = Hadir + Hadir Libur + Izin Datang Terlambat
//     (TELAT tanpa izin tidak dapat uang makan; izin datang tetap dapat)
//   • Lembur          = jam lembur Disetujui × tarif/jam
// Periode yang dipakai = periode AKTIF yang ditetapkan admin di tab Gaji.
import { useEffect, useState } from 'react'
import {
  X, Wallet, Loader2, Download, TriangleAlert, Utensils, Clock4,
  CalendarRange, TrendingUp, Info,
} from 'lucide-react'
import * as api from '../api'
import { usePenutupKembali } from '../hooks/useTombolKembali'
import { unduhBerkas, pesanHasilUnduh, MIME } from '../utils/unduh'
import { muatPustakaEkspor } from '../utils/ekspor'
import { formatTanggalPendek } from '../utils/date'

const rupiah = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString('id-ID')}`

export default function SlipGaji({ open, onClose, user, toast }) {
  const [data, setData] = useState(null)
  const [periodeId, setPeriodeId] = useState('')
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState(null)
  const [unduh, setUnduh] = useState(false)
  // Tombol Back Android menutup slip lebih dulu.
  usePenutupKembali(!!open, onClose)

  useEffect(() => {
    if (!open) return
    setMemuat(true)
    setGalat(null)
    api.getSlipGaji({ periodeId: periodeId || undefined })
      .then(setData)
      .catch((e) => setGalat(e.message))
      .finally(() => setMemuat(false))
  }, [open, periodeId])

  if (!open) return null

  const slip = data?.slip || null
  const periode = data?.periode || null

  // ---------- Unduh slip sebagai PDF (jsPDF + autoTable, dimuat saat diklik) ----------
  const unduhPdf = async () => {
    if (!slip || !periode) return
    setUnduh(true)
    try {
      const { jsPDF, autoTable } = await muatPustakaEkspor()
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      doc.setFontSize(14)
      doc.text('SLIP GAJI — NUBSEN', 40, 40)
      doc.setFontSize(10)
      doc.setTextColor(90)
      doc.text(`Periode: ${periode.nama}`, 40, 56)
      doc.text(`${formatTanggalPendek(periode.dari)} s.d. ${formatTanggalPendek(periode.sampai)}`, 40, 70)
      doc.text(`Nama: ${slip.nama || user?.nama || '-'}   •   NIP: ${slip.nip || '-'}`, 40, 84)
      doc.text(`Jabatan: ${slip.jabatan || '-'} / ${slip.departemen || '-'}   •   Status: ${slip.statusKaryawan || 'Karyawan Tetap'}`, 40, 98)

      autoTable(doc, {
        startY: 112,
        head: [['Komponen', 'Perhitungan', 'Jumlah']],
        body: [
          ['Gaji harian', `${rupiah(slip.gajiHarian)} × ${slip.hariDibayar} hari`, rupiah(slip.subGaji)],
          ['Uang makan', `${rupiah(slip.uangMakan)} × ${slip.hariMakan} hari`, rupiah(slip.subMakan)],
          ['Lembur', `${rupiah(slip.tarifLembur)} × ${slip.lembur || 0} jam`, rupiah(slip.subLembur)],
          // Piket hanya muncul bila ada piket DISETUJUI pada periode ini.
          ...(slip.piket > 0 ? [['Piket', `${rupiah(slip.biayaPiket)} × ${slip.piket} kali`, rupiah(slip.subPiket)]] : []),
          ['TOTAL DITERIMA', '', rupiah(slip.total)],
        ],
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [10, 29, 87] },
        columnStyles: { 2: { halign: 'right' } },
      })
      const y = (doc.lastAutoTable?.finalY || 200) + 18
      doc.setFontSize(8.5)
      doc.setTextColor(110)
      doc.text('Catatan: hari Terlambat TANPA izin tetap dibayar gaji hariannya tetapi tidak mendapat uang makan; hari dengan izin datang terlambat tetap mendapat uang makan; piket dibayar dari pengajuan yang disetujui.', 40, y)
      doc.text(
        `Rincian: hadir ${slip.hadir} • terlambat ${slip.terlambat || 0} (tanpa uang makan) • hadir libur ${slip.hadirLibur} • izin ${slip.izin} • sakit ${slip.sakit} • cuti ${slip.cuti} • alpha ${slip.alpha}`,
        40, y + 12,
      )
      doc.text('Dibuat otomatis oleh NUBSEN.', 40, y + 24)

      const hasil = await unduhBerkas({
        nama: `slip-gaji-${periode.nama}-${slip.nama || ''}.pdf`,
        isi: doc.output('blob'),
        mime: MIME.pdf,
        judul: 'Slip Gaji NUBSEN',
      })
      toast?.(pesanHasilUnduh(hasil, 'Slip gaji'), 'success')
    } catch (e) {
      toast?.(`Gagal membuat slip PDF: ${e.message}`, 'error')
    } finally {
      setUnduh(false)
    }
  }

  const kartu = [
    { Icon: CalendarRange, label: 'Hari Dibayar', nilai: slip?.hariDibayar ?? 0, warna: 'text-emerald-600 dark:text-emerald-400' },
    { Icon: Utensils, label: 'Hari Uang Makan', nilai: slip?.hariMakan ?? 0, warna: 'text-teal-600 dark:text-teal-400' },
    { Icon: Clock4, label: 'Jam Lembur', nilai: `${slip?.lembur ?? 0}j`, warna: 'text-indigo-600 dark:text-indigo-400' },
    { Icon: Wallet, label: 'Total Diterima', nilai: rupiah(slip?.total ?? 0), warna: 'text-violet-600 dark:text-violet-400' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="animate-slide-up max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] dark:bg-slate-900 sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-extrabold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Wallet size={18} />
            </span>
            Slip Gaji
          </h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800" aria-label="Tutup">
            <X size={16} />
          </button>
        </div>

        {memuat ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" /> Memuat slip gaji…
          </p>
        ) : galat ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
            <TriangleAlert size={14} className="mr-1 inline" /> {galat}
          </p>
        ) : !periode ? (
          <div className="rounded-2xl bg-amber-50 px-4 py-4 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <TriangleAlert size={14} className="mr-1 inline" />
            Belum ada <b>periode penggajian</b> yang ditetapkan admin. Slip gaji muncul otomatis setelah admin
            menetapkan periode di panel <b>Admin → Gaji → Periode Penggajian</b>.
          </div>
        ) : (
          <>
            {/* Pilihan periode — semua periode yang pernah ditetapkan admin */}
            {(data?.daftar || []).length > 1 && (
              <div className="mb-3">
                <label className="label">Periode Penggajian</label>
                <select className="input !py-2.5 text-sm" value={periodeId || periode.id} onChange={(e) => setPeriodeId(e.target.value)}>
                  {(data?.daftar || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama} ({formatTanggalPendek(p.dari)} – {formatTanggalPendek(p.sampai)}){p.aktif ? ' • aktif' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Kepala slip */}
            <div className="rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 p-4 text-white shadow-lg shadow-indigo-500/25">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Periode Penggajian</p>
              <p className="text-lg font-extrabold leading-tight">{periode.nama}</p>
              <p className="mt-0.5 text-[11px] text-white/80">
                {formatTanggalPendek(periode.dari)} s.d. {formatTanggalPendek(periode.sampai)}
                {periode.aktif && <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">AKTIF</span>}
              </p>
              <p className="mt-3 text-2xl font-extrabold">{rupiah(slip?.total ?? 0)}</p>
              <p className="text-[11px] text-white/80">Total diterima — {slip?.nama || user?.nama}</p>
            </div>

            {/* Ringkasan angka */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {kartu.map(({ Icon, label, nilai, warna }) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <Icon size={12} /> {label}
                  </p>
                  <p className={`mt-1 text-sm font-extrabold ${warna}`}>{nilai}</p>
                </div>
              ))}
            </div>

            {/* Rincian perhitungan */}
            <div className="mt-3 space-y-2 rounded-2xl border border-slate-100 p-3 text-xs dark:border-slate-800">
              {[
                ['Gaji harian', `${rupiah(slip?.gajiHarian)} × ${slip?.hariDibayar ?? 0} hari`, rupiah(slip?.subGaji ?? 0)],
                ['Uang makan', `${rupiah(slip?.uangMakan)} × ${slip?.hariMakan ?? 0} hari`, rupiah(slip?.subMakan ?? 0)],
                ['Lembur', `${rupiah(slip?.tarifLembur)} × ${slip?.lembur ?? 0} jam`, rupiah(slip?.subLembur ?? 0)],
                // Piket = jumlah piket DISETUJUI × biaya piket (pengaturan admin).
                ...((slip?.piket ?? 0) > 0
                  ? [['Piket', `${rupiah(slip?.biayaPiket)} × ${slip.piket} kali`, rupiah(slip?.subPiket ?? 0)]]
                  : []),
              ].map(([label, hitung, nilai]) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-700 dark:text-slate-200">{label}</p>
                    <p className="text-[10px] text-slate-400">{hitung}</p>
                  </div>
                  <p className="shrink-0 font-semibold text-slate-600 dark:text-slate-300">{nilai}</p>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                <p className="font-extrabold text-slate-700 dark:text-slate-200">TOTAL</p>
                <p className="font-extrabold text-indigo-600 dark:text-indigo-300">{rupiah(slip?.total ?? 0)}</p>
              </div>
            </div>

            {/* Kehadiran pada periode ini */}
            <p className="mt-3 rounded-2xl bg-slate-50 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <TrendingUp size={12} className="mr-1 inline" />
              Hadir {slip?.hadir ?? 0} • Terlambat {slip?.terlambat ?? 0} • Hadir libur {slip?.hadirLibur ?? 0} • Izin{' '}
              {slip?.izin ?? 0} • Sakit {slip?.sakit ?? 0} • Cuti {slip?.cuti ?? 0} • Alpha {slip?.alpha ?? 0}
              {(slip?.izinDatang ?? 0) > 0 && <> • Izin datang {slip.izinDatang}</>}
              {(slip?.piket ?? 0) > 0 && <> • Piket {slip.piket}</>}
            </p>
            {(slip?.izinDatang ?? 0) > 0 && (
              <p className="mt-2 rounded-2xl bg-teal-50 px-3.5 py-3 text-[11px] font-semibold leading-relaxed text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                <Utensils size={12} className="mr-1 inline" />
                {slip.izinDatang} hari izin datang terlambat — gaji harian dan uang makan tetap dibayarkan.
              </p>
            )}
            {(slip?.tanpaUangMakan ?? 0) > 0 && (
              <p className="mt-2 rounded-2xl bg-amber-50 px-3.5 py-3 text-[11px] font-semibold leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <Info size={12} className="mr-1 inline" />
                {slip.terlambat} hari Terlambat tidak mendapat uang makan ({rupiah(slip.potonganUangMakan)}).
              </p>
            )}

            <button
              onClick={unduhPdf}
              disabled={unduh}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition active:scale-95 disabled:opacity-50"
            >
              {unduh ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Unduh Slip (PDF)
            </button>
          </>
        )}
      </div>
    </div>
  )
}

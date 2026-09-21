import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { formatTanggalLengkap } from '../utils/date'

// Surat peringatan (SP1–SP3) & pemecatan dalam format SURAT RESMI seperti pada
// umumnya: kop perusahaan, nomor surat, perihal, dasar & alasan, paragraf
// eskalasi, serta tanda tangan + stempel. Bisa diunduh sebagai PDF.
export default function SuratKertas({ surat, user, perusahaan, toast }) {
  const [mengunduh, setMengunduh] = useState(false)
  const nama = perusahaan?.nama || 'PT Nubsen Indonesia'
  const alamat = perusahaan?.alamat || 'Kelapa Gading, Jakarta Utara'
  const kota = (String(alamat).split(',')[0] || 'Jakarta').trim()
  const tanggalIndo = formatTanggalLengkap(new Date(`${surat.tanggal}T00:00:00`)).split(', ').slice(1).join(', ')

  const jenis = surat.jenis
  const urutan = { SP1: 'Pertama', SP2: 'Kedua', SP3: 'Ketiga' }[jenis]
  const perihal = jenis === 'Pemecatan' ? 'Surat Pemecatan (Pemutusan Hubungan Kerja)' : `Surat Peringatan ${urutan}`
  const eskalasi =
    jenis === 'SP1'
      ? 'Apabila dalam masa pembinaan ini pelanggaran yang sama terulang kembali, perusahaan akan menerbitkan SURAT PERINGATAN KEDUA, dan apabila tetap berlanjut akan berujung pada Surat Peringatan Ketiga hingga Pemutusan Hubungan Kerja sesuai ketentuan yang berlaku.'
      : jenis === 'SP2'
        ? 'Apabila dalam masa pembinaan ini pelanggaran yang sama terulang kembali, perusahaan akan menerbitkan SURAT PERINGATAN KETIGA yang berakibat pada Pemutusan Hubungan Kerja sesuai ketentuan yang berlaku.'
        : jenis === 'SP3'
          ? 'Diterbitkannya Surat Peringatan Ketiga ini berarti Ybs berada pada tahap akhir pembinaan; pelanggaran berikutnya berakibat langsung pada Pemutusan Hubungan Kerja sesuai ketentuan yang berlaku.'
          : 'Dengan diterbitkannya surat ini, hubungan kerja antara Ybs dengan perusahaan dinyatakan berakhir per tanggal surat, dengan tetap menghormati hak-hak Ybs sesuai ketentuan peraturan perundang-undangan yang berlaku.'

  const unduhPdf = async () => {
    setMengunduh(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const K = 20 // margin (mm), lebar area teks 170
      let y = 18
      doc.setFont('times', 'bold').setFontSize(14)
      doc.text(nama.toUpperCase(), 105, y, { align: 'center' })
      y += 5
      doc.setFont('times', 'normal').setFontSize(9)
      doc.text(alamat, 105, y, { align: 'center' })
      y += 2
      doc.setLineWidth(0.6).line(K, y, 190, y)
      y += 1.2
      doc.setLineWidth(0.2).line(K, y, 190, y)
      y += 8
      doc.setFontSize(11)
      doc.text(`${kota}, ${tanggalIndo}`, 190, y, { align: 'right' })
      y += 6
      doc.setFont('times', 'normal').setFontSize(11)
      doc.text(`Nomor    : ${surat.nomor || '-'}`, K, y); y += 5
      doc.text('Lampiran : -', K, y); y += 5
      doc.setFont('times', 'bold')
      doc.text(`Perihal  : ${perihal}`, K, y); y += 9
      doc.setFont('times', 'normal')
      doc.text('Kepada Yth.', K, y); y += 5
      doc.text(user?.nama || '-', K, y); y += 5
      doc.text(`NIP. ${user?.nip || '-'} — ${user?.jabatan || '-'}, Dept. ${user?.departemen || '-'}`, K, y); y += 9
      doc.text('Dengan hormat,', K, y); y += 6
      const dasar = `Berdasarkan hasil evaluasi kedisiplinan dan catatan pelanggaran yang telah kami tinjau, dengan ini perusahaan memberikan ${perihal} kepada Ybs dengan rincian sebagai berikut:`
      for (const baris of doc.splitTextToSize(dasar, 170)) { doc.text(baris, K, y); y += 5.4 }
      y += 2
      doc.setFont('times', 'bolditalic').setFontSize(11.5)
      for (const baris of doc.splitTextToSize(`"${surat.alasan || '-'}"`, 170)) { doc.text(baris, K, y); y += 5.6 }
      y += 3
      doc.setFont('times', 'normal').setFontSize(11)
      for (const baris of doc.splitTextToSize(eskalasi, 170)) { doc.text(baris, K, y); y += 5.4 }
      y += 4
      for (const baris of doc.splitTextToSize('Demikian surat ini diterbitkan untuk diperhatikan dan dilaksanakan sebagaimana mestinya.', 170)) { doc.text(baris, K, y); y += 5.4 }
      y += 10
      doc.text('Hormat kami,', 160, y, { align: 'right' }); y += 5
      doc.setFont('times', 'bold')
      doc.text(nama, 160, y, { align: 'right' }); y += 5
      doc.setFont('times', 'normal')
      doc.text('Manajemen HRD', 160, y, { align: 'right' })
      doc.setDrawColor(220, 38, 38).setLineWidth(0.8)
      doc.circle(158, y - 14, 13)
      doc.setFontSize(7).setTextColor(220, 38, 38)
      doc.text('NUBSEN', 158, y - 14, { align: 'center' })
      doc.text('HRD', 158, y - 10.5, { align: 'center' })
      doc.save(`Surat-${jenis}-${surat.tanggal}.pdf`)
      toast?.('Surat diunduh sebagai PDF 📄')
    } catch (e) {
      toast?.(e.message || 'Gagal membuat PDF.', 'error')
    } finally {
      setMengunduh(false)
    }
  }

  const suratPemecatan = jenis === 'Pemecatan'
  return (
    <div className={`overflow-hidden rounded-2xl border shadow-sm ${suratPemecatan ? 'border-rose-300 dark:border-rose-500/40' : 'border-slate-200 dark:border-slate-700'}`}>
      <div className="relative bg-white px-5 py-4 font-serif text-[12.5px] leading-relaxed text-slate-800 dark:bg-slate-50">
        {/* Stempel dekoratif */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-4 top-1/2 grid h-20 w-20 -translate-y-1/2 rotate-[-14deg] place-items-center rounded-full border-2 border-rose-500/40 text-center text-[9px] font-bold leading-tight text-rose-500/50"
        >
          NUBSEN<br />HRD<br />• RESMI •
        </span>
        {/* KOP surat */}
        <div className="border-b-4 border-double border-slate-800 pb-2 text-center dark:border-slate-600">
          <p className="text-[13px] font-bold uppercase tracking-wide">{nama.toUpperCase()}</p>
          <p className="text-[10.5px] text-slate-500">{alamat}</p>
        </div>
        {/* Kota & tanggal */}
        <p className="mt-3 text-right">{kota}, {tanggalIndo}</p>
        {/* Nomor / Lampiran / Perihal */}
        <div className="mt-2 space-y-0.5">
          <p><span className="inline-block w-20">Nomor</span>: {surat.nomor || '-'}</p>
          <p><span className="inline-block w-20">Lampiran</span>: -</p>
          <p className="font-bold"><span className="inline-block w-20">Perihal</span>: {perihal}</p>
        </div>
        {/* Tujuan */}
        <div className="mt-3">
          <p>Kepada Yth.</p>
          <p className="font-bold">{user?.nama || '-'}</p>
          <p className="text-[11.5px] text-slate-500">NIP. {user?.nip || '-'} — {user?.jabatan || '-'}, Dept. {user?.departemen || '-'}</p>
        </div>
        {/* Isi */}
        <p className="mt-3">Dengan hormat,</p>
        <p className="mt-1 text-justify">
          Berdasarkan hasil evaluasi kedisiplinan dan catatan pelanggaran yang telah kami tinjau, dengan ini perusahaan
          memberikan <b>{perihal}</b> kepada Ybs dengan rincian sebagai berikut:
        </p>
        <p className={`mt-2 rounded-xl px-3 py-2 text-justify font-bold italic ${suratPemecatan ? 'bg-rose-100/70 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-amber-100/70 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200'}`}>
          &ldquo;{surat.alasan || '-'}&rdquo;
        </p>
        <p className="mt-2 text-justify text-[12px]">{eskalasi}</p>
        <p className="mt-2 text-justify text-[12px]">
          Demikian surat ini diterbitkan untuk diperhatikan dan dilaksanakan sebagaimana mestinya.
        </p>
        {/* Tanda tangan + stempel */}
        <div className="relative mt-4 flex justify-end">
          <div className="text-center">
            <p>Hormat kami,</p>
            <p className="mt-6 border-t border-slate-400 px-4 pt-1 font-bold">{nama}</p>
            <p className="text-[11px] text-slate-500">Manajemen HRD</p>
          </div>
        </div>
      </div>
      <button
        onClick={unduhPdf}
        disabled={mengunduh}
        className={`flex w-full items-center justify-center gap-2 py-3 text-xs font-bold text-white transition active:scale-[0.99] disabled:opacity-50 ${suratPemecatan ? 'bg-rose-600 shadow-lg shadow-rose-500/25' : 'bg-indigo-600 shadow-lg shadow-indigo-500/25'}`}
      >
        {mengunduh ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {mengunduh ? 'Menyiapkan PDF…' : 'Unduh Surat (PDF)'}
      </button>
    </div>
  )
}
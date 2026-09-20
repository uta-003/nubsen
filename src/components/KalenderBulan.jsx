import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, PartyPopper } from 'lucide-react'
import { bulanIndo, toISODate } from '../utils/date'
import { detailLibur, liburBulan } from '../utils/liburIndonesia'
import * as api from '../api'

// Libur KHUSUS yang ditetapkan admin (bukan libur nasional bawaan) datang dari
// /api/jadwal. Diambil SEKALI per sesi — di-cache di level modul agar membuka
// kalender bolak-balik tidak memuat ulang; daftar memuat tahun ini & tahun depan.
let cacheLiburServer = null
function ambilLiburServer() {
  if (!cacheLiburServer) {
    cacheLiburServer = api
      .getJadwal()
      .then((j) => (Array.isArray(j?.libur) ? j.libur : []))
      .catch(() => [])
  }
  return cacheLiburServer
}

const WARNA_TITIK = {
  Hadir: 'bg-emerald-500',
  Terlambat: 'bg-amber-500',
  Izin: 'bg-sky-500',
  Alpha: 'bg-rose-500',
}
// Pekan dimulai SENIN agar sejalan dengan kartu Statistik Mingguan (Senin–Minggu).
const KEPALA_HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const GESER_MIN = -24 // 2 tahun riwayat ke belakang
const GESER_MAKS = 12 // 1 tahun libur ke depan

// Kalender kehadiran bulanan + kalender Indonesia: SEMUA libur nasional &
// cuti bersama pada bulan terpilih ditampilkan dengan nama lengkap + jenisnya.
export default function KalenderBulan({ history = [], onSelect }) {
  const [geser, setGeser] = useState(0) // 0 = bulan ini, -1 = bulan lalu, dst.
  const [liburKhusus, setLiburKhusus] = useState([])
  useEffect(() => {
    ambilLiburServer().then(setLiburKhusus)
  }, [])
  const basis = new Date()
  basis.setDate(1)
  basis.setMonth(basis.getMonth() + geser)
  const tahun = basis.getFullYear()
  const bulan = basis.getMonth()
  const jumlahHari = new Date(tahun, bulan + 1, 0).getDate()
  const kolomAwal = (new Date(tahun, bulan, 1).getDay() + 6) % 7 // (getDay()+6)%7 → 0 = Senin
  const perTanggal = new Map(history.map((h) => [h.tanggal, h]))
  const hariIniIso = toISODate(new Date())
  const sel = [...Array(kolomAwal).fill(null), ...Array.from({ length: jumlahHari }, (_, i) => i + 1)]
  const iso = (d) => `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  // Gabungkan libur nasional/cuti bersama (data statis resmi) dengan libur khusus
  // dari admin — libur statis menang bila tanggalnya sama.
  const prefiks = `${tahun}-${String(bulan + 1).padStart(2, '0')}`
  const petaLibur = new Map(liburBulan(tahun, bulan).map((l) => [l.tanggal, l]))
  for (const l of liburKhusus) {
    if (l.tanggal.startsWith(prefiks) && !petaLibur.has(l.tanggal)) {
      petaLibur.set(l.tanggal, { tanggal: l.tanggal, nama: l.nama, jenis: 'admin' })
    }
  }
  const daftarLibur = [...petaLibur.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  const jumlahNasional = daftarLibur.filter((l) => l.jenis === 'nasional').length
  const jumlahCuti = daftarLibur.filter((l) => l.jenis === 'cuti').length
  const jumlahKhusus = daftarLibur.filter((l) => l.jenis === 'admin').length
  const labelJenis = (jenis) => (jenis === 'cuti' ? 'Cuti bersama' : jenis === 'admin' ? 'Libur khusus' : 'Libur nasional')

  return (
    <div className="card animate-fade-in">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setGeser((g) => Math.max(GESER_MIN, g - 1))}
          disabled={geser <= GESER_MIN}
          className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500 transition active:scale-90 disabled:opacity-30 dark:bg-slate-800 dark:text-slate-300"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft size={17} />
        </button>
        <button
          type="button"
          onClick={() => geser !== 0 && setGeser(0)}
          title={geser !== 0 ? 'Kembali ke bulan ini' : undefined}
          className="px-2 text-sm font-bold"
        >
          <span className={geser !== 0 ? 'underline decoration-dotted underline-offset-4' : ''}>
            {bulanIndo[bulan]} {tahun}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setGeser((g) => Math.min(GESER_MAKS, g + 1))}
          disabled={geser >= GESER_MAKS}
          className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500 transition active:scale-90 disabled:opacity-30 dark:bg-slate-800 dark:text-slate-300"
          aria-label="Bulan berikutnya"
        >
          <ChevronRight size={17} />
        </button>
      </div>

      {/* SEMUA libur bulan ini (kalender Indonesia) — nama lengkap + jenisnya */}
      <div className="mb-3 rounded-2xl bg-rose-50 p-3 dark:bg-rose-500/10">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-500 dark:text-rose-300">
          <PartyPopper size={12} className="shrink-0" /> Hari libur &amp; tanggal merah
        </p>
        {daftarLibur.length === 0 ? (
          <p className="text-[11px] font-semibold text-rose-400">
            Tidak ada libur nasional atau cuti bersama pada bulan ini.
          </p>
        ) : (
          <div className="space-y-1">
            {daftarLibur.map((l) => (
              <p
                key={l.tanggal}
                className="flex flex-wrap items-center gap-x-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-300"
              >
                <span className="shrink-0 tabular-nums">
                  {Number(l.tanggal.slice(8))} {bulanIndo[bulan].slice(0, 3)}
                </span>
                <span className="min-w-0 flex-1">{l.nama}</span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                    l.jenis === 'cuti'
                      ? 'bg-orange-200/70 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200'
                      : l.jenis === 'admin'
                        ? 'bg-indigo-200/70 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'
                        : 'bg-rose-200/70 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
                  }`}
                >
                  {labelJenis(l.jenis)}
                </span>
              </p>
            ))}
          </div>
        )}
        <p className="mt-1.5 text-[10px] font-semibold text-rose-400">
          {jumlahNasional} libur nasional · {jumlahCuti} cuti bersama{jumlahKhusus ? ` · ${jumlahKhusus} libur khusus` : ''}
        </p>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400">
        {KEPALA_HARI.map((h, i) => (
          <span key={h} className={`py-1 ${i === 6 ? 'text-rose-400' : ''}`}>
            {h}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {sel.map((d, i) => {
          if (d === null) return <span key={'kosong' + i} />
          const tgl = iso(d)
          const rec = perTanggal.get(tgl)
          const hariIni = tgl === hariIniIso
          const libur = detailLibur(tgl) || petaLibur.get(tgl)
          const akhirPekan = i % 7 === 6 // kolom terakhir = Minggu
          const merah = !!libur || akhirPekan
          const keterangan = [
            rec ? `${rec.status}${rec.checkIn && rec.checkIn !== '-' ? ` ${rec.checkIn}` : ''}` : null,
            libur ? libur.nama : null,
          ]
            .filter(Boolean)
            .join(' — ')
          return (
            <button
              type="button"
              key={tgl}
              onClick={() => rec && onSelect?.(rec)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-semibold ${
                rec
                  ? 'cursor-pointer bg-slate-100 transition hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-slate-700'
                  : ''
              } ${hariIni ? 'ring-2 ring-indigo-500' : ''} ${merah ? 'text-rose-500 dark:text-rose-400' : ''}`}
              title={`${d} ${bulanIndo[bulan]} ${tahun}${keterangan ? ` — ${keterangan}` : ''}`}
            >
              {d}
              <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${rec && WARNA_TITIK[rec.status] ? WARNA_TITIK[rec.status] : 'bg-transparent'}`} />
              {/* Penanda libur: titik merah = nasional, oranye bercincin = cuti bersama, indigo = khusus admin */}
              {libur && (
                <span
                  className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${
                    libur.jenis === 'cuti'
                      ? 'bg-orange-400 ring-1 ring-orange-200 dark:ring-orange-500/40'
                      : libur.jenis === 'admin'
                        ? 'bg-indigo-500'
                        : 'bg-rose-500'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-medium text-slate-400">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Hadir</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-500" /> Terlambat</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-sky-500" /> Izin</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-500" /> Alpha</span>
        <span className="flex items-center gap-1 text-rose-500 dark:text-rose-400">
          <i className="h-2 w-2 rounded-full bg-rose-500" /> Libur nasional
        </span>
        <span className="flex items-center gap-1 text-orange-500 dark:text-orange-400">
          <i className="h-2 w-2 rounded-full bg-orange-400" /> Cuti bersama
        </span>
        <span className="flex items-center gap-1 text-indigo-500 dark:text-indigo-400">
          <i className="h-2 w-2 rounded-full bg-indigo-500" /> Libur khusus
        </span>
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-400">
        Merah = Minggu / libur nasional. Pekan dimulai <b>Senin</b>. Ketuk tanggal bertitik untuk detail kehadiran.
      </p>
    </div>
  )
}

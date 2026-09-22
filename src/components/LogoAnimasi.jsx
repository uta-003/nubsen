// ============ Logo animasi NUBSEN — bersih, TANPA border/cincin/stroke ============
// Dipakai bersama oleh splash, header aplikasi, dan halaman login: hanya glow
// cahaya lembut di belakang logo + logo yang mengambang. Tidak ada cincin,
// ring, titik orbit, atau shadow gelap apapun di sekeliling logo.
//
// PENTING (bentuk logo): berkas /logo-icon.png berbentuk SQUIRCLE (kotak
// membulat) dengan sudut transparan. Sebelumnya gambar dipaksa `rounded-full`
// sehingga bentuk aslinya terpotong menjadi lingkaran ("buletan"). Kini tidak
// ada pemotongan bentuk sama sekali — hanya logo yang tampil apa adanya.
const UKURAN = {
  sm: { wrap: 'h-10 w-10', gambar: 'h-8 w-8' },
  md: { wrap: 'h-16 w-16', gambar: 'h-14 w-14' },
  lg: { wrap: 'h-28 w-28', gambar: 'h-24 w-24' },
  xl: { wrap: 'h-40 w-40', gambar: 'h-32 w-32' },
}

export default function LogoAnimasi({
  ukuran = 'md',
  kelas = '',
  src = '/logo-icon.png',
  alt = 'Logo NUBSEN',
  tanpaCahaya = false,
}) {
  const u = UKURAN[ukuran] || UKURAN.md
  return (
    <span className={`logo-wrap relative inline-grid shrink-0 place-items-center ${u.wrap} ${kelas}`}>
      {/* Cahaya radial lembut di belakang logo — glow, bukan border.
          Bisa dimatikan (tanpaCahaya) agar benar-benar hanya logo yang tampil. */}
      {!tanpaCahaya && <span aria-hidden className="logo-cahaya pointer-events-none absolute inset-1 rounded-full" />}
      {/* Logo apa adanya: TANPA rounded-full / cincin / border apapun. */}
      <img
        src={src}
        alt={alt}
        className={`logo-melayang relative z-10 object-contain ${u.gambar}`}
      />
    </span>
  )
}


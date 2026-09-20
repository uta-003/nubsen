// ============ Logo animasi NUBSEN — bersih, TANPA border/cincin/stroke ============
// Dipakai bersama oleh splash, header aplikasi, dan halaman login: hanya glow
// cahaya lembut di belakang logo + logo yang mengambang. Tidak ada cincin,
// ring, titik orbit, atau shadow gelap apapun di sekeliling logo.
const UKURAN = {
  sm: { wrap: 'h-10 w-10', gambar: 'h-7 w-7' },
  md: { wrap: 'h-16 w-16', gambar: 'h-12 w-12' },
  lg: { wrap: 'h-28 w-28', gambar: 'h-20 w-20' },
  xl: { wrap: 'h-40 w-40', gambar: 'h-28 w-28' },
}

export default function LogoAnimasi({ ukuran = 'md', kelas = '', src = '/logo-icon.png', alt = 'Logo NUBSEN' }) {
  const u = UKURAN[ukuran] || UKURAN.md
  return (
    <span className={`logo-wrap relative inline-grid shrink-0 place-items-center ${u.wrap} ${kelas}`}>
      {/* Cahaya radial lembut di belakang logo — glow, bukan border */}
      <span aria-hidden className="logo-cahaya pointer-events-none absolute inset-1 rounded-full" />
      {/* Logo mengambang — TANPA cincin/border apapun: hanya glow cahaya lembut
          di belakang (elemen logo-cahaya) dan animasi melayang pada gambarnya. */}
      <img
        src={src}
        alt={alt}
        className={`logo-melayang relative z-10 rounded-full object-contain ${u.gambar}`}
      />
    </span>
  )
}

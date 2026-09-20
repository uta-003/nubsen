// ============ Logo animasi NUBSEN (melingkar — TANPA kotak) ============
// Dipakai bersama oleh splash, header aplikasi, dan halaman login supaya animasi
// logo seragam: halo gradasi berputar, gelombang sonar mengembang, cahaya lembut,
// titik orbit, dan logo yang mengambang dengan pendar biru (drop-shadow, bukan
// box-shadow — jadi tidak pernah tampil seperti kotak).
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
      {/* Gelombang sonar (dua lingkaran, bergantian) */}
      <span aria-hidden className="logo-sonar pointer-events-none absolute inset-0 rounded-full" />
      <span aria-hidden className="logo-sonar logo-sonar-2 pointer-events-none absolute inset-0 rounded-full" />
      {/* Cincin halo gradasi yang berputar pelan */}
      <span aria-hidden className="logo-halo pointer-events-none absolute inset-0 rounded-full" />
      {/* Cahaya radial lembut di belakang logo */}
      <span aria-hidden className="logo-cahaya pointer-events-none absolute inset-1 rounded-full" />
      {/* Titik orbit mengelilingi logo */}
      <span aria-hidden className="logo-orbit pointer-events-none absolute inset-0">
        <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-indigo-500/80 shadow-[0_0_10px_2px_rgba(99,102,241,0.45)]" />
      </span>
      {/* Logo mengambang — pendar memakai drop-shadow agar bentuknya membulat */}
      <img
        src={src}
        alt={alt}
        className={`logo-melayang relative z-10 rounded-[26%] object-contain ${u.gambar}`}
      />
    </span>
  )
}

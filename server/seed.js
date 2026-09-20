import { db, hashPin, hariKerjaAktif } from './db.js'
import { toISODate } from './utils/waktu.js'

// Seed data demo — aman dijalankan berulang (INSERT hanya bila belum ada).
export async function seedIfEmpty() {
  await seedKaryawan()
  await seedRiwayat()
  await seedPeriodeGaji()
  await seedHariLibur()
}

// Hari libur nasional & cuti bersama INDONESIA 2026 (rilis resmi Kemenko PMK) —
// sama dengan daftar pada aplikasi web (src/utils/liburIndonesia.js). Insert OR
// IGNORE: tambahan libur milik admin tidak pernah tertimpa saat boot ulang.
async function seedHariLibur() {
  const LIBUR_2026 = [
    ['2026-01-01', 'Tahun Baru Masehi'],
    ['2026-01-16', 'Isra Mikraj Nabi Muhammad SAW'],
    ['2026-02-16', 'Cuti Bersama Tahun Baru Imlek'],
    ['2026-02-17', 'Tahun Baru Imlek 2577 Kongzili'],
    ['2026-03-18', 'Cuti Bersama Hari Suci Nyepi'],
    ['2026-03-19', 'Hari Suci Nyepi (Tahun Baru Saka 1948)'],
    ['2026-03-20', 'Cuti Bersama Idul Fitri 1447 H'],
    ['2026-03-21', 'Idul Fitri 1447 H'],
    ['2026-03-22', 'Idul Fitri 1447 H (hari kedua)'],
    ['2026-03-23', 'Cuti Bersama Idul Fitri 1447 H'],
    ['2026-03-24', 'Cuti Bersama Idul Fitri 1447 H'],
    ['2026-04-03', 'Wafat Isa Almasih (Jumat Agung)'],
    ['2026-04-05', 'Kebangkitan Isa Almasih (Paskah)'],
    ['2026-05-01', 'Hari Buruh Internasional'],
    ['2026-05-14', 'Kenaikan Isa Almasih'],
    ['2026-05-15', 'Cuti Bersama Kenaikan Isa Almasih'],
    ['2026-05-27', 'Idul Adha 1447 H'],
    ['2026-05-28', 'Cuti Bersama Idul Adha 1447 H'],
    ['2026-05-31', 'Hari Raya Waisak 2570 BE'],
    ['2026-06-01', 'Hari Lahir Pancasila'],
    ['2026-06-16', 'Tahun Baru Islam 1448 H'],
    ['2026-08-17', 'Hari Kemerdekaan Republik Indonesia'],
    ['2026-08-25', 'Maulid Nabi Muhammad SAW'],
    ['2026-12-24', 'Cuti Bersama Natal'],
    ['2026-12-25', 'Kelahiran Isa Almasih (Natal)'],
  ]
  const sudah = await db.get(
    "SELECT COUNT(*) AS n FROM holidays WHERE sumber = 'resmi'",
  )
  if ((sudah?.n ?? 0) >= LIBUR_2026.length) return
  for (const [tanggal, nama] of LIBUR_2026) {
    await db.run(
      `INSERT INTO holidays (tanggal, nama, sumber) VALUES (?, ?, 'resmi')
       ON CONFLICT (tanggal) DO NOTHING`,
      [tanggal, nama],
    )
  }
  console.log('🌱 Seed: hari libur nasional & cuti bersama 2026 siap.')
}

// Periode penggajian demo (bulan berjalan) supaya slip gaji di aplikasi karyawan
// langsung ada isinya pada instalasi baru. Admin dapat menggantinya di tab Gaji.
async function seedPeriodeGaji() {
  const ada = await db.get('SELECT id FROM payroll_periods LIMIT 1')
  if (ada) return
  const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const hariIni = toISODate()
  const d = new Date(`${hariIni}T00:00:00Z`)
  const nama = `Gaji ${NAMA_BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  await db.run(
    'INSERT INTO payroll_periods (nama, dari, sampai, aktif) VALUES (?, ?, ?, 1)',
    [nama, `${hariIni.slice(0, 7)}-01`, hariIni],
  )
  console.log(`🌱 Seed: periode penggajian "${nama}" ditetapkan (aktif).`)
}

async function seedKaryawan() {
  const admin = await db.get('SELECT id FROM employees WHERE id = ?', [1])

  if (!admin) {
    await db.run(
      `INSERT INTO employees (id, nama, nip, jabatan, departemen, email, telepon, lokasi_kerja, cuti_tahunan, is_admin, pin_hash, gaji_harian, uang_makan, tarif_lembur, status_karyawan)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, 12, 1, ?, ?, ?, ?, ?)`,
      [
        'Afriani Putri',
        'EMP-2024-0187',
        'Frontend Developer',
        'Teknologi Informasi',
        'afriani.putri@perusahaan.co.id',
        '+62 812-3456-7890',
        'Kantor Pusat — Kelapa Gading, Jakarta Utara',
        hashPin('123456'),
        // Tarif demo untuk penghitung gaji (Rp).
        180000, 25000, 30000,
        'Karyawan Tetap',
      ],
    )
    // Notifikasi sambutan untuk akun baru.
    await db.run(
      `INSERT INTO notifications (employee_id, judul, pesan, jenis) VALUES (1, ?, ?, ?)`,
      [
        'Selamat datang di NUBSEN 👋',
        'Fitur lembur, notifikasi, kalender, dan pengingat sudah aktif. Selamat bekerja!',
        'info',
      ],
    )
  }

  // Pastikan akun #1 selalu admin (termasuk database lama).
  await db.run('UPDATE employees SET is_admin = 1 WHERE id = 1')

  // Karyawan kedua untuk demo multi-akun.
  const budi = await db.get('SELECT id FROM employees WHERE id = ?', [2])
  if (!budi) {
    await db.run(
      `INSERT INTO employees (id, nama, nip, jabatan, departemen, email, telepon, lokasi_kerja, cuti_tahunan, is_admin, pin_hash, gaji_harian, uang_makan, tarif_lembur, status_karyawan)
       VALUES (2, ?, ?, ?, ?, ?, ?, ?, 12, 0, ?, ?, ?, ?, ?)`,
      [
        'Budi Santoso',
        'EMP-2024-0203',
        'Backend Developer',
        'Teknologi Informasi',
        'budi.santoso@perusahaan.co.id',
        '+62 813-2222-3333',
        'Kantor Pusat — Kelapa Gading, Jakarta Utara',
        hashPin('654321'),
        // Tarif demo untuk penghitung gaji (Rp).
        150000, 20000, 25000,
        'Karyawan Kontrak',
      ],
    )
  }
  console.log('🌱 Seed: karyawan demo siap — Afriani (PIN 123456) & Budi (PIN 654321).')
}

async function seedRiwayat() {
  const jumlah = (await db.get('SELECT COUNT(*) AS n FROM attendance'))?.n ?? 0
  if (jumlah > 0) return

  // Riwayat contoh 14 hari ke belakang — hanya pada HARI KERJA sesuai pengaturan
  // jadwal (default Senin–Jumat), supaya data demo konsisten dengan laporan.
  const hariAktif = new Set(await hariKerjaAktif())
  const contoh = ['Hadir', 'Hadir', 'Terlambat', 'Hadir', 'Izin', 'Hadir', 'Alpha', 'Hadir', 'Hadir', 'Terlambat']
  const hariIni = new Date()
  let idx = 0
  for (let i = 1; i <= 14; i++) {
    const d = new Date(hariIni)
    d.setDate(d.getDate() - i)
    if (!hariAktif.has(d.getDay())) continue
    const status = contoh[(i * 3) % contoh.length]
    const checkIn = status === 'Hadir' ? `07:5${(i * 7) % 9}` : status === 'Terlambat' ? `09:0${i % 9}` : '-'
    const checkOut = status === 'Hadir' || status === 'Terlambat' ? `17:0${(i * 5) % 9}` : '-'
    const keterangan =
      status === 'Izin' ? 'Izin keperluan keluarga' : status === 'Alpha' ? 'Tanpa keterangan' : ''
    await db.run(
      `INSERT INTO attendance (tanggal, check_in, check_out, status, keterangan) VALUES (?, ?, ?, ?, ?)`,
      [toISODate(d), checkIn, checkOut, status, keterangan],
    )
    idx++
  }
  console.log(`🌱 Seed: ${idx} riwayat absensi contoh dimasukkan.`)
}

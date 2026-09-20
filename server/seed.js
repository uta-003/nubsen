import { db, hashPin, hariKerjaAktif } from './db.js'
import { toISODate } from './utils/waktu.js'

// Seed data demo — aman dijalankan berulang (INSERT hanya bila belum ada).
export async function seedIfEmpty() {
  await seedKaryawan()
  await seedRiwayat()
}

async function seedKaryawan() {
  const admin = await db.get('SELECT id FROM employees WHERE id = ?', [1])

  if (!admin) {
    await db.run(
      `INSERT INTO employees (id, nama, nip, jabatan, departemen, email, telepon, lokasi_kerja, cuti_tahunan, is_admin, pin_hash, gaji_harian, uang_makan, tarif_lembur)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, 12, 1, ?, ?, ?, ?)`,
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
      `INSERT INTO employees (id, nama, nip, jabatan, departemen, email, telepon, lokasi_kerja, cuti_tahunan, is_admin, pin_hash, gaji_harian, uang_makan, tarif_lembur)
       VALUES (2, ?, ?, ?, ?, ?, ?, ?, 12, 0, ?, ?, ?, ?)`,
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

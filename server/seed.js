import { db, hashPin } from './db.js'
import { toISODate } from './utils/waktu.js'

// Seed data demo — aman dijalankan berulang (INSERT hanya bila belum ada).
export function seedIfEmpty() {
  seedKaryawan()
  seedRiwayat()
}

function seedKaryawan() {
  const sudahAda = db.prepare('SELECT id FROM employees WHERE id = ?')

  if (!sudahAda.get(1)) {
    db.prepare(
      `INSERT INTO employees (id, nama, nip, jabatan, departemen, email, telepon, lokasi_kerja, cuti_tahunan, is_admin, pin_hash)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, 12, 1, ?)`,
    ).run(
      'Afriani Putri',
      'EMP-2024-0187',
      'Frontend Developer',
      'Teknologi Informasi',
      'afriani.putri@perusahaan.co.id',
      '+62 812-3456-7890',
      'Kantor Pusat — Kelapa Gading, Jakarta Utara',
      hashPin('123456'),
    )
    // Notifikasi sambutan untuk akun baru.
    db.prepare(
      `INSERT INTO notifications (employee_id, judul, pesan, jenis)
       VALUES (1, 'Selamat datang di NUBSEN 👋', 'Fitur lembur, notifikasi, kalender, dan pengingat sudah aktif. Selamat bekerja!', 'info')`,
    ).run()
  }

  // Pastikan akun #1 selalu admin (termasuk database lama).
  db.prepare('UPDATE employees SET is_admin = 1 WHERE id = 1').run()

  // Karyawan kedua untuk demo multi-akun.
  if (!sudahAda.get(2)) {
    db.prepare(
      `INSERT INTO employees (id, nama, nip, jabatan, departemen, email, telepon, lokasi_kerja, cuti_tahunan, is_admin, pin_hash)
       VALUES (2, ?, ?, ?, ?, ?, ?, ?, 12, 0, ?)`,
    ).run(
      'Budi Santoso',
      'EMP-2024-0203',
      'Backend Developer',
      'Teknologi Informasi',
      'budi.santoso@perusahaan.co.id',
      '+62 813-2222-3333',
      'Kantor Pusat — Kelapa Gading, Jakarta Utara',
      hashPin('654321'),
    )
  }
  console.log('🌱 Seed: karyawan demo siap — Afriani (PIN 123456) & Budi (PIN 654321).')
}

function seedRiwayat() {
  const jumlah = db.prepare('SELECT COUNT(*) AS n FROM attendance').get().n
  if (jumlah > 0) return

  // Riwayat contoh 14 hari ke belakang (skip hari Minggu).
  const contoh = ['Hadir', 'Hadir', 'Terlambat', 'Hadir', 'Izin', 'Hadir', 'Alpha', 'Hadir', 'Hadir', 'Terlambat']
  const insert = db.prepare(
    `INSERT INTO attendance (tanggal, check_in, check_out, status, keterangan)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const hariIni = new Date()
  let idx = 0
  for (let i = 1; i <= 14; i++) {
    const d = new Date(hariIni)
    d.setDate(d.getDate() - i)
    if (d.getDay() === 0) continue
    const status = contoh[(i * 3) % contoh.length]
    const checkIn = status === 'Hadir' ? `07:5${(i * 7) % 9}` : status === 'Terlambat' ? `09:0${i % 9}` : '-'
    const checkOut = status === 'Hadir' || status === 'Terlambat' ? `17:0${(i * 5) % 9}` : '-'
    const keterangan =
      status === 'Izin' ? 'Izin keperluan keluarga' : status === 'Alpha' ? 'Tanpa keterangan' : ''
    insert.run(toISODate(d), checkIn, checkOut, status, keterangan)
    idx++
  }
  console.log(`🌱 Seed: ${idx} riwayat absensi contoh dimasukkan.`)
}

import crypto from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SKEMA } from './schema.js'
import { muatEnv } from './utils/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Muat .env (bila ada) SEBELUM memilih driver database. Di hosting (Vercel)
// berkas .env tidak ada dan variabel datang dari platform — aman diabaikan.
muatEnv()

// ============================================================================
//  DRIVER DATABASE — dipilih otomatis dari variabel lingkungan
//
//    TURSO_DATABASE_URL = libsql://nubsen-xxxx.turso.io
//      -> database Turso (libSQL) memakai @libsql/client/web: fetch murni,
//         TANPA dependensi native, wajib untuk serverless (Vercel Function).
//
//    TURSO_DATABASE_URL kosong
//      -> berkas SQLite lokal memakai node:sqlite bawaan Node.js
//         (pengembangan offline, tanpa dependensi tambahan).
//
//  Seluruh API bersifat async: await db.get(sql, [params]) dst.
// ============================================================================
export const URL_TURSO = (process.env.TURSO_DATABASE_URL || '').trim()
const TOKEN_TURSO = (process.env.TURSO_AUTH_TOKEN || '').trim()
export const modeTurso = /^(libsql|https|wss):/i.test(URL_TURSO)
export const modeDatabase = modeTurso ? 'turso' : 'sqlite-lokal'

// Skema database (source of truth) — modul JS agar ikut ter-bundle pada
// deployment serverless. Lihat server/schema.js.

// Bobot BigInt dari libSQL → number (aman untuk id & jumlah baris).
const keAngka = (v) => (v == null ? 0 : Number(v))

// ---------- Driver 1: node:sqlite (SQLite lokal, sinkron) ----------
function driverLokal() {
  let muat = null
  const siapkan = () => {
    if (!muat) {
      muat = (async () => {
        const { DatabaseSync } = await import('node:sqlite') // bawaan Node >= 22.5
        // Folder data dapat dipindah lewat env DATA_DIR.
        const dataDir = process.env.DATA_DIR
          ? path.resolve(process.env.DATA_DIR)
          : path.join(__dirname, 'data')
        mkdirSync(dataDir, { recursive: true })
        const raw = new DatabaseSync(path.join(dataDir, 'absensi.db'))
        raw.exec('PRAGMA journal_mode = WAL;')
        return raw
      })()
    }
    return muat
  }
  return {
    nama: 'sqlite-lokal',
    async exec(sql) { (await siapkan()).exec(sql) },
    async all(sql, params = []) { return (await siapkan()).prepare(sql).all(...params) },
    async get(sql, params = []) { return (await siapkan()).prepare(sql).get(...params) ?? null },
    async run(sql, params = []) {
      const r = (await siapkan()).prepare(sql).run(...params)
      return { changes: keAngka(r.changes), lastInsertRowid: keAngka(r.lastInsertRowid) }
    },
  }
}

// ---------- Driver 2: Turso / libSQL (jaringan, async) ----------
function driverTurso(url, authToken) {
  let muat = null
  const siapkan = () => {
    if (!muat) {
      muat = (async () => {
        // Subpath /web = implementasi fetch murni (tanpa biner native) —
        // aman pada Vercel Function, Cloudflare, maupun Deno.
        const { createClient } = await import('@libsql/client/web')
        return createClient({ url, authToken })
      })()
    }
    return muat
  }

  // libSQL mengembalikan rows sebagai objek {kolom: nilai}; diseragamkan agar
  // bentuknya identik dengan node:sqlite (objek biasa, bukan array-values).
  const baris = (hasil) => {
    const kolom = hasil.columns || []
    return (hasil.rows || []).map((row) => {
      if (row && typeof row === 'object' && !Array.isArray(row)) return { ...row }
      const o = {}
      kolom.forEach((c, i) => { o[c] = row[i] })
      return o
    })
  }

  const jalankan = async (sql, params) => {
    const client = await siapkan()
    return client.execute({ sql, args: params ?? [] })
  }

  return {
    nama: 'turso',
    async exec(sql) { await (await siapkan()).executeMultiple(sql) },
    async all(sql, params = []) { return baris(await jalankan(sql, params)) },
    async get(sql, params = []) { return baris(await jalankan(sql, params))[0] ?? null },
    async run(sql, params = []) {
      const hasil = await jalankan(sql, params)
      return { changes: keAngka(hasil.rowsAffected), lastInsertRowid: keAngka(hasil.lastInsertRowid) }
    },
  }
}

const driver = modeTurso ? driverTurso(URL_TURSO, TOKEN_TURSO) : driverLokal()

// ---------- Inisialisasi sekali per proses (aman untuk cold start) ----------
// Urutan: buat skema -> tambah kolom baru pada database lama -> isi PIN default.
// Kegagalan ALTER TABLE diabaikan (kolom sudah ada) = pola migrasi ringan.
const KOLOM_TAMBAHAN = [
  ['employees', 'cuti_tahunan INTEGER DEFAULT 12'],
  ['employees', 'pin_hash TEXT'],
  ['employees', 'is_admin INTEGER DEFAULT 0'],
  ['attendance', 'di_luar_area INTEGER'],
  ['attendance', 'jarak INTEGER'],
  ['attendance', 'selfie TEXT'],
  ['attendance', 'hari_libur INTEGER'],
  // Data absen pulang terpisah (foto + lokasi pulang tidak menimpa data masuk)
  ['attendance', 'lat_out REAL'],
  ['attendance', 'lon_out REAL'],
  ['attendance', 'alamat_out TEXT'],
  ['attendance', 'selfie_out TEXT'],
  ['attendance', 'di_luar_area_out INTEGER'],
  ['attendance', 'jarak_out INTEGER'],
  ['notifications', 'grup_id TEXT'],
  // Penghitung gaji per karyawan (Rp): gaji harian, uang makan per hari hadir,
  // tarif lembur per jam — diisi admin pada tab Karyawan / Gaji.
  ['employees', 'gaji_harian REAL DEFAULT 0'],
  ['employees', 'uang_makan REAL DEFAULT 0'],
  ['employees', 'tarif_lembur REAL DEFAULT 0'],
  // Alasan penolakan izin/lembur — ikut terkirim dalam notifikasi karyawan.
  ['leaves', "alasan_tolak TEXT DEFAULT ''"],
  ['overtime', "alasan_tolak TEXT DEFAULT ''"],
  // Status kepegawaian (Karyawan Tetap / Karyawan Kontrak) pada form Karyawan.
  ['employees', "status_karyawan TEXT DEFAULT 'Karyawan Tetap'"],
  // Nomor surat resmi pada surat peringatan & pemecatan.
  ['warnings', 'nomor TEXT'],
]

let janjiInit = null
export function dbSiap() {
  if (!janjiInit) {
    janjiInit = (async () => {
      await driver.exec(SKEMA)
      for (const [tabel, kolom] of KOLOM_TAMBAHAN) {
        try {
          await driver.exec(`ALTER TABLE ${tabel} ADD COLUMN ${kolom}`)
        } catch { /* kolom sudah ada — aman diabaikan */ }
      }
      // Database lama tanpa PIN: set PIN default 123456 agar tetap bisa login.
      try {
        await driver.run('UPDATE employees SET pin_hash = ? WHERE pin_hash IS NULL', [hashPin('123456')])
      } catch { /* tabel belum ada pada DB sangat lama */ }
      // Migrasi alamat: perbarui lokasi kerja lama tanpa menimpa edit admin.
      try {
        await driver.run(
          "UPDATE employees SET lokasi_kerja = ? WHERE lokasi_kerja = 'Kantor Pusat — Jakarta'",
          ['Kantor Pusat — Kelapa Gading, Jakarta Utara'],
        )
      } catch { /* kolom belum ada */ }
      // Database lama: isi status kepegawaian yang belum diatur.
      try {
        await driver.run(
          "UPDATE employees SET status_karyawan = 'Karyawan Tetap' WHERE status_karyawan IS NULL OR TRIM(status_karyawan) = ''",
        )
      } catch { /* kolom belum ada */ }
      // Instalasi lama (dibuat sebelum fitur penghitung gaji) bisa punya tarif 0
      // untuk dua akun demo. Isi nilai demo HANYA bila ketiganya masih kosong —
      // angka yang sudah diatur admin tidak pernah ditimpa.
      try {
        for (const [email, gaji, makan, lembur] of [
          ['afriani.putri@perusahaan.co.id', 180000, 25000, 30000],
          ['budi.santoso@perusahaan.co.id', 150000, 20000, 25000],
        ]) {
          await driver.run(
            `UPDATE employees SET gaji_harian = ?, uang_makan = ?, tarif_lembur = ?
             WHERE email = ? AND COALESCE(gaji_harian, 0) = 0 AND COALESCE(uang_makan, 0) = 0 AND COALESCE(tarif_lembur, 0) = 0`,
            [gaji, makan, lembur, email],
          )
        }
      } catch { /* kolom belum ada */ }
      return driver
    })().catch((err) => {
      janjiInit = null // biarkan percobaan berikutnya mengulang init
      throw err
    })
  }
  return janjiInit
}

// ---------- API database yang dipakai seluruh aplikasi ----------
// Bentuk pemanggilan sengaja mirip better-sqlite3 agar kode model mudah dibaca:
//   await db.get(sql, [params]) | db.all(...) | db.run(...) | db.exec(sql)
export const db = {
  mode: driver.nama,
  exec: async (sql) => { await dbSiap(); return driver.exec(sql) },
  all: async (sql, params = []) => { await dbSiap(); return driver.all(sql, params) },
  get: async (sql, params = []) => { await dbSiap(); return driver.get(sql, params) },
  run: async (sql, params = []) => { await dbSiap(); return driver.run(sql, params) },
  /** Jalankan beberapa pernyataan tulis secara berurutan. */
  async urut(daftar) {
    await dbSiap()
    const hasil = []
    for (const [sql, params] of daftar) hasil.push(await driver.run(sql, params))
    return hasil
  },
}

// Hash PIN (SHA-256) — cukup untuk demo; produksi sebaiknya bcrypt/argon2.
export function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex')
}

// Lokasi kantor pusat untuk validasi geofence (radius dalam meter).
export const KANTOR = {
  nama: 'Kantor Pusat',
  alamat: 'Kelapa Gading - Jakarta Utara',
  lat: -6.1765782,
  lon: 106.899041,
  radiusM: 20,
}

// Batas jam masuk & jam pulang — DINAMIS dari tabel settings (diubah admin).
export const JAM_MASUK_BATAS = '08:15' // default; sumber kebenaran = getJadwal()
export const JAM_PULANG_DEFAULT = '17:00'
// Hari kerja mingguan (0 = Minggu … 6 = Sabtu). Default Senin–Jumat; perusahaan
// yang bekerja 6 hari dapat menambah Sabtu pada tab Jadwal di panel admin.
// Dipakai untuk menghitung hari kerja pada laporan kehadiran & data demo.
export const HARI_KERJA_DEFAULT = [1, 2, 3, 4, 5]

export async function getSetting(key, def) {
  const row = await db.get('SELECT value FROM settings WHERE key = ?', [key])
  return row?.value ?? def
}

export async function setSetting(key, value) {
  await db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value)],
  )
}

// Daftar hari kerja aktif (angka 0 = Minggu … 6 = Sabtu) dari setting `hariKerja`.
// Tersimpan sebagai teks, contoh: "1,2,3,4,5" (Senin–Jumat).
export async function hariKerjaAktif() {
  const mentah = await getSetting('hariKerja', HARI_KERJA_DEFAULT.join(','))
  const hari = String(mentah)
    .split(',')
    .map((n) => Number(String(n).trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  return [...new Set(hari)].sort((a, b) => a - b)
}

// Jadwal kerja aktif (jam masuk batas + jam pulang + hari kerja) — dipakai status
// Terlambat, hitungan mundur pada UI, laporan kehadiran, dan data demo.
export async function getJadwal() {
  return {
    jamMasukBatas: await getSetting('jamMasukBatas', JAM_MASUK_BATAS),
    jamPulang: await getSetting('jamPulang', JAM_PULANG_DEFAULT),
    hariKerja: await hariKerjaAktif(),
  }
}

// Identitas perusahaan — dipakai KOP surat peringatan/pemecatan & dokumen lain.
// Diubah admin (Panel → Jadwal → Identitas Perusahaan).
export async function getPerusahaan() {
  return {
    nama: await getSetting('perusahaanNama', 'PT Nubsen Indonesia'),
    alamat: await getSetting('perusahaanAlamat', 'Kelapa Gading, Jakarta Utara'),
  }
}


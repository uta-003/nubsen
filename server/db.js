import crypto from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Folder data dapat dipindah lewat env DATA_DIR — dipakai saat hosting
// (mis. Render: /var/data/db pada persistent disk agar data tidak hilang).
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data')
mkdirSync(dataDir, { recursive: true })

// Database SQLite bawaan Node.js (node:sqlite) — tanpa dependensi native.
export const db = new DatabaseSync(path.join(dataDir, 'absensi.db'))

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS employees (
    id          INTEGER PRIMARY KEY,
    nama        TEXT NOT NULL,
    nip         TEXT UNIQUE,
    jabatan     TEXT,
    departemen  TEXT,
    email       TEXT,
    telepon     TEXT,
    lokasi_kerja TEXT,
    cuti_tahunan INTEGER DEFAULT 12,
    pin_hash     TEXT,
    is_admin     INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS overtime (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    tanggal     TEXT NOT NULL,
    jam_mulai   TEXT NOT NULL,
    jam_selesai TEXT NOT NULL,
    keterangan  TEXT DEFAULT '',
    status      TEXT DEFAULT 'Menunggu',
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,                       -- penerima; pengumuman = 1 baris per karyawan (fan-out)
    judul       TEXT NOT NULL,
    pesan       TEXT DEFAULT '',
    jenis       TEXT DEFAULT 'info',           -- info / pengumuman / penting / lembur / izin / absensi
    grup_id     TEXT,                          -- pengikat baris pengumuman yang sama
    dibaca      INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL DEFAULT 1,
    tanggal     TEXT NOT NULL,             -- YYYY-MM-DD
    check_in    TEXT,                      -- HH:MM
    check_out   TEXT,                      -- HH:MM
    status      TEXT NOT NULL DEFAULT 'Belum Absen',
    keterangan  TEXT DEFAULT '',
    lat         REAL,
    lon         REAL,
    alamat      TEXT,
    selfie      TEXT,                      -- path /uploads/selfie-xxx.jpg
    di_luar_area INTEGER,                  -- 1 = absen di luar radius kantor
    jarak       INTEGER,                   -- jarak (meter) dari kantor
    created_at  TEXT DEFAULT (datetime('now')),
    UNIQUE (employee_id, tanggal)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS leaves (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL DEFAULT 1,
    jenis       TEXT NOT NULL,             -- Izin / Sakit / Cuti Tahunan / Cuti Khusus
    mulai       TEXT NOT NULL,             -- YYYY-MM-DD
    selesai     TEXT NOT NULL,             -- YYYY-MM-DD
    keterangan  TEXT DEFAULT '',
    lampiran    TEXT,                      -- path /uploads/izin-xxx.ext
    status      TEXT DEFAULT 'Menunggu',
    created_at  TEXT DEFAULT (datetime('now'))
  );
`)

// Migrasi ringan: tambah kolom untuk database lama (abaikan bila sudah ada).
for (const [tabel, kolom] of [
  ['employees', 'cuti_tahunan INTEGER DEFAULT 12'],
  ['employees', 'pin_hash TEXT'],
  ['employees', 'is_admin INTEGER DEFAULT 0'],
  ['attendance', 'di_luar_area INTEGER'],
  ['attendance', 'jarak INTEGER'],
  ['notifications', 'grup_id TEXT'],
]) {
  try {
    db.exec(`ALTER TABLE ${tabel} ADD COLUMN ${kolom}`)
  } catch {
    /* kolom sudah ada — aman diabaikan */
  }
}

// Database lama tanpa PIN: set PIN default 123456 agar tetap bisa login.
db.prepare('UPDATE employees SET pin_hash = ? WHERE pin_hash IS NULL').run(hashPin('123456'))

// Lokasi kantor pusat untuk validasi geofence (radius dalam meter).
export const KANTOR = {
  nama: 'Kantor Pusat',
  alamat: 'Kelapa Gading - Jakarta Utara',
  lat: -6.1765782,
  lon: 106.899041,
  radiusM: 20,
}

// Migrasi alamat: perbarui lokasi kerja lama tanpa menimpa edit manual admin.
try {
  db.prepare(
    "UPDATE employees SET lokasi_kerja = ? WHERE lokasi_kerja = 'Kantor Pusat — Jakarta'",
  ).run('Kantor Pusat — Kelapa Gading, Jakarta Utara')
} catch { /* kolom belum ada pada DB sangat lama */ }

// Hash PIN (SHA-256) — cukup untuk demo; produksi pakai bcrypt/argon2.
export function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex')
}

// Batas jam masuk & jam pulang — KINI DINAMIS dari tabel settings (dapat diubah admin).
export const JAM_MASUK_BATAS = '08:15' // fallback/default; sumber kebenaran = getJadwal()
export const JAM_PULANG_DEFAULT = '17:00'

export function getSetting(key, def) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row?.value ?? def
}

export function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, String(value))
}

// Jadwal kerja aktif (jam masuk batas + jam pulang) — dipakai status Terlambat & UI countdown.
export function getJadwal() {
  return {
    jamMasukBatas: getSetting('jamMasukBatas', JAM_MASUK_BATAS),
    jamPulang: getSetting('jamPulang', JAM_PULANG_DEFAULT),
  }
}

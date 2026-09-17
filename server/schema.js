// ============================================================================
//  Skema database NUBSEN (SQLite / libSQL-Turso) — SATU SUMBER KEBENARAN.
//
//  Sengaja disimpan sebagai modul JavaScript (bukan berkas .sql) agar ikut
//  ter-bundle otomatis pada deployment serverless: Vercel hanya menelusuri
//  impor modul, sedangkan berkas yang dibaca saat runtime (readFileSync) tidak
//  ikut dikirim sehingga aplikasi gagal start.
//
//  Dipakai oleh:
//    * server/db.js             -> dijalankan otomatis saat server menyala
//    * scripts/turso-setup.mjs  -> membuat seluruh tabel di Turso + seed demo
// ============================================================================
export const SKEMA = `
CREATE TABLE IF NOT EXISTS employees (
  id           INTEGER PRIMARY KEY,
  nama         TEXT NOT NULL,
  nip          TEXT UNIQUE,
  jabatan      TEXT,
  departemen   TEXT,
  email        TEXT,
  telepon      TEXT,
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
  employee_id INTEGER,
  judul       TEXT NOT NULL,
  pesan       TEXT DEFAULT '',
  jenis       TEXT DEFAULT 'info',
  grup_id     TEXT,
  dibaca      INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id  INTEGER NOT NULL DEFAULT 1,
  tanggal      TEXT NOT NULL,
  check_in     TEXT,
  check_out    TEXT,
  status       TEXT NOT NULL DEFAULT 'Belum Absen',
  keterangan   TEXT DEFAULT '',
  lat          REAL,
  lon          REAL,
  alamat       TEXT,
  selfie       TEXT,
  di_luar_area INTEGER,
  jarak        INTEGER,
  created_at   TEXT DEFAULT (datetime('now')),
  UNIQUE (employee_id, tanggal)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS leaves (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL DEFAULT 1,
  jenis       TEXT NOT NULL,
  mulai       TEXT NOT NULL,
  selesai     TEXT NOT NULL,
  keterangan  TEXT DEFAULT '',
  lampiran    TEXT,
  status      TEXT DEFAULT 'Menunggu',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_tanggal ON attendance (employee_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_attendance_tanggal          ON attendance (tanggal);
CREATE INDEX IF NOT EXISTS idx_leaves_employee             ON leaves (employee_id, mulai);
CREATE INDEX IF NOT EXISTS idx_overtime_employee           ON overtime (employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_employee      ON notifications (employee_id, dibaca);
CREATE INDEX IF NOT EXISTS idx_notifications_grup          ON notifications (grup_id);
CREATE INDEX IF NOT EXISTS idx_sessions_employee           ON sessions (employee_id);
`
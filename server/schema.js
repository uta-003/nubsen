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
  is_admin     INTEGER DEFAULT 0,
  -- Status kepegawaian: 'Karyawan Tetap' atau 'Karyawan Kontrak' (dipilih admin
  -- pada form Tambah/Edit Karyawan di panel admin).
  status_karyawan TEXT DEFAULT 'Karyawan Tetap',
  -- Penghitung gaji per karyawan (Rp) — diisi admin; 0 = belum diatur.
  gaji_harian  REAL DEFAULT 0,
  uang_makan   REAL DEFAULT 0,
  tarif_lembur REAL DEFAULT 0
);

-- Periode penggajian (mis. "Gaji September 2026") yang ditetapkan admin pada
-- tab Gaji. Slip gaji di aplikasi karyawan mengikuti periode yang AKTIF.
CREATE TABLE IF NOT EXISTS payroll_periods (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nama       TEXT NOT NULL,
  dari       TEXT NOT NULL,
  sampai     TEXT NOT NULL,
  aktif      INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
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
  -- Alasan penolakan dari admin (tampil di notifikasi & riwayat karyawan).
  alasan_tolak TEXT DEFAULT '',
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
  -- 1 bila absensi dilakukan di luar hari kerja (mis. masuk hari Sabtu/Minggu)
  hari_libur   INTEGER,
  -- Data absen PULANG — terpisah agar tidak pernah menimpa data masuk:
  -- jam masuk & pulang masing-masing punya lokasi + foto selfie sendiri.
  lat_out          REAL,
  lon_out          REAL,
  alamat_out       TEXT,
  selfie_out       TEXT,
  di_luar_area_out INTEGER,
  jarak_out        INTEGER,
  created_at   TEXT DEFAULT (datetime('now')),
  UNIQUE (employee_id, tanggal)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Hari libur nasional/cuti bersama (prefill resmi saat seed) + libur khusus
-- yang ditetapkan admin. Hari yang terdaftar: tidak Alpha, tidak dihitung hari
-- kerja pada laporan/gaji, dan absensi di hari itu ditandai hari_libur = 1.
CREATE TABLE IF NOT EXISTS holidays (
  tanggal TEXT PRIMARY KEY,
  nama    TEXT NOT NULL,
  sumber  TEXT DEFAULT 'admin'
);

-- Surat peringatan (SP1/SP2/SP3) & pemecatan yang diterbitkan admin. Tampil di
-- Profil karyawan; setiap penerbitan mengirim notifikasi ke yang bersangkutan.
CREATE TABLE IF NOT EXISTS warnings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  jenis       TEXT NOT NULL,            -- 'SP1' | 'SP2' | 'SP3' | 'Pemecatan'
  nomor       TEXT,                     -- nomor surat resmi (001/SP-HRD/IX/2026)
  tanggal     TEXT NOT NULL,            -- tanggal surat (YYYY-MM-DD)
  alasan      TEXT DEFAULT '',
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_warnings_employee ON warnings (employee_id);

-- RIWAYAT surat peringatan: jejak audit setiap penerbitan & pencabutan surat.
-- Baris di sini TIDAK pernah dihapus walaupun suratnya dicabut atau karyawannya
-- dihapus, karena nama karyawan & nomor surat disimpan sebagai salinan (snapshot).
-- Dipakai tab "Riwayat SP" di panel admin.
CREATE TABLE IF NOT EXISTS warning_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  warning_id    INTEGER,                  -- id surat asli (null bila sudah dihapus)
  employee_id   INTEGER,                  -- id karyawan (boleh null bila karyawan dihapus)
  nama_karyawan TEXT DEFAULT '',          -- salinan nama saat kejadian
  jenis         TEXT NOT NULL,            -- 'SP1' | 'SP2' | 'SP3' | 'Pemecatan'
  nomor         TEXT DEFAULT '',          -- nomor surat resmi
  tanggal       TEXT NOT NULL,            -- tanggal surat (YYYY-MM-DD)
  alasan        TEXT DEFAULT '',
  aksi          TEXT NOT NULL,            -- 'Diterbitkan' | 'Dicabut'
  oleh          TEXT DEFAULT '',          -- nama admin yang melakukan aksi
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_warning_log_created  ON warning_log (created_at);
CREATE INDEX IF NOT EXISTS idx_warning_log_employee ON warning_log (employee_id);

-- Jurnal idempotensi sinkronisasi luring: setiap pengajuan dari antrean
-- perangkat membawa requestId unik; server menolak memproses dua kali
-- (koneksi drop setelah terkirim tidak akan menciptakan data ganda).
CREATE TABLE IF NOT EXISTS sync_log (
  request_id  TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  jenis       TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
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
  -- Alasan penolakan dari admin (tampil di notifikasi & riwayat karyawan).
  alasan_tolak TEXT DEFAULT '',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_tanggal ON attendance (employee_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_attendance_tanggal          ON attendance (tanggal);
CREATE INDEX IF NOT EXISTS idx_leaves_employee             ON leaves (employee_id, mulai);
CREATE INDEX IF NOT EXISTS idx_overtime_employee           ON overtime (employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_employee      ON notifications (employee_id, dibaca);
CREATE INDEX IF NOT EXISTS idx_notifications_grup          ON notifications (grup_id);
CREATE INDEX IF NOT EXISTS idx_sessions_employee           ON sessions (employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_periode_aktif        ON payroll_periods (aktif);
`
# â° NUBSEN â€” Aplikasi Absensi Karyawan (Fullstack + PWA)

Aplikasi absensi mobile-first: **React 18 + Vite + Tailwind CSS** di frontend,
**Node.js/Express + SQLite** di backend, dan siap di-install ke home screen
sebagai **PWA** (manifest + service worker + dark/light mode).

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   proxy /api,/uploads   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Frontend (Vite)  â”‚ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶ â”‚ Backend Express:9091 â”‚
â”‚  React + PWA      â”‚                          â”‚ node:sqlite + multer â”‚
â”‚  :9090 (dev/prev) â”‚ â—€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ â”‚ data/absensi.db      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜        JSON/uploads       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

## 🚀 Deploy ke Internet + Aplikasi Android

Panduan lengkap ada di **[`DEPLOY.md`](./DEPLOY.md)**. Ringkasnya:

| Target | Perintah / langkah |
|---|---|
| **Frontend → Vercel** | `vercel login` → `vercel --prod` (isi env `VITE_BACKEND_URL`) |
| **Backend → Render** | Import repo → Render membaca `render.yaml` (rootDir `server`, disk persisten) |
| **Android (APK)** | `npm run android:url -- https://<domain>.vercel.app` → `npm run android:apk` |
| **Bagikan APK** | `npm run android:rilis` membuat **GitHub Release** + mengunggah APK, tautan unduh bisa dibuka di HP |
| **PWA (tanpa APK)** | Buka domain Vercel di Chrome Android → *Tambahkan ke layar utama* |

Frontend & backend di-hosting terpisah karena Vercel bersifat serverless
(filesystem sementara → SQLite & `uploads/` tidak persisten), sedangkan Render
menjalankan proses Node terus-menerus + *persistent disk*.


## âœ¨ Fitur

> ðŸ–¥ï¸ **Panel admin = "web backend"** untuk mengelola semua data (karyawan, absensi,
> izin, lembur, notifikasi). Buka **http://localhost:9091/#admin** â€” backend juga
> menyajikan aplikasi (`dist/`), jadi satu server sudah cukup untuk semuanya.

| Modul | Detail |
|---|---|
| **Dashboard** | Sapaan, tanggal & jam real-time, kartu jam masuk/pulang + durasi, tombol **"Absen Sekarang"** dengan efek pulsing |
| **GPS Otomatis** | `navigator.geolocation` + reverse geocoding alamat (OpenStreetMap), koordinat & akurasi tampil |
| **Verifikasi Selfie** | Kamera depan + bingkai verifikasi wajah; foto dikirim ke server & disimpan sebagai file |
| **Status Server-side** | Check-in lewat **08:15** otomatis **Terlambat** â€” dihitung di backend, tahan manipulasi jam perangkat |
| **Pengajuan Izin/Cuti** | Jenis (Izin/Sakit/Cuti), rentang tanggal, keterangan, lampiran gambar/PDF (maks 5 MB) via multipart |
| **Riwayat Absensi** | Riwayat absensi MURNI di tab bottom-nav (baris turunan pengajuan izin tidak ditampilkan di sini), filter status & rentang tanggal |
| **Statistik & Gamifikasi** | Grafik batang **1 pekan utuh Senin → Minggu** + nomor tanggal tiap batang, navigasi antar pekan (± 6 bulan), rekap Hadir/Terlambat/Izin/Alpha & % kehadiran, streak ðŸ”¥ hari hadir beruntun (Minggu & tanggal merah tidak memutus), countdown batas absen |
| **Cuaca Terkini** | Ikon cuaca statis di kartu jam (cerah/berawan/kabut/hujan/badai/salju; malam → bulan) via Open-Meteo — GPS perangkat (fallback koordinat kantor), sapaan dinamis sesuai cuaca, info suhu & UV, cache 30 menit, tetap tampil saat luring |
| **Hari Libur & Timer** | Banner "Hari ini libur / bukan hari kerja" di Beranda (countdown "terlambat" disembunyikan di hari non-kerja), strip "🗓️ Libur berikutnya — X hari lagi", pill "⏱️ Sedang bekerja X jam Y mnt" berdetik setelah check-in |
| **Keamanan — Ganti PIN** | Karyawan mengganti PIN sendiri di Profil: verifikasi PIN lama (hash di server), PIN baru 6 angka + konfirmasi ulang, validasi ganda klien & server |
| **Geofence Kantor** | Jarak GPS ke kantor (-6.1765782, 106.899041) dihitung server, **radius 20 m** â€” badge "Di area / Di luar area" |
| **Detail & Export** | Ketuk kartu riwayat â†’ modal detail (selfie, Google Maps, durasi); export CSV |
| **Sisa Cuti** | Kuota cuti tahunan dipotong pengajuan **Cuti** (Menunggu/Disetujui), yang **Ditolak** otomatis dikembalikan â€” tampil di Profil & form Izin |
| **Login & Logout** | Sesi token per karyawan (PIN di-hash SHA-256), auto-login via token tersimpan, halaman login beranimasi (blob, shake) |
| **Kalender Bulanan** | Kalender kehadiran per bulan (pekan mulai **Senin**) dengan navigasi + kalender Indonesia: **semua libur nasional & cuti bersama** 2023–2026 (SKB 3 Menteri; tahun lain hanya tanggal tetap) tampil merah dengan nama & jenisnya; ketuk tanggal berwarna â†’ detail |
| **Pengingat Notifikasi** | Reminder absen masuk (08:05) & pulang (17:00) via browser Notification API |
| **📶 Mode Luring (antrean + sinkron otomatis)** | Bila jaringan/server mati, absen (check-in/out), izin, dan lembur disimpan ke antrean perangkat (localStorage) lalu dikirim **FIFO otomatis** saat online lagi (event `online`, interval 60 dtk, atau ketuk chip di header). Chip header: **"Luring · n"** saat luring, **"n antre"** saat menunggu; item yang ditolak server (validasi/401) dibuang agar antrean tak menggantung |
| **🔔 Notifikasi Perubahan Jadwal** | Admin ubah jam masuk/pulang/hari kerja → seluruh karyawan dapat notifikasi in-app **dan pemberitahuan peramban** (Service Worker `showNotification`, klik membuka `#notifikasi`); hanya notifikasi **baru** yang dipicu (anti-banjir), dan panel admin menjelaskan bila tak ada nilai yang berubah |
| **â±ï¸ Lembur** | Form pengajuan lembur (tanggal/jam/keterangan) + riwayat status persetujuan |
| **Riwayat Pengajuan Izin/Cuti** | Di halaman Izin/Cuti: SEMUA pengajuan (Izin, Sakit, Cuti Tahunan, Cuti Khusus) dengan chip status Menunggu/Disetujui/Ditolak, waktu pengajuan, rentang tanggal & lampiran — gaya sama dengan riwayat lembur; entri luring tampil optimistik sebagai "Menunggu sinkron" |
| **🔔 Notifikasi In-App** | Kotak masuk karyawan dengan lonceng + badge belum-dibaca (polling 30 detik); sumber: sistem (izin/lembur/absensi) & admin; keputusan izin/lembur (disetujui/ditolak) juga memunculkan **pemberitahuan peramban** |
| **ðŸ“¢ Pengumuman dari Admin** | Admin membuat pemberitahuan â†’ otomatis muncul di menu **Notifikasi SEMUA karyawan** (satu baris per orang), status baca **terpisah per karyawan**, statistik **X/Y sudah dibaca** + daftar nama yang belum, bisa **diedit** (status baca direset) & **dihapus** sekaligus |
| **ðŸ–¥ï¸ Panel Admin** | Website backend: kelola karyawan (tambah/edit/hapus/reset PIN/jadikan admin), koreksi absensi, setujui izin & lembur, jadwal kerja (jam + hari kerja), **laporan kehadiran + export Excel/PDF**, **kelola pengumuman** â€” hanya untuk akun admin |
| **Profil** | Data karyawan dari database + rekap kehadiran |
| **Laporan Kehadiran (admin)** | Rekap per karyawan & per departemen pada satu periode; kolom Hadir/Terlambat/**Hadir Libur**/Izin/Sakit/Cuti/Alpha/Lembur (jam)/% Kehadiran; export **Excel (sheet per departemen)** dan **PDF** |
| **PWA** | Installable ke home screen (Android/desktop/iOS), offline page, caching pintar |
| **Dark Mode** | Mengikuti sistem + toggle manual, persisten |

## ðŸš€ Cara Menjalankan

### Cara tercepat â€” satu perintah (Windows)

```bash
cd absensi-app
npm run mulai
```

Skrip `mulai.ps1` akan memasang dependensi bila perlu, menyalakan **backend :9091**
dan **frontend :9090** di dua jendela, menunggu backend siap, lalu membuka panel admin.

| Halaman | Alamat |
|---|---|
| ðŸ“± Aplikasi karyawan (dev) | **http://localhost:9090** |
| ðŸ–¥ï¸ **Panel admin / web backend** (kelola karyawan) | **http://localhost:9091/#admin** |
| ðŸ”Œ API | http://localhost:9091/api/health |

> ðŸ’¡ Backend juga menyajikan hasil build frontend (`dist/`), jadi **cukup satu server**
> pun aplikasi bisa dipakai penuh. Jika `dist/` belum ada, jalankan `npm run build` dulu.

### Cara manual â€” dua terminal

Prasyarat: **Node.js â‰¥ 22** (direkomendasikan â‰¥ 24 karena memakai modul bawaan `node:sqlite`).

**Terminal 1 â€” Backend API (Express + SQLite)**
```bash
cd server
npm install     # sekali saja
npm run dev     # atau: npm start â†’ http://localhost:9091
```
Saat pertama berjalan, database `server/data/absensi.db` dibuat otomatis
beserta 1 karyawan demo + Â±12 riwayat absensi contoh.

**Terminal 2 â€” Frontend (Vite)**
```bash
npm install     # sekali saja
npm run dev     # â†’ http://localhost:9090
```

### ðŸ”‘ Cara login & mengelola karyawan (panel admin)

1. Buka **http://localhost:9091/#admin** (atau `:9090` lalu ketuk ikon ðŸ›¡ï¸ **Admin**
   di navigasi bawah â€” hanya muncul untuk akun admin).
2. Login sebagai admin:
   - Email `afriani.putri@perusahaan.co.id` â€” PIN `123456` (**admin**)
   - Staf biasa: `budi.santoso@perusahaan.co.id` â€” PIN `654321`
3. Di panel admin tersedia tab: **Ringkasan Â· Karyawan Â· Absensi Â· Izin Â· Lembur Â· Notifikasi**
   - Kelola Karyawan: tambah, edit (jabatan/departemen/kuota cuti/reset PIN), jadikan admin, hapus
   - **Jadwal**: jam masuk (batas Terlambat), jam pulang, dan **hari kerja mingguan**
     (Sen-Jum default; pilih Sen-Sab bila perusahaan bekerja enam hari) - dipakai untuk
     menghitung hari kerja pada laporan
   - **Laporan**: pilih periode (+ filter departemen), lihat rekap per karyawan & per
     departemen, lalu **Export Excel/PDF**. Absensi di luar hari kerja masuk kolom
     **Hadir Libur** sehingga tidak menggelembungkan % kehadiran
   - Koreksi absensi, setujui/tolak izin & lembur (notifikasi otomatis ke karyawan)
   - **Tab ðŸ”” Notifikasi = membuat pemberitahuan**: pilih **ðŸ“¢ SEMUA KARYAWAN** â†’ pengumuman
     langsung muncul di menu Notifikasi setiap karyawan (satu baris per orang, status baca
     terpisah); kartu di panel menampilkan **X/Y sudah dibaca** + nama yang belum membaca,
     serta tombol **edit** (isi diperbarui & status baca direset) dan **hapus** (hilang dari semua)

URL mendukung hash agar bisa di-refresh/di-bookmark: `#dashboard`, `#pengajuan`,
`#riwayat`, `#notifikasi`, `#profil`, `#admin` (akun non-admin otomatis dialihkan ke beranda).
Hash era 5 tab (`#izin`, `#lembur`) tetap berfungsi — dibuka sebagai tab Pengajuan
dengan sub-halaman sesuai hash-nya.


Buka **http://localhost:9090** dan login dengan **akun demo**:
`afriani.putri@perusahaan.co.id` / PIN `123456` (atau `budi.santoso@perusahaan.co.id` / PIN `654321`).
Semua panggilan `/api/*` & `/uploads/*` diproxy
otomatis ke backend. Untuk simulasi HP: Chrome DevTools â†’ `Ctrl+Shift+M`.
Untuk GPS/kamera asli dari HP: akses `http://<IP-KOMPUTER>:9090` (jaringan sama).

> âš ï¸ Kamera & GPS butuh konteks aman (HTTPS atau localhost). Simulasikan lokasi
> lewat DevTools â†’ Sensors â†’ Location.

## ðŸ­ Build Produksi + PWA

```bash
npm run build        # hasil di dist/
npm run preview      # â†’ http://localhost:9090 (tetap proxied ke backend :9091)
```

Service worker hanya aktif di build produksi (tidak mengganggu HMR saat dev).

**Uji install ke home screen:**
1. Jalankan backend (`npm run start` di `server/`) + `npm run preview`.
2. Buka `http://localhost:9090` di Chrome/Edge â†’ ikon **install** di address bar,
   atau tunggu banner **"Install NUBSEN"** muncul di dalam aplikasi.
3. Android Chrome: menu â‹® â†’ *Add to Home screen*. iOS Safari: Share â†’ *Add to Home Screen*.

## ðŸ”Œ REST API (Express :9091)

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/health` | Cek server hidup (publik) |
| POST | `/api/auth/login` | `{ email, pin }` â†’ `{ token, karyawan }` â€” demo: `afriani.putri@â€¦` PIN `123456`, `budi.santoso@â€¦` PIN `654321` |
| POST | `/api/auth/logout` | Hapus sesi token |
| GET | `/api/profile` | Data karyawan yang sedang login |
| GET | `/api/attendance/today` | Catatan kehadiran hari ini (`null` bila belum absen) |
| POST | `/api/attendance/check-in` | JSON `{ lat, lon, alamat, selfie(dataURL), requestId? }` â†’ status Hadir/Terlambat + **geofence** (`diLuarArea`, `jarak` m ke kantor, radius 20 m); duplikat â†’ 409 ; `requestId` sama → `duplikat: true` (idempoten, sinkron luring) |
| POST | `/api/attendance/check-out` | JSON sama; wajib sudah check-in â†’ 409 bila belum/sudah |
| GET | `/api/attendance/history?dari=&sampai=&status=` | Riwayat gabungan (absensi + izin) |
| GET/POST | `/api/overtime` | Pengajuan lembur milik sendiri |
| GET | `/api/notifications` | Notifikasi sendiri + broadcast (`{ items, belumDibaca }`) |
| POST | `/api/notifications/read` | Tandai semua notifikasi dibaca |
| GET/PUT | `/api/admin/jadwal` | **[Admin]** Jam masuk (batas Terlambat), jam pulang, dan **hari kerja mingguan** (`hariKerja: [1,2,3,4,5]`, 0 = Minggu, minimal satu hari) |
| GET | `/api/admin/reports?dari=&sampai=&departemen=` | **[Admin]** Laporan kehadiran: rekap per karyawan (`baris`), ringkasan, dan `rekap` per departemen (Hadir/Terlambat/Hadir Libur/Izin/Sakit/Cuti/Alpha/Lembur/% Kehadiran) |
| GET/POST/PUT/DELETE | `/api/admin/employees[...]` | **[Admin]** Kelola karyawan (tambah/edit/hapus, reset PIN, flag admin) |
| GET/PUT/DELETE | `/api/admin/attendance[...]` | **[Admin]** Lihat semua absensi (filter), koreksi, hapus |
| GET/PUT/DELETE | `/api/admin/leaves[...]` | **[Admin]** Setujui/Tolak/Hapus izin (otomatis kirim notifikasi) |
| GET/PUT/DELETE | `/api/admin/overtime[...]` | **[Admin]** Setujui/Tolak/Hapus lembur (otomatis kirim notifikasi) |
| GET/POST/PUT/DELETE | `/api/admin/notifications[...]` | **[Admin]** `POST` tanpa `employeeId` = **pengumuman ke semua karyawan** (fan-out 1 baris/orang) â†’ `{ grupId, jumlah }`; `POST` dengan `employeeId` = notifikasi personal; `PUT`/`DELETE` `/grup/:grupId` untuk **edit** (reset status baca) & **hapus** pengumuman; `GET` mengembalikan pengumuman **terkelompok** + `total`/`dibaca`/`belumBaca` |
| GET | `/api/admin/overview` | **[Admin]** Ringkasan angka dashboard admin |
| GET | `/api/leaves` | Daftar pengajuan izin |
| POST | `/api/leaves` | Multipart: `jenis, mulai, selesai, keterangan, lampiran(file)`; rentang yang mencakup hari ini otomatis mengubah status hari ini menjadi **Izin** |

File unggahan (selfie & lampiran) disimpan di `server/uploads/` dan dilayani
statik di `/uploads/*`.

> ðŸ” Semua endpoint selain `/api/health` dan `/api/auth/*` wajib membawa header
> `Authorization: Bearer <token>` hasil login. Endpoint `/api/admin/*` khusus
> akun dengan flag admin (demo: Afriani).

## ðŸ§ª Uji Otomatis API

Backend menyertakan **72 pemeriksaan end-to-end** (login & proteksi sesi, CRUD
karyawan, alur lembur â†’ persetujuan â†’ notifikasi, **pengumuman ke semua karyawan:
fan-out, isolasi status baca, statistik baca, edit & hapus grup**, izin multipart,
kuota cuti, geofence + koreksi absensi, **jadwal hari kerja & laporan kehadiran
(validasi parameter, kolom Hadir Libur, proteksi admin)**, logout). Skrip ini
mengembalikan pengaturan jadwal ke kondisi semula dan membersihkan datanya sendiri
sehingga aman dijalankan berulang.

```bash
# pastikan backend sudah berjalan, lalu:
cd server
npm test          # setara: node uji-api.mjs
```

Contoh keluaran:
```
PASS  login admin â†’ Afriani Putri
PASS  admin kirim pengumuman ke semua karyawan â†’ penerima=2/2 grup=gmu3gga4p5fnb
PASS  pengumuman muncul juga di karyawan lain (baris terpisah) â†’ id 100 vs 101
PASS  Budi tandai dibaca â†’ salinannya tercentang
PASS  salinan Afriani TETAP belum dibaca â†’ dibaca=false
PASS  badge Afriani tidak ikut terhapus â†’ belumDibaca=1
PASS  admin lihat 1 sudah dibaca + daftar belum baca â†’ dibaca=1 belum=[Afriani Putri]
PASS  edit mengubah isi & reset status baca â†’ dibaca=0
PASS  admin hapus pengumuman (semua baris) â†’ dihapus harus 2
PASS  check-in (geofence 0 m) â†’ jarak=0 m, status=Terlambat
PASS  check-in luar radius ditandai â†’ jarak=116 m
PASS  cuti (Menunggu) memotong kuota 3 hari â†’ 12 â†’ 9
PASS  notifikasi persetujuan sampai ke karyawan â†’ âœ… Lembur disetujui
PASS  kuota akun demo tetap utuh setelah bersih-bersih â†’ 12 â†’ 12
=== RINGKASAN: 57 lulus, 0 gagal ===
```

## ðŸ—‚ï¸ Struktur Proyek

```
absensi-app/
â”œâ”€â”€ mulai.ps1                   # Peluncur sekali-klik: backend :9091 + frontend :9090
├── vercel.json                 # Konfigurasi deploy frontend (Vite SPA + cache)
├── render.yaml                 # Blueprint backend Render (disk persisten)
├── capacitor.config.json       # URL aplikasi Android (server.url → domain Vercel)
├── .env.example                # Contoh variabel lingkungan (VITE_BACKEND_URL, dll.)
├── DEPLOY.md                   # Panduan deploy Vercel + Render + build APK
â”œâ”€â”€ index.html                  # Meta PWA, manifest, ikon, font Inter
â”œâ”€â”€ vite.config.js              # Proxy /api & /uploads â†’ :9091 (dev + preview)
â”œâ”€â”€ tailwind.config.js          # Tema, animasi pulse-glow, dark mode 'class'
â”œâ”€â”€ scripts/generate-icons.mjs  # Generator ikon PNG murni Node (tanpa dependensi)
├── scripts/build-apk.ps1       # Build APK sekali-klik (JDK 17 portable + Gradle)
├── scripts/set-url-android.ps1 # Ganti domain aplikasi Android
├── android/                    # Proyek Android (Capacitor) — hasil build diabaikan git
â”œâ”€â”€ public/                     # Aset PWA (disalin apa adanya ke dist/)
â”‚   â”œâ”€â”€ manifest.webmanifest
â”‚   â”œâ”€â”€ sw.js                   # Service worker (network-first/cache-first/SWR)
â”‚   â”œâ”€â”€ offline.html            # Halaman luring
â”‚   â””â”€â”€ icons/                  # icon.svg + PNG 192/512/maskable
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ main.jsx                # Entry + registrasi service worker (PROD)
â”‚   â”œâ”€â”€ api.js                  # Klien REST (semua via path relatif ter-proxy)
â”‚   â”œâ”€â”€ App.jsx                 # View state + gate loading/error + toast
â”‚   â”œâ”€â”€ hooks/
â”‚   â”‚   â”œâ”€â”€ useAbsensi.js       # State: profil, hari ini, riwayat (dari API)
â”‚   â”‚   â”œâ”€â”€ useSinkronLuring.js # Chip status luring + mesin sinkron antrean
â”‚   â”‚   â”œâ”€â”€ usePengingat.js     # Notifikasi pengingat absen
â”‚   â”‚   â””â”€â”€ useDarkMode.js
â”‚   â”œâ”€â”€ utils/ (date, geo, statistik, liburIndonesia, cuaca, luring, storage)
â”‚   â””â”€â”€ components/
â”‚       â”œâ”€â”€ Dashboard.jsx       # Jam real-time, ikon cuaca, status, tombol absen, GPS
â”‚       â”œâ”€â”€ SelfieModal.jsx     # Kamera depan + bingkai verifikasi
â”‚       â”œâ”€â”€ Izin.jsx  Pengajuan.jsx  Riwayat.jsx  Profil.jsx
â”‚       â”œâ”€â”€ Statistik.jsx         # Grafik batang per pekan Senin-Minggu + tanggal + streak
â”‚       â”œâ”€â”€ RiwayatDetail.jsx     # Modal detail: selfie, Maps, geofence
â”‚       â”œâ”€â”€ LoginPage.jsx         # Halaman login beranimasi (blob, shake)
â”‚       â”œâ”€â”€ KalenderBulan.jsx     # Kalender bulanan + libur nasional & cuti bersama Indonesia
â”‚       â”œâ”€â”€ Lembur.jsx            # Form + riwayat pengajuan lembur
â”‚       â”œâ”€â”€ Notifikasi.jsx        # Kotak masuk notifikasi (inbox + 30s polling, jenis pengumuman/penting/highlight)
â”‚       â”œâ”€â”€ NotifikasiBell.jsx    # Lonceng + badge belum dibaca
â”‚       â”œâ”€â”€ Admin.jsx             # Panel admin: karyawan/absensi/izin/lembur/notifikasi
â”‚       â”œâ”€â”€ InstallPrompt.jsx   # Banner beforeinstallprompt
â”‚       â””â”€â”€ BottomNav.jsx  Toast.jsx  StatusBadge.jsx  DarkModeToggle.jsx
â””â”€â”€ server/
    â”œâ”€â”€ index.js                # Express: CORS, JSON, API, static uploads, sajikan dist/ (SPA)
    â”œâ”€â”€ db.js                   # node:sqlite â€” skema (employees/attendance/leaves/overtime/notifications/sessions)
    â”œâ”€â”€ seed.js                 # Data demo (2 karyawan + PIN)
    â”œâ”€â”€ models.js               # Query: check-in/out, riwayat, izin, lembur, notifikasi, admin, sesi
    â”œâ”€â”€ routes/                 # auth, profile, attendance, leaves (multer), overtime, notifications, admin
    â”œâ”€â”€ utils/                  # waktu.js, files.js (simpan dataURL selfie)
    â”œâ”€â”€ uji-api.mjs             # Uji end-to-end 72 pemeriksaan (npm test)
    â”œâ”€â”€ data/absensi.db         # Database (di-gitignore)
    â””â”€â”€ uploads/                # Selfie & lampiran (di-gitignore)
```
### 📱 Tampilan ponsel (UX mobile)

- **Header sticky & solid** — logo + nama **NUBSEN** selalu menempel di atas saat
  halaman digulir, dengan latar **padat** (`bg-slate-100 dark:bg-slate-950`) sehingga
  kartu gradien biru yang lewat di belakangnya **tidak tembus** dan tidak menimpa
  brand (sebelumnya latar `bg-slate-100/85` + `backdrop-blur` membuat nama tampak
  ditimpa pita biru).
- **`overflow-x-clip`, bukan `overflow-x-hidden`** pada wadah di `App.jsx`.
  `overflow-x: hidden` menjadikan wadah sebagai *scroll container* sehingga
  `position: sticky` header **mati** (header ikut tergulir ke atas). `overflow-x: clip`
  tetap memotong luapan mendatar tanpa mematikan sticky.
- **Satu navigasi per layar** — aplikasi memakai bottom-nav **4 tab** (Beranda,
  Pengajuan, Riwayat, Profil): Izin/Cuti & Lembur digabung jadi satu tab
  **Pengajuan** dengan pemilih sub-halaman (pill Izin/Cuti · Lembur) di dalamnya —
  bar lebih lapang & rapi di ponsel sempit. Panel Admin dibuka lewat tombol perisai di header dan
  tampil **layar penuh** tanpa bottom-nav agar tidak berebut ruang.
- **Aman notch & home-bar** — `pt-[max(env(safe-area-inset-top),0.75rem)]` pada
  header, `pb-[calc(6.5rem+env(safe-area-inset-bottom))]` pada wadah konten.
- **Chip filter membungkus (`flex-wrap`)** di Riwayat supaya tidak ada chip yang
  terpotong di layar sempit; tabel lebar memakai kelas `.tabel-geser` (geser
  mendatar dengan jari, tanpa memicu scroll halaman).
- **Tanggal beranda menyatu dengan jam** — tanggal hari ini tampil di dalam kartu
  **"Waktu Saat Ini"** (`Dashboard.jsx`), bukan lagi chip kecil yang menyempil di
  bawah nama. Sebelumnya chip itu berada di ujung blok sapaan sehingga saat
  digulir ia lewat tepat di bawah header sticky dan tampak "tertimpa"; kini
  tanggal & jam selalu satu tempat dan tidak ada elemen yang beririsan dengan
  header pada scroll 0 → 250 px.
- **Avatar profil wajib `relative z-10`** (`Profil.jsx`) — banner gradien
  identitas memakai `position: relative`, dan menurut urutan pengecatan CSS
  elemen berposisi selalu dicat **sesudah** isi statis. Tanpa `z-10` banner
  menutupi separuh huruf inisial avatar (huruf nama "tertimpa biru"); dengan
  `z-10` luas huruf inisial yang tertutup = **0 %**.
- Diuji pada viewport **320 / 360 / 390 px** (Chrome headless + iframe berukuran
  pasti): tidak ada elemen melebar, tidak ada elemen yang beririsan dengan brand.
  Pemeriksaan timpaan memakai `document.elementFromPoint` di seluruh kotak teks
  (persen area teks yang tertutup elemen lain) — terang & gelap: 0 %.

## ðŸ§° Reset & Troubleshooting

- **"localhost refused to connect" / ERR_CONNECTION_REFUSED**: server sedang **tidak
  berjalan** (bukan error aplikasi). Jalankan `npm run mulai` dari folder `absensi-app`,
  lalu buka **http://localhost:9090** atau panel admin **http://localhost:9091/#admin**.
  Perhatikan juga portnya â€” `localhost` tanpa angka berarti port 80 (kosong).
- **Reset data**: matikan server, hapus `server/data/` dan `server/uploads/`,
  jalankan ulang â†’ seed demo dibuat lagi.
- **Port bentrok**: ubah `PORT` (server, variabel env) atau port di `vite.config.js`.
- **"Server tidak terjangkau"**: pastikan backend berjalan dulu, lalu klik
  **Coba Lagi** pada layar error aplikasi.
- **SW tidak muncul di dev**: memang disengaja (hanya PROD). Uji via `npm run build && npm run preview`.

## ðŸ¦¾ Roadmap / To-Do Berikutnya

> Checklist berikut adalah rencana pengembangan; item yang bertanda ✅ sudah dikerjakan.

**1. ~~Absensi offline-first~~ ✅ sudah dikerjakan (penuh)**
- ✅ Antrean perangkat (localStorage `absenku.antrean`) untuk **check-in/out, izin, lembur**
- ✅ **Selfie & lampiran File ikut mengantre**: payload besar (>200 KB) dan File/Blob disimpan di **IndexedDB** (`absenku-luring`); antrean hanya memegang penunjuk `@idb:…` — localStorage tetap ringan & aman dari kuota penuh
- ✅ Sinkron otomatis saat koneksi pulih: event `online`, interval 60 dtk, atau ketuk chip di header
- ✅ **Idempotensi server-side via `requestId`**: jurnal `sync_log` mengenali pengiriman ulang — koneksi putus tepat setelah tersimpan TIDAK menciptakan data ganda dan TIDAK memunculkan 409 di klien (respons `duplikat: true`)
- ✅ UI status "belum terkirim": chip **"Luring · n"** / **"n antre"** + toast hasil sinkron
- ✅ Service worker (`public/sw.js`) precache app-shell + `offline.html` + API GET dari cache
- *Sisa yang belum*: Background Sync API (sinkron walau tab tertutup)

**2. __Export data admin ke Excel/PDF__ laporan kehadiran per departemen**
- Endpoint baru `GET /api/admin/reports?start=&end=&dept=` â†’ kembalikan laporan gabungan
- Excel: paket `xlsx` â€” sheet per departemen, summary total hari hadir/terlambat/izin
- PDF: paket `pdfmake` atau `puppeteer` â€” header logo, tabel per-karyawan, tanda tangan digital opcional
- UI di tab laporan: picker periode + departemen + tombol **Export XLSX / Export PDF**
- Kolom: nama, NIP, departemen, hadir, terlambat, izin, cuti, lembur, persentase kehadiran

**3. __Integrasi email/SMS reminder__**
- Email via **Resend** / **Nodemailer SMTP** (template HTML responsif, bahasa Indonesia)
- SMS via **Twilio** (atau provider lokal: Telkomsel API/MSG91) â€” reminder 10 menit sebelum shift
- Trigger: lembur disetujui, izin diterima/ditolak, cuti hampir kehaburan kuota, reminder check-in pagi
- Queue job via `node-cron` (tiap pagi 07:00 cek yang belum absen) + `.env` untuk kredensial
- Rate-limit & opt-in: karyawan bisa non-aktifkan notifikasi push/SMS di halaman profil

**4. __Role approval bertingkat__ (approver per departemen)**
- Tambah kolom `reportsToId` di tabel `employees` â†’ hierarki approver
- Flow: `karyawan â†’ tim lead â†’ departemen head â†’ HR` (atau custom depth)
- State workflow: `Menunggu` â†’ `Tim Lead` â†’ `Departemen Head` â†’ `HR` â†’ `Disetujui/Ditolak`
- Setiap level dapat notifikasi push real-time + email
- UI approval berjenjang di panel admin: tombol persetujuan berwarna per level, histori audit trail

**5. __Web Push sungguhan (server → perangkat, walau app tertutup)__**
- ✅ Handler `push` + `notificationclick` di `public/sw.js`; notifikasi perubahan jadwal
  memakai `registration.showNotification` (klik membuka `#notifikasi`)
- *Belum*: `PushManager.subscribe` + VAPID key di klien, tabel `push_subscriptions`,
  dan pengiriman dari backend saat jadwal berubah/pengumuman baru

## ðŸ”Œ Menuju Produksi Nyata

1. Ganti "karyawan demo ID 1" dengan **autentikasi** (JWT/session + tabel users).
2. Deploy backend (Railway/Fly/VPS) â€” SQLite â†’ PostgreSQL/MySQL bila multi-user;
   simpan selfie di object storage (S3/Cloudflare R2) alih-alih folder lokal.
3. Tambah HTTPS (wajib untuk kamera/GPS/service worker di HP).
4. Opsional: `vite-plugin-pwa` untuk precache otomatis + background sync
   antrean absensi saat luring.



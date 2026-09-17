#  Panduan Deploy NUBSEN (Vercel + Render + Aplikasi Android)

Panduan langkah demi langkah mempublikasikan NUBSEN ke internet sehingga
karyawan bisa absen dari HP masing-masing, lalu membungkusnya menjadi aplikasi
Android yang bisa di-install.

---

## 0. Arsitektur yang dipakai

```
   ┌───────────────────────────┐        ┌────────────────────────────────┐
   │  FRONTEND — Vercel        │        │  BACKEND — Render (Node 24)    │
   │  React + Vite + PWA       │ ─────▶ │  Express :9091                 │
   │  https://nubsen.vercel.app│  /api  │  node:sqlite + multer          │
   │  (statis, CDN global)     │        │  /var/data/db + /uploads       │
   └───────────────────────────┘        └────────────────────────────────┘
                 ▲                                      ▲
                 │                                      │
        ┌────────┴─────────┐                  ┌─────────┴──────────┐
        │ Aplikasi Android │                  │ Panel Admin (web)  │
        │ (Capacitor/TWA)  │                  │ nubsen.vercel.app  │
        │ buka URL Vercel  │                  │ /#admin            │
        └──────────────────┘                  └────────────────────┘
```

**Kenapa backend tidak ikut ke Vercel?** Vercel bersifat *serverless*: sistem
filenya sementara, sehingga `node:sqlite` dan folder `uploads/` **tidak
persisten** — data absensi akan hilang/acak. Render menjalankan proses Node
yang hidup terus + **persistent disk**, jadi database & foto aman.

> 🛈 Ingin **semua** di Vercel? Itu perlu memindahkan DB ke Turso/libSQL atau
> Neon Postgres dan mengubah seluruh lapisan query menjadi `async`
> (`server/models.js` + 7 file route). Beri tahu kalau mau ditempuh.

---

## 1. Prasyarat

| Kebutuhan | Catatan |
|---|---|
| Akun **GitHub** | Untuk menyimpan kode (Vercel & Render men-deploy dari repo) |
| Akun **Vercel** | Gratis — untuk frontend |
| Akun **Render** | Gratis — untuk backend (lihat catatan disk di §3) |
| Git | Sudah ada di komputer ini (v2.55) ✔ |
| Node 24 | Sudah ada ✔ (dibutuhkan `node:sqlite`) |

---

## 2. Langkah 1 — Unggah kode ke GitHub

```powershell
cd C:\Users\Afriani\.cline\data\workspaces\chat\absensi-app
git init
git add .
git commit -m "NUBSEN: aplikasi absensi karyawan (PWA + backend + siap deploy)"
git branch -M main
# ganti <USERNAME> dengan username GitHub Anda
git remote add origin https://github.com/<USERNAME>/nubsen.git
git push -u origin main
```

`.gitignore` sudah mengecualikan `node_modules/`, `dist/`, `server/data/`,
`server/uploads/`, dan `.env` — jadi tidak ada data pribadi yang terunggah.

---

## 3. Langkah 2 — Deploy backend ke Render

### Cara A — Blueprint (paling mudah)
1. Buka **https://dashboard.render.com** → **New +** → **Blueprint**.
2. Pilih repo `nubsen` → Render membaca `render.yaml` dan membuat service
   **nubsen-backend** (rootDir `server`, health check `/api/health`).
3. Setelah jadi, catat URL-nya, mis. `https://nubsen-backend.onrender.com`.
4. Uji: buka `https://nubsen-backend.onrender.com/api/health`
   → harus muncul `{"data":{"status":"ok",...}}`.

### Cara B — Manual (kalau tidak pakai Blueprint)
**New +** → **Web Service** → pilih repo → isi:

| Kolom | Nilai |
|---|---|
| Root Directory | `server` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Environment variables:

| Key | Value |
|---|---|
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | `https://nubsen.vercel.app` (isi setelah tahu domain Vercel) |
| `DATA_DIR` | `/var/data/db` |
| `UPLOAD_DIR` | `/var/data/uploads` |

Lalu **Disks** → **Add Disk**: Name `nubsen-data`, Mount Path `/var/data`, Size `1 GB`.

> ⚠️ **Penting soal data:** plan **free** Render tidak mendukung disk — sistem
> filenya ephemeral, jadi database & foto **hilang setiap restart/redeploy**
> (cukup untuk demo). Untuk pemakaian nyata pilih plan **Starter** (disk aktif),
> atau pindah ke Turso (§7).

---

## 4. Langkah 3 — Deploy frontend ke Vercel

### Cara A — Vercel CLI (dari komputer ini)
```powershell
cd C:\Users\Afriani\.cline\data\workspaces\chat\absensi-app
vercel login          # sekali saja — membuka browser untuk login
vercel                # deploy preview
vercel --prod         # deploy produksi
```
Saat ditanya, jawab: **Set up and deploy** → pilih akun → **Link to existing
project?** `N` → **Project name** `nubsen` → **Directory** `./` → **Override
settings?** `N` (Vite terdeteksi otomatis dari `vercel.json`).

### Cara B — Dashboard Vercel
1. **https://vercel.com/new** → **Import Git Repository** → pilih repo `nubsen`.
2. Framework Preset: **Vite** · Root Directory: `./` · Output Directory: `dist`.
3. **Environment Variables** → tambahkan:

| Key | Value |
|---|---|
| `VITE_BACKEND_URL` | `https://nubsen-backend.onrender.com` |

4. **Deploy** → dapat domain, mis. `https://nubsen.vercel.app`.

> `VITE_BACKEND_URL` **wajib** diisi: tanpa itu aplikasi di Vercel akan
> memanggil `/api` di domainnya sendiri (tidak ada backend) → gagal.
> Setelah mengubah env var, lakukan **Redeploy** agar nilai ikut ter-build.

---

## 5. Langkah 4 — Verifikasi

```powershell
# 1) Backend hidup?
curl https://nubsen-backend.onrender.com/api/health
# 2) Frontend hidup?
curl -I https://nubsen.vercel.app
# 3) Login + ambil profil (ganti URL bila perlu)
curl -X POST https://nubsen-backend.onrender.com/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"afriani.putri@perusahaan.co.id\",\"pin\":\"123456\"}'
```
Lalu buka `https://nubsen.vercel.app` di HP → login → GPS + kamera aktif
(keduanya butuh **HTTPS**, dan Vercel sudah HTTPS). Panel admin:
`https://nubsen.vercel.app/#admin`.

---

## 6. Langkah 5 — Aplikasi Android

Aplikasi Android dibuat dengan **Capacitor**: membungkus PWA NUBSEN menjadi
WebView native yang **selalu memuat versi terbaru dari Vercel** (jadi setiap
`git push` → otomatis terbaru di HP, tanpa membangun ulang APK).

```powershell
cd C:\Users\Afriani\.cline\data\workspaces\chat\absensi-app
npm install                     # sekali saja
npm run android:add             # membuat folder android/ (sekali saja)
```

**Set domain Vercel Anda** ke aplikasi (agar APK memuat aplikasi online):

```powershell
npm run android:url -- https://nubsen.vercel.app
```

**Bangun APK — satu perintah:**

```powershell
npm run android:apk
```

Skrip `scripts/build-apk.ps1` otomatis: build web → `cap sync` → Gradle
`assembleDebug`, lalu menyalin hasilnya menjadi **`NUBSEN-debug.apk`** di root
proyek. Kirim berkas itu ke HP → izinkan "Install dari sumber tidak dikenal".

### ⚙️ Catatan toolchain (sudah divalidasi di komputer ini ✔)

| Kebutuhan | Status di komputer Anda | Solusi yang dipakai |
|---|---|---|
| Node 24 | ✔ v24.19.0 | langsung dipakai |
| Android SDK | ✔ `%LOCALAPPDATA%\Android\Sdk` | `ANDROID_HOME` di-set oleh skrip |
| **JDK 17** | ✖ hanya JRE 8 & JDK 25 (JBR Android Studio) | JDK 17 **portabel** diunduh ke `%LOCALAPPDATA%\NubsenTools\jdk-17.0.20.1+1` (tanpa admin) — Gradle 8.2.1 tidak kompatibel dengan JDK 25 |

Kalau JDK portabel itu terhapus, pasang ulang dengan:

```powershell
$d = "$env:LOCALAPPDATA\NubsenTools"; New-Item -ItemType Directory -Force -Path $d | Out-Null
Invoke-WebRequest 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse' -OutFile "$d\jdk17.zip"
Expand-Archive "$d\jdk17.zip" -DestinationPath $d -Force
```

> ℹ️ Selama `server.url` menunjuk domain Vercel, **setiap `git push` otomatis
> terbaru di HP** tanpa membangun ulang APK. Bangun ulang APK hanya bila ingin
> mengganti ikon/nama aplikasi atau domain.

---

## 7. Panel admin & alur data karyawan

Semua data karyawan tersimpan di **satu database backend bersama**:

| Data | Masuk ke panel admin lewat |
|---|---|
| Absensi (masuk/pulang, selfie, GPS, geofence) | Tab **Absensi** |
| Izin / cuti (+ lampiran) | Tab **Izin** → Setujui/Tolak |
| Lembur | Tab **Lembur** → Setujui/Tolak |
| Notifikasi (broadcast/personal) | Tab **Notifikasi** |
| Akun & jabatan karyawan | Tab **Karyawan** (tambah/edit/hapus/reset PIN) |
| Jadwal jam masuk & pulang | Tab **Jadwal** |

Karena frontend & backend kini sama-sama online, absen dari HP karyawan mana pun
**langsung muncul** di panel admin, dan notifikasi yang dikirim admin **masuk ke
notifikasi setiap karyawan** (badge lonceng, polling 30 detik).

> 👤 Karyawan baru didaftarkan oleh admin di tab **Karyawan** (email + PIN +
> jabatan/departemen). Kalau mau karyawan bisa **mendaftar sendiri** dari
> halaman login (status menunggu verifikasi admin), bilang saja — fitur itu
> bisa ditambahkan.

---

## 8. Mengganti backend ke Turso (opsional, data 100% persisten & gratis)

Kalau ingin backend tetap gratis **tanpa** risiko kehilangan data:
1. Daftar **https://turso.tech** → buat database → catat `libsql://...` + token.
2. Lapisan DB di `server/db.js` diubah memakai `@libsql/client` (async),
   lalu `server/models.js` + semua route disesuaikan ke `await`.
3. Set env: `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`, dan `UPLOAD_DIR`
   diarahkan ke penyimpanan objek (Vercel Blob / S3) atau foto disimpan
   langsung sebagai dataURL di DB.

Pekerjaan ini cukup besar (menyentuh seluruh query) tetapi hasilnya
**backend bisa ikut ke Vercel** sehingga tidak perlu Render sama sekali.

---

## 9. Catatan produksi

- **Keamanan PIN:** saat ini SHA-256 tanpa salt. Untuk produksi nyata ganti ke
  `bcrypt`/`argon2` (`server/db.js` → `hashPin`).
- **HTTPS wajib** untuk GPS & kamera — Vercel sudah menyediakannya.
- **APK rilis:**
  ```powershell
  keytool -genkey -v -keystore nubsen.keystore -alias nubsen -keyalg RSA -keysize 2048 -validity 10000
  # lalu build: .\gradlew assembleRelease (isi signingConfig di app/build.gradle)
  ```
- **PWA install dari browser:** buka domain Vercel di Chrome Android → menu →
  **Tambahkan ke layar utama**. Ini alternatif tercepat tanpa membangun APK.
- **Update aplikasi:** cukup `git push` — Vercel & Render otomatis deploy ulang.

---

## 10. Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| Aplikasi online tapi "Server tidak terjangkau" | `VITE_BACKEND_URL` belum diisi / belum redeploy, atau backend Render sedang *cold start* (tunggu ±30 s) |
| Login gagal padahal PIN benar | Database baru di-seed otomatis saat start pertama; tunggu backend selesai boot lalu coba lagi |
| Foto selfie/lampiran tidak muncul | `CORS_ORIGINS` tidak memuat domain Vercel, atau UPLOAD_DIR tidak di disk persisten |
| Data hilang setelah beberapa lama | Backend Render memakai plan **free** (tanpa disk) → lihat §3 / §8 |
| `Cannot find module node:sqlite` | Node di server < 24 — set env `NODE_VERSION=24` |
| Perubahan env tidak berefek | Di Vercel: **Redeploy**. Di Render: **Manual Deploy → Clear build cache & deploy** |

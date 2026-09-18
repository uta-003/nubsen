// ============ Mode luring: antrean & sinkronisasi otomatis ============
// Saat server tidak terjangkau, absen (check-in/out), izin, dan lembur TIDAK
// hilang — disimpan di perangkat lalu dikirim otomatis begitu kembali online
// (event 'online', interval 60 dtk, atau ketuk chip status di header).
//
// Dua penyimpanan dipakai berdampingan:
//   * localStorage  — antrean metadata (JSON kecil, cepat disinkronkan ke UI).
//   * IndexedDB     — PAYLOAD BESAR (selfie dataURL ~1–2 MB) yang tidak muat
//                     di localStorage (kuota ±5 MB). Antrean hanya menyimpan
//                     kunci `@idb:<kunci>`; saat sinkron, payload disambung
//                     kembali dari IndexedDB. Bila IndexedDB gagal (mode privat
//                     dsb.), payload kecil tetap jatuh ke localStorage.

import * as api from '../api'

const KUNCI_ANTREAN = 'absenku.antrean'
const DB_NAMA = 'absenku-luring'
const TOKO = 'payload'
const AWALAN_IDB = '@idb:'
// Selfie di atas ambang ini TIDAK masuk localStorage (risiko kuota penuh yang
// bisa menggagalkan seluruh antrean) — langsung dirutekan ke IndexedDB.
const AMBANG_IDB = 200 * 1024 // 200 KB

// ---------- IndexedDB sederhana (promise wrapper) ----------
function bukaDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB tidak tersedia'))
    const req = indexedDB.open(DB_NAMA, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(TOKO)) req.result.createObjectStore(TOKO)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(kunci, nilai) {
  const db = await bukaDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TOKO, 'readwrite')
    tx.objectStore(TOKO).put(nilai, kunci)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

async function idbGet(kunci) {
  const db = await bukaDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TOKO, 'readonly')
    const req = tx.objectStore(TOKO).get(kunci)
    req.onsuccess = () => { db.close(); resolve(req.result ?? null) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

async function idbHapus(kunci) {
  const db = await bukaDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TOKO, 'readwrite')
    tx.objectStore(TOKO).delete(kunci)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

// ---------- Antrean metadata (localStorage) ----------
export function bacaAntrean() {
  try {
    const arr = JSON.parse(localStorage.getItem(KUNCI_ANTREAN) || '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function simpanAntrean(arr) {
  try {
    localStorage.setItem(KUNCI_ANTREAN, JSON.stringify(arr))
  } catch { /* penyimpanan penuh — biarkan antrean di memori sesi ini */ }
}

// Payload berisi data besar (selfie dataURL)? → simpan di IndexedDB, antrean
// hanya memegang penunjuk `@idb:<kunci>`.
async function siapkanItem(jenis, payload) {
  const item = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    jenis, // 'checkin' | 'checkout' | 'izin' | 'lembur'
    payload,
    dibuat: new Date().toISOString(),
    // requestId unik → server mengenali pengiriman ulang (idempoten).
    requestId: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
  }
  const besar = JSON.stringify(payload).length > AMBANG_IDB
  // File/Blob (lampiran izin) TIDAK terdeteksi JSON.stringify (menjadi "{}")
  // dan tidak bisa masuk localStorage — selalu dirutekan ke IndexedDB.
  const punyaFile = payload && typeof payload === 'object' && Object.values(payload).some(
    (v) => (typeof File !== 'undefined' && v instanceof File) || (typeof Blob !== 'undefined' && v instanceof Blob),
  )
  if ((besar || punyaFile) && typeof indexedDB !== 'undefined') {
    try {
      await idbSet(`payload-${item.id}`, payload)
      item.payload = { [AWALAN_IDB]: `payload-${item.id}` }
      item.diIdb = true
    } catch { /* IndexedDB gagal — biarkan payload di localStorage */ }
  }
  return item
}

// Tambahkan satu pekerjaan ke antrean + beri tahu UI (chip header & hook sinkron).
export async function tambahAntrean(jenis, payload) {
  const item = await siapkanItem(jenis, payload)
  simpanAntrean([...bacaAntrean(), item])
  try { window.dispatchEvent(new CustomEvent('absenku:antrean')) } catch { /* abaikan */ }
  return item
}

function hapusAntrean(id) {
  const item = bacaAntrean().find((x) => x.id === id)
  if (item?.diIdb && item.payload?.[AWALAN_IDB]) {
    idbHapus(item.payload[AWALAN_IDB]).catch(() => {}) // bersihkan payload besar
  }
  simpanAntrean(bacaAntrean().filter((x) => x.id !== id))
}

export function jumlahAntrean() {
  return bacaAntrean().length
}

// Galat jaringan (bukan penolakan server) → layak diantrekan / dicoba ulang.
export function adalahGalatJaringan(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return /terjangkau|network|failed to fetch|luring/i.test(err?.message || '')
}

// Sambungkan kembali payload dari IndexedDB bila item menunjuk ke sana.
async function muatPayload(item) {
  const kunci = item.payload?.[AWALAN_IDB]
  if (!kunci) return item.payload
  const data = await idbGet(kunci)
  if (!data) throw new Error('Data luring hilang dari IndexedDB') // diperlakukan galat network-safe? tidak — biarkan item dibuang dengan jelas
  return data
}

async function kirimItem(item) {
  const payload = await muatPayload(item)
  const denganId = { ...payload, requestId: item.requestId }
  if (item.jenis === 'checkin') return api.checkIn(denganId)
  if (item.jenis === 'checkout') return api.checkOut(denganId)
  if (item.jenis === 'lembur') return api.buatLembur(denganId)
  if (item.jenis === 'izin') return api.createLeave(denganId)
  throw new Error(`Jenis antrean tak dikenal: ${item.jenis}`)
}

// Kirim seluruh antrean. Item yang DITOLAK server (validasi/401) dibuang agar
// tidak menggantung selamanya; item yang gagal karena jaringan tetap disimpan.
// `pengirim` hanya untuk pengujian — bawaan memakai api nyata.
export async function prosesAntrean(pengirim = kirimItem) {
  const hasil = { terkirim: 0, gagal: 0 }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return hasil
  for (const item of bacaAntrean()) {
    try {
      await pengirim(item)
      hapusAntrean(item.id)
      hasil.terkirim++
    } catch (e) {
      if (adalahGalatJaringan(e)) break // masih luring — hentikan, coba lagi nanti
      hapusAntrean(item.id)
      hasil.gagal++
    }
  }
  return hasil
}

// Berlangganan perubahan status jaringan. cb menerima 'online' | 'offline'.
// Mengembalikan fungsi pembersih.
export function saatBerubahInternet(cb) {
  const naik = () => cb('online')
  const turun = () => cb('offline')
  window.addEventListener('online', naik)
  window.addEventListener('offline', turun)
  return () => {
    window.removeEventListener('online', naik)
    window.removeEventListener('offline', turun)
  }
}
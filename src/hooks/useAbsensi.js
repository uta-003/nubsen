import { useCallback, useEffect, useState } from 'react'
import * as api from '../api'
import { tambahAntrean, adalahGalatJaringan } from '../utils/luring'

// Hanya untuk tampilan UI & fallback; validasi status authoritative di server.
export const JAM_MASUK_BATAS = '08:15'
// Batas jam masuk & jam pulang (fallback tampilan) + hari kerja 0 = Minggu … 6 = Sabtu.
// Sumber kebenaran tetap GET /api/jadwal (dapat diubah admin pada tab Jadwal).
export const JADWAL_DEFAULT = { mode: 'biasa', jamMasukBatas: '08:15', jamPulang: '17:00', hariKerja: [1, 2, 3, 4, 5], shift: null, izinAktif: null }

// Fallback profil saat server tidak terjangkau (tampilan tetap informatif).
export const USER_DEFAULT = {
  nama: 'Afriani Putri',
  nip: 'EMP-2024-0187',
  jabatan: 'Frontend Developer',
  departemen: 'Teknologi Informasi',
  email: 'afriani.putri@perusahaan.co.id',
  telepon: '+62 812-3456-7890',
  lokasiKerja: 'Kantor Pusat — Kelapa Gading, Jakarta Utara',
  avatar: null,
  statusKaryawan: 'Karyawan Tetap',
  cutiTahunan: 12,
  cutiTerpakai: 0,
  cutiDisetujui: 0,
  cutiMenunggu: 0,
  sisaCuti: 12,
  peringatan: [],
}

// Hook utama state absensi — bersumber dari REST API (Express + SQLite).
// `enabled` = false saat pengguna belum login (jangan fetch apa pun).
export function useAbsensi(enabled = true) {
  const [state, setState] = useState({
    user: null, today: null, history: [], loading: enabled, error: null,
    jadwal: JADWAL_DEFAULT, // jadwal kerja aktif dari server (dapat diubah admin)
  })

  const muat = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const [user, today, history, jadwal] = await Promise.all([
        api.getProfile(),
        api.getToday(),
        api.getHistory(),
        api.getJadwal().catch(() => JADWAL_DEFAULT),
      ])
      setState({ user, today, history, loading: false, error: null, jadwal: jadwal || JADWAL_DEFAULT })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }))
    }
  }, [])

  useEffect(() => {
    if (enabled) muat()
    else setState({ user: null, today: null, history: [], loading: false, error: null, jadwal: JADWAL_DEFAULT })
  }, [enabled, muat])

  // Setelah mutasi (absen/izin), segarkan data secara latar belakang. PROFIL ikut
  // dimuat ulang supaya sisa cuti tahunan & data slip gaji di menu Profil
  // langsung berkurang/terbarui tanpa perlu menutup aplikasi.
  const segarkan = useCallback(async () => {
    try {
      const [profil, today, history] = await Promise.all([
        api.getProfile(),
        api.getToday(),
        api.getHistory(),
      ])
      setState((s) => ({ ...s, user: profil || s.user, today, history }))
    } catch {
      /* biarkan data lama; error sudah ditangani pemanggil */
    }
  }, [])

  // Mutasi absen: bila server tak terjangkau → masuk ANTRIAN LURING (lihat
  // utils/luring.js) dan terapkan optimistik di UI, lalu tersinkron otomatis
  // saat kembali online. Mengembalikan { luring: true } sebagai penanda.
  const catatCheckIn = useCallback(
    async ({ jam, lokasi, selfie }) => {
      try {
        const rec = await api.checkIn({ jam, lokasi, selfie })
        setState((s) => ({ ...s, today: rec }))
        segarkan()
        return rec
      } catch (e) {
        if (adalahGalatJaringan(e)) {
          tambahAntrean('checkin', { jam, lokasi, selfie })
          setState((s) => ({
            ...s,
            today: { ...(s.today || { tanggal: '' }), checkIn: jam, status: 'Hadir', keterangan: '⏳ Menunggu sinkron (luring)', luring: true },
          }))
          return { luring: true }
        }
        throw e
      }
    },
    [segarkan],
  )

  const catatCheckOut = useCallback(
    async ({ jam, lokasi, selfie }) => {
      try {
        const rec = await api.checkOut({ jam, lokasi, selfie })
        setState((s) => ({ ...s, today: rec }))
        segarkan()
        return rec
      } catch (e) {
        if (adalahGalatJaringan(e)) {
          tambahAntrean('checkout', { jam, lokasi, selfie })
          setState((s) => ({
            ...s,
            today: { ...(s.today || { tanggal: '' }), checkOut: jam, keterangan: '⏳ Menunggu sinkron (luring)', luring: true },
          }))
          return { luring: true }
        }
        throw e
      }
    },
    [segarkan],
  )

  const ajukanIzin = useCallback(
    async (form) => {
      try {
        await api.createLeave(form)
        await segarkan()
        return { luring: false }
      } catch (e) {
        // Berkas lampiran aman mengantre: File disimpan di IndexedDB (bukan
        // localStorage) dan disambung kembali saat sinkron (lihat luring.js).
        if (adalahGalatJaringan(e)) {
          await tambahAntrean('izin', form)
          return { luring: true }
        }
        throw e
      }
    },
    [segarkan],
  )

  return { ...state, muatUlang: muat, segarkanData: segarkan, catatCheckIn, catatCheckOut, ajukanIzin }
}

import { useCallback, useEffect, useState } from 'react'
import * as api from '../api'

// Hanya untuk tampilan UI & fallback; validasi status authoritative di server.
export const JAM_MASUK_BATAS = '08:15'
export const JADWAL_DEFAULT = { jamMasukBatas: '08:15', jamPulang: '17:00' }

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

  // Setelah mutasi (absen/izin), segarkan data secara latar belakang.
  const segarkan = useCallback(async () => {
    try {
      const [today, history] = await Promise.all([api.getToday(), api.getHistory()])
      setState((s) => ({ ...s, today, history }))
    } catch {
      /* biarkan data lama; error sudah ditangani pemanggil */
    }
  }, [])

  const catatCheckIn = useCallback(
    async ({ jam, lokasi, selfie }) => {
      const rec = await api.checkIn({ jam, lokasi, selfie })
      setState((s) => ({ ...s, today: rec }))
      segarkan()
      return rec
    },
    [segarkan],
  )

  const catatCheckOut = useCallback(
    async ({ jam, lokasi, selfie }) => {
      const rec = await api.checkOut({ jam, lokasi, selfie })
      setState((s) => ({ ...s, today: rec }))
      segarkan()
      return rec
    },
    [segarkan],
  )

  const ajukanIzin = useCallback(
    async (form) => {
      await api.createLeave(form)
      await segarkan()
    },
    [segarkan],
  )

  return { ...state, muatUlang: muat, catatCheckIn, catatCheckOut, ajukanIzin }
}

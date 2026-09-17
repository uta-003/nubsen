import { toISODate } from './date'

// Streak hari hadir beruntun (Hadir/Terlambat tetap dihitung hadir; Minggu diliburkan).
export function hitungStreak(history = []) {
  const perTanggal = new Map(history.map((h) => [h.tanggal, h]))
  const hadir = (r) => r && (r.status === 'Hadir' || r.status === 'Terlambat')
  let streak = 0
  const d = new Date()
  if (!hadir(perTanggal.get(toISODate(d)))) d.setDate(d.getDate() - 1)
  for (;;) {
    if (d.getDay() === 0) {
      d.setDate(d.getDate() - 1)
      continue
    }
    if (hadir(perTanggal.get(toISODate(d)))) {
      streak++
      d.setDate(d.getDate() - 1)
    } else break
  }
  return streak
}

// Data 7 hari terakhir untuk grafik batang mini.
const LABEL_HARI = ['M', 'S', 'S', 'R', 'K', 'J', 'S'] // Min Sen Sel Rab Kam Jum Sab
export function tujuhHariTerakhir(history = []) {
  const perTanggal = new Map(history.map((h) => [h.tanggal, h]))
  const out = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const tanggal = toISODate(d)
    out.push({ tanggal, label: LABEL_HARI[d.getDay()], record: perTanggal.get(tanggal) || null })
  }
  return out
}

import { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, X } from 'lucide-react'

let timer
export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (toast) {
      clearTimeout(timer)
      timer = setTimeout(onClose, 2600)
    }
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  const GAYA = {
    success: { bg: 'bg-emerald-500', Icon: CheckCircle2 },
    error: { bg: 'bg-rose-500', Icon: AlertCircle },
    warn: { bg: 'bg-amber-500', Icon: AlertTriangle },
  }
  const { bg, Icon } = GAYA[toast.type] || GAYA.success
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),1rem)] z-50 mx-auto max-w-md px-4">
      <div className={`pointer-events-auto flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl animate-slide-up ${bg}`}>
        <Icon size={18} />
        <span className="flex-1">{toast.pesan}</span>
        <button onClick={onClose} aria-label="Tutup notifikasi">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

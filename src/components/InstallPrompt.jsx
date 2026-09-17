import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

const KEY_DITOLAK = 'absenku.installDismissed'

/**
 * Banner "Install App" — muncul ketika browser memicu beforeinstallprompt
 * (butuh manifest + service worker aktif; uji via `npm run build && npm run preview`).
 */
export default function InstallPrompt() {
  const [evt, setEvt] = useState(null)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      if (!localStorage.getItem(KEY_DITOLAK)) setEvt(e)
    }
    const onInstalled = () => setEvt(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!evt) return null

  return (
    <div className="card mb-4 flex animate-slide-up items-center gap-3 border border-indigo-200 !p-4 dark:border-indigo-500/30">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
        <Download size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Install NUBSEN</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tambahkan ke layar utama agar lebih cepat diakses.
        </p>
      </div>
      <button
        className="btn-primary !px-3.5 !py-2 text-xs"
        onClick={async () => {
          evt.prompt()
          setEvt(null)
        }}
      >
        Install
      </button>
      <button
        aria-label="Tutup"
        className="shrink-0 text-slate-400 hover:text-slate-600"
        onClick={() => {
          localStorage.setItem(KEY_DITOLAK, '1')
          setEvt(null)
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}

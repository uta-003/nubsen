import { Moon, Sun } from 'lucide-react'

export default function DarkModeToggle({ dark, toggle }) {
  return (
    <button
      onClick={toggle}
      aria-label="Ganti tema gelap/terang"
      className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white/80 text-slate-600 shadow-sm backdrop-blur transition active:scale-90 dark:border-slate-700 dark:bg-slate-900/80 dark:text-amber-300"
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )
}

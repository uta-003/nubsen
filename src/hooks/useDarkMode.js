import { useEffect, useState } from 'react'

const KEY = 'absenku.theme'

function preferensiSistem() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

// Dark mode: default mengikuti sistem, lalu bisa ditimpa via toggle.
export default function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem(KEY)
    return saved === null ? preferensiSistem() : saved === 'dark'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(KEY, dark ? 'dark' : 'light')
  }, [dark])

  return { dark, toggle: () => setDark((d) => !d) }
}

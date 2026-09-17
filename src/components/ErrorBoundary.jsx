import React from 'react'

// ErrorBoundary — mencegah "layar putih": error render apa pun ditangkap dan
// ditampilkan dengan ramah + tombol muat ulang, bukan halaman kosong.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('NUBSEN error:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-full place-items-center p-6">
          <div className="card max-w-sm text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-3xl bg-rose-100 text-2xl dark:bg-rose-500/15">
              ⚠️
            </div>
            <h1 className="text-base font-extrabold">Terjadi kesalahan tampilan</h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary mt-4 w-full"
            >
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

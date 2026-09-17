/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // NUBSEN brand — perpaduan navy dalam & biru lembut
        brand: { navy: '#0A1D57', blue: '#7E97CD', mid: '#46619A' },
        // Override palet lama (indigo/violet/fuchsia) agar semua komponen ikut rebrand otomatis
        indigo: {
          50: '#EEF2FA', 100: '#DCE5F3', 200: '#C7D5EC', 300: '#A9BEE0', 400: '#8FA9D4',
          500: '#7E97CD', 600: '#0A1D57', 700: '#081643', 800: '#061239', 900: '#050E2E',
        },
        violet: {
          50: '#EEF2FA', 100: '#DCE5F3', 200: '#C7D5EC', 300: '#A9BEE0', 400: '#8FA9D4',
          500: '#46619A', 600: '#0A1D57', 700: '#081643', 800: '#061239', 900: '#050E2E',
        },
        fuchsia: { 500: '#46619A', 600: '#5B77AB', 700: '#46619A' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: {
        soft: '0 8px 30px rgba(0,0,0,0.08)',
        glow: '0 0 0 0 rgba(99,102,241,0.5)',
      },
      animation: {
        'pulse-slow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn .35s ease-out',
        'slide-up': 'slideUp .35s ease-out',
        pop: 'pop .35s cubic-bezier(.34,1.56,.64,1)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(99,102,241,.45)' },
          '50%': { transform: 'scale(1.04)', boxShadow: '0 0 0 18px rgba(99,102,241,0)' },
        },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pop: {
          '0%': { transform: 'scale(.85)' },
          '60%': { transform: 'scale(1.07)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}

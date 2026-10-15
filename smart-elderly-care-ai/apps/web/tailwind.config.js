/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Theme: Sky Blue & White (Xanh da trời kết hợp Trắng)
      colors: {
        brand: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9', // Primary Sky Blue
          600: '#0284c7', // Deep Sky Blue
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        sky: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        navy: {
          800: '#142042',
          850: '#111c38',
          900: '#0b132b',
          950: '#070c1e',
        },
        slate: {
          750: '#1e293b',
          850: '#151e2e',
          900: '#0f172a',
          950: '#090d16',
        },
      },
      fontFamily: {
        heading: ['Fira Code', 'JetBrains Mono', 'monospace'],
        sans:    ['Fira Sans', 'Inter', 'sans-serif'],
        mono:    ['Fira Code', 'monospace'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        'glow-sky':   '0 0 20px -4px rgba(14,165,233,0.4)',
        'glow-brand': '0 0 20px -4px rgba(14,165,233,0.4)',
        'glow-amber': '0 0 20px -4px rgba(245,158,11,0.4)',
        'glow-rose':  '0 0 20px -4px rgba(239,68,68,0.35)',
        'card-light': '0 2px 10px -2px rgba(14,165,233,0.08), 0 1px 3px rgba(0,0,0,0.04)',
        'card-dark':  '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      animation: {
        'fade-in':       'fadeIn 0.2s ease-out',
        'slide-up':      'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}

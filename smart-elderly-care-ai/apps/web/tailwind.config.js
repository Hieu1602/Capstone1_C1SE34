/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Modern Enterprise Orange-First Brand Identity
        brand: {
          50:  '#FFF0E8',
          100: '#FFE2D4',
          200: '#FFC4A8',
          300: '#FFA175',
          400: '#FF824D',
          500: '#F05A24', // Deeper, Richer Primary Orange
          600: '#FF7037', // Orange Hover (Dark Mode)
          700: '#D94814', // Primary Hover (Light Mode)
          800: '#B8380A', // Orange Active
          900: '#9E3312',
          950: '#4D1707',
        },
        enterprise: {
          page:     '#F5F6F8',
          card:     '#FFFFFF',
          sidebar:  '#17191D',
          text:     '#191B20',
          muted:    '#737780',
          border:   '#E7E9ED',
        },
        // Premium Soft Titanium-Charcoal Metallic + Rich Orange Dark Mode System
        darkMetal: {
          bg:       '#12151C', // Softened charcoal-slate, not pure pitch-black
          sidebar:  '#161922',
          card:     '#1D222D',
          elevated: '#242936',
          hover:    '#2C3342',
          silver:   '#8B95A5',
          border:   '#323846',
          textMain: '#F1F3F7',
          textSec:  '#9DA5B4',
          textMuted:'#6C7586',
          orange:   '#F05A24',
          orangeHover: '#FF7037',
          orangeActive: '#D94814',
        },
        semantic: {
          success:  '#22C55E',
          warning:  '#FBBF24',
          danger:   '#EF4444',
          info:     '#38BDF8',
        },
      },
      fontFamily: {
        heading: ['Plus Jakarta Sans', 'Be Vietnam Pro', 'Inter', 'sans-serif'],
        sans:    ['Plus Jakarta Sans', 'Inter', 'Be Vietnam Pro', 'system-ui', '-apple-system', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        // Light mode shadows (clean & restrained)
        'card-subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 4px 12px 0 rgba(0, 0, 0, 0.03)',
        'card-hover':  '0 6px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
        // Dark metallic shadows & orange rim lighting
        'dark-metal-card': 'inset 0 1px 0 0 rgba(119, 127, 139, 0.18), inset 0 0 0 1px rgba(255, 255, 255, 0.02), 0 8px 24px rgba(0, 0, 0, 0.45)',
        'dark-metal-hover': 'inset 0 1px 0 0 rgba(119, 127, 139, 0.35), 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 16px rgba(255, 107, 53, 0.18)',
        'dark-orange-glow': '0 0 16px rgba(255, 107, 53, 0.18)',
      },
      animation: {
        'fade-in':       'fadeIn 0.2s ease-out',
        'slide-up':      'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'metal-shine':   'metalShine 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        metalShine: {
          '0%': { transform: 'translateX(-100%)' },
          '50%, 100%': { transform: 'translateX(200%)' },
        },
      },
    },
  },
  plugins: [],
}

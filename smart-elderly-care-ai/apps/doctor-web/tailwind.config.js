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
        // Clinical Care Blue (Đồng bộ với Mobile Doctor App)
        clinical: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#2563EB', // Royal/Clinical Blue chủ đạo
          600: '#1D4ED8', // Darker blue cho gradient & hover
          700: '#1E40AF',
          800: '#1E3A8A',
          900: '#172554',
        },
        // Nền và thẻ y tế nhã nhặn
        medical: {
          bg: '#F8FAFC',        // Slate-50 rất dịu mắt
          card: '#FFFFFF',      // Nền trắng tinh khiết
          subtle: '#F1F5F9',    // Nền phụ
          border: '#E2E8F0',    // Viền mảnh
          borderLight: '#F1F5F9',
          text: '#0F172A',      // Chữ chính Slate-900
          textMuted: '#64748B', // Chữ phụ Slate-500
          textLight: '#94A3B8', // Chữ mờ Slate-400
        },
        // Trạng thái lâm sàng
        health: {
          stable: '#10B981',    // Xanh lá: ổn định
          stableBg: '#ECFDF5',
          warning: '#F59E0B',   // Vàng cam: cần chú ý
          warningBg: '#FEF3C7',
          critical: '#EF4444',  // Đỏ: cảnh báo nguy hiểm / SOS
          criticalBg: '#FEF2F2',
          info: '#0284C7',
          infoBg: '#F0F9FF',
        },
      },
      fontFamily: {
        heading: ['Plus Jakarta Sans', 'Be Vietnam Pro', 'Inter', 'sans-serif'],
        sans: ['Plus Jakarta Sans', 'Inter', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        'clinical-card': '0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 4px 12px 0 rgba(15, 23, 42, 0.03)',
        'clinical-hover': '0 6px 20px -2px rgba(37, 99, 235, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
        'banner-blue': '0 10px 25px -5px rgba(37, 99, 235, 0.3), 0 8px 10px -6px rgba(37, 99, 235, 0.2)',
      },
    },
  },
  plugins: [],
}


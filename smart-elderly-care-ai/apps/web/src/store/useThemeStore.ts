// src/store/useThemeStore.ts - Light/Dark mode state

import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: localStorage.getItem('seca_theme') === 'dark',
  toggleTheme: () =>
    set((state) => {
      const next = !state.isDark;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('seca_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('seca_theme', 'light');
      }
      return { isDark: next };
    }),
}));

// Initialize theme on load
if (localStorage.getItem('seca_theme') === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}


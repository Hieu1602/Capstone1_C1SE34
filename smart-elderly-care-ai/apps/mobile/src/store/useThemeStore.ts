// src/store/useThemeStore.ts
// Quản lý trạng thái Light / Dark Theme toàn cục cho hệ thống Smart Elderly Care AI

import { create } from 'zustand';

export interface ThemeColors {
  background: string;
  card: string;
  surface: string;
  surfaceSubtle: string;
  text: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryLight: string;
  headerBg: string;
  subText: string;
  iconBg: string;
  inputBg: string;
}

export const lightTheme: ThemeColors = {
  background: '#F8FAFC',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  text: '#0F172A',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  primary: '#FF7A00',
  primaryLight: '#FFF7ED',
  headerBg: '#FFFFFF',
  subText: '#64748B',
  iconBg: '#F1F5F9',
  inputBg: '#F8FAFC',
};

export const darkTheme: ThemeColors = {
  background: '#0B0F19',
  card: '#1E293B',
  surface: '#1E293B',
  surfaceSubtle: '#162032',
  text: '#F8FAFC',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#94A3B8',
  border: '#334155',
  primary: '#FF7A00',
  primaryLight: 'rgba(255, 122, 0, 0.15)',
  headerBg: '#1E293B',
  subText: '#94A3B8',
  iconBg: '#334155',
  inputBg: '#1E293B',
};

interface ThemeState {
  isDarkMode: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDarkMode: false,
  colors: lightTheme,
  toggleTheme: () =>
    set((state) => {
      const next = !state.isDarkMode;
      return {
        isDarkMode: next,
        colors: next ? darkTheme : lightTheme,
      };
    }),
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.isDarkMode;
      return {
        isDarkMode: next,
        colors: next ? darkTheme : lightTheme,
      };
    }),
  setDarkMode: (isDark) =>
    set({
      isDarkMode: isDark,
      colors: isDark ? darkTheme : lightTheme,
    }),
}));

export const useTheme = () => {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const colors = useThemeStore((s) => s.colors);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const toggleDarkMode = useThemeStore((s) => s.toggleDarkMode);
  const setDarkMode = useThemeStore((s) => s.setDarkMode);
  return { isDarkMode, colors, toggleTheme, toggleDarkMode, setDarkMode };
};

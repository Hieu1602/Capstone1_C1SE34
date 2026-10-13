// src/store/useThemeStore.ts
// Quản lý trạng thái Light / Dark Theme toàn cục cho hệ thống Smart Elderly Care AI (Persisted)

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export function createThemeStyles<T extends object>(
  baseStyles: T,
  isDarkMode: boolean,
  colors: ThemeColors,
): T {
  if (!isDarkMode) return baseStyles;

  return Object.fromEntries(
    Object.entries(baseStyles).map(([styleName, style]) => {
      if (!style || typeof style !== 'object') return [styleName, style];

      const darkStyle = { ...(style as Record<string, unknown>) };
      for (const [key, value] of Object.entries(darkStyle)) {
        if (key === 'backgroundColor' && typeof value === 'string') {
          if (['#FFF', '#FFFFFF', '#FFFBF7'].includes(value)) {
            darkStyle[key] = colors.card;
          } else if (value === '#F8FAFC') {
            darkStyle[key] = colors.background;
          } else if (value === '#F1F5F9') {
            darkStyle[key] = colors.surfaceSubtle;
          } else if (['#FFF7ED', '#FFF4EC', '#FFEDD5', '#FEF2F2', '#ECFDF5', '#E0F2FE', '#FAF5FF', '#DCFCE7'].includes(value)) {
            darkStyle[key] = colors.surfaceSubtle;
          }
        } else if (key === 'color' && typeof value === 'string') {
          if (['#0F172A', '#1E293B'].includes(value)) {
            darkStyle[key] = colors.textPrimary;
          } else if (['#334155', '#475569', '#64748B'].includes(value)) {
            darkStyle[key] = colors.textSecondary;
          }
        } else if (
          ['borderColor', 'borderBottomColor', 'borderTopColor'].includes(key) &&
          ['#E2E8F0', '#F1F5F9'].includes(String(value))
        ) {
          darkStyle[key] = colors.border;
        }
      }

      return [styleName, darkStyle];
    }),
  ) as T;
}

interface ThemeState {
  isDarkMode: boolean;
  colors: ThemeColors;
  fontScale: number;
  fontSizeMode: 'system' | 'custom';
  toggleTheme: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
  setFontScale: (scale: number) => void;
  setFontSizeMode: (mode: 'system' | 'custom') => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDarkMode: false,
      colors: lightTheme,
      fontScale: 1,
      fontSizeMode: 'system',
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
      setDarkMode: (isDark: boolean) =>
        set({
          isDarkMode: isDark,
          colors: isDark ? darkTheme : lightTheme,
        }),
      setFontScale: (scale: number) =>
        set({
          fontScale: Math.min(Math.max(scale, 0.8), 1.8),
        }),
      setFontSizeMode: (fontSizeMode: 'system' | 'custom') => set({ fontSizeMode }),
    }),
    {
      name: 'smartcare-theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        fontScale: state.fontScale,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.colors = state.isDarkMode ? darkTheme : lightTheme;
          state.setFontScale(1);
          state.setFontSizeMode('system');
        }
      },
    }
  )
);

export const useTheme = () => {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const colors = useThemeStore((s) => s.colors);
  const fontScale = useThemeStore((s) => s.fontScale);
  const fontSizeMode = useThemeStore((s) => s.fontSizeMode);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const toggleDarkMode = useThemeStore((s) => s.toggleDarkMode);
  const setDarkMode = useThemeStore((s) => s.setDarkMode);
  const setFontScale = useThemeStore((s) => s.setFontScale);
  const setFontSizeMode = useThemeStore((s) => s.setFontSizeMode);
  return {
    isDarkMode,
    colors,
    fontScale,
    fontSizeMode,
    toggleTheme,
    toggleDarkMode,
    setDarkMode,
    setFontScale,
    setFontSizeMode,
  };
};

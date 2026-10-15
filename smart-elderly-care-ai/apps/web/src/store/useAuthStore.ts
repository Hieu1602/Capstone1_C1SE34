// src/store/useAuthStore.ts - Zustand store for Admin Auth

import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const savedToken = typeof window !== 'undefined' ? localStorage.getItem('seca_admin_token') : null;
const savedUser = typeof window !== 'undefined' ? localStorage.getItem('seca_admin_user') : null;

let initialUser: User | null = null;
let initialAuth = false;

if (savedUser && savedToken) {
  try {
    const parsed = JSON.parse(savedUser);
    if (parsed.role === 'admin') {
      initialUser = parsed;
      initialAuth = true;
    } else {
      localStorage.removeItem('seca_admin_token');
      localStorage.removeItem('seca_admin_user');
    }
  } catch {
    // Ignore parse error
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: initialAuth ? savedToken : null,
  user: initialUser,
  isAuthenticated: initialAuth,

  login: (token, user) => {
    localStorage.setItem('seca_admin_token', token);
    localStorage.setItem('seca_admin_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('seca_admin_token');
    localStorage.removeItem('seca_admin_user');
    set({ token: null, user: null, isAuthenticated: false });
  },
}));


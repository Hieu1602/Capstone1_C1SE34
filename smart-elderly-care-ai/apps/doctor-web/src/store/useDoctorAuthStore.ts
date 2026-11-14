// src/store/useDoctorAuthStore.ts
// Quản lý trạng thái xác thực và phân quyền riêng cho Bác Sĩ

import { create } from 'zustand';
import { DoctorUser } from '../types';
import { authApi } from '../services/api';

interface DoctorAuthState {
  token: string | null;
  user: DoctorUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: DoctorUser) => void;
  logout: () => void;
}

const savedToken = typeof window !== 'undefined' ? localStorage.getItem('seca_doctor_token') : null;
const savedUser = typeof window !== 'undefined' ? localStorage.getItem('seca_doctor_user') : null;

let initialUser: DoctorUser | null = null;
let initialAuth = false;

if (savedUser && savedToken) {
  try {
    const parsed = JSON.parse(savedUser);
    if (parsed.role === 'doctor') {
      initialUser = parsed;
      initialAuth = true;
    } else {
      localStorage.removeItem('seca_doctor_token');
      localStorage.removeItem('seca_doctor_user');
    }
  } catch {
    localStorage.removeItem('seca_doctor_token');
    localStorage.removeItem('seca_doctor_user');
  }
}

export const useDoctorAuthStore = create<DoctorAuthState>((set) => ({
  token: initialAuth ? savedToken : null,
  user: initialUser,
  isAuthenticated: initialAuth,

  login: (token: string, user: DoctorUser) => {
    localStorage.setItem('seca_doctor_token', token);
    localStorage.setItem('seca_doctor_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    authApi.logout().catch(() => {});
    localStorage.removeItem('seca_doctor_token');
    localStorage.removeItem('seca_doctor_user');
    set({ token: null, user: null, isAuthenticated: false });
  },
}));


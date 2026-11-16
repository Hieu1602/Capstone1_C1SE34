// src/store/useDoctorAuthStore.ts
// Quản lý trạng thái xác thực và phân quyền riêng cho Bác Sĩ

import { create } from 'zustand';
import { DoctorUser } from '../types';
import { authApi } from '../services/api';
import { doctorWebSocket } from '../services/websocket';
import { useDoctorDataStore } from './useDoctorDataStore';

interface DoctorAuthState {
  token: string | null;
  user: DoctorUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: DoctorUser) => void;
  updateUser: (partial: Partial<DoctorUser>) => void;
  logout: () => void;
}

export const getDoctorAvatarUri = (userAvatar?: string | null): string | null => {
  try {
    const saved = localStorage.getItem('seca_doctor_profile_custom');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && 'avatarUri' in parsed) {
        return parsed.avatarUri || null;
      }
    }
  } catch {}
  return userAvatar || null;
};

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

  updateUser: (partial: Partial<DoctorUser>) => {
    set((state) => {
      if (!state.user) return state;
      const updatedUser = { ...state.user, ...partial };
      localStorage.setItem('seca_doctor_user', JSON.stringify(updatedUser));
      return { user: updatedUser };
    });
  },

  logout: () => {
    try {
      doctorWebSocket.disconnect();
      useDoctorDataStore.getState().clearCache();
    } catch {}
    authApi.logout().catch(() => {});
    localStorage.removeItem('seca_doctor_token');
    localStorage.removeItem('seca_doctor_user');
    set({ token: null, user: null, isAuthenticated: false });
  },
}));


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

const resolveWebAvatarUrl = (raw?: string | null): string | null => {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  const apiBase = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname || 'localhost'}:8000/api/v1`;
  const origin = apiBase.replace(/\/api\/v1\/?$/, '');
  return `${origin}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
};

export const getDoctorAvatarUri = (userAvatar?: string | null): string | null => {
  // Ưu tiên avatar_url từ Backend DB khi đã có dữ liệu tài khoản để đồng bộ với Mobile App
  if (userAvatar !== undefined) {
    return resolveWebAvatarUrl(userAvatar);
  }
  try {
    const saved = localStorage.getItem('seca_doctor_profile_custom');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && 'avatarUri' in parsed) {
        return resolveWebAvatarUrl(parsed.avatarUri);
      }
    }
  } catch {}
  return null;
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
      if ('avatar_url' in partial) {
        try {
          const saved = localStorage.getItem('seca_doctor_profile_custom');
          if (saved) {
            const parsed = JSON.parse(saved);
            localStorage.setItem('seca_doctor_profile_custom', JSON.stringify({ ...parsed, avatarUri: partial.avatar_url || null }));
          }
        } catch {}
      }
      return { user: updatedUser };
    });
  },

  logout: () => {
    const currentUser = useDoctorAuthStore.getState().user;
    try {
      doctorWebSocket.disconnect();
      useDoctorDataStore.getState().clearCache();
    } catch {}
    authApi.logout(currentUser?.full_name, currentUser?.role || 'doctor').catch(() => {});
    set({ token: null, user: null, isAuthenticated: false });
  },
}));


// useAuthStore.ts
// Zustand store cho Authentication & User Profile (persisted)

import { create, StateCreator } from 'zustand';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuthStoreState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  userPhone: string | null;
  userName: string | null;
  userRole: 'user' | 'doctor' | 'admin' | null;
  viewRole: 'CAREGIVER' | 'DOCTOR';

  login: (access: string, refreshOrName?: string, name?: string, userId?: string, phone?: string, role?: string) => void;
  setTokens: (access: string, refresh: string) => void;
  setUser: (id: string, phone?: string, name?: string, role?: string) => void;
  updateUserName: (nameOrId: string, name?: string) => void;
  setViewRole: (role: 'CAREGIVER' | 'DOCTOR') => void;
  toggleViewRole: () => void;
  logout: () => void;
}

type AuthSet = (
  partial:
    | AuthStoreState
    | Partial<AuthStoreState>
    | ((state: AuthStoreState) => AuthStoreState | Partial<AuthStoreState>),
  replace?: boolean
) => void;

const createAuthStore: StateCreator<AuthStoreState, [], [['zustand/persist', AuthStoreState]]> = (
  set: AuthSet
) => ({
  accessToken: null,
  refreshToken: null,
  userId: null,
  userPhone: null,
  userName: null,
  userRole: null,
  viewRole: 'CAREGIVER',

  login: (access: string, refreshOrName?: string, name?: string, userId?: string, phone?: string, role?: string) => {
    let resolvedRole: 'user' | 'doctor' | 'admin' = (role as any) || 'user';
    let resolvedPhone = phone || '';
    let resolvedName = name || refreshOrName || '';

    if (
      resolvedPhone.includes('111222') ||
      resolvedName.includes('Bác sĩ') ||
      resolvedName.includes('BS.') ||
      role === 'doctor'
    ) {
      resolvedRole = 'doctor';
    }

    const defaultView = resolvedRole === 'doctor' ? 'DOCTOR' : 'CAREGIVER';

    if (userId !== undefined) {
      set({
        accessToken: access,
        refreshToken: refreshOrName ?? null,
        userName: name ?? null,
        userId: userId,
        userPhone: phone ?? null,
        userRole: resolvedRole,
        viewRole: defaultView,
      });
    } else {
      set({
        accessToken: access,
        refreshToken: access,
        userName: refreshOrName ?? null,
        userId: name ?? null,
        userPhone: (userId as any) ?? null,
        userRole: resolvedRole,
        viewRole: defaultView,
      });
    }
  },

  setTokens: (access: string, refresh: string) =>
    set({ accessToken: access, refreshToken: refresh }),

  setUser: (id: string, phone?: string, name?: string, role?: string) =>
    set((state) => {
      const uRole = (role as any) || state.userRole || 'user';
      return {
        userId: id,
        userPhone: phone ?? state.userPhone ?? null,
        userName: name ?? state.userName ?? null,
        userRole: uRole,
        viewRole: uRole === 'doctor' ? 'DOCTOR' : state.viewRole,
      };
    }),

  updateUserName: (nameOrId: string, name?: string) => {
    if (name !== undefined) {
      set({ userId: nameOrId, userName: name });
    } else {
      set({ userName: nameOrId });
    }
  },

  setViewRole: (role: 'CAREGIVER' | 'DOCTOR') => set({ viewRole: role }),

  toggleViewRole: () =>
    set((state) => ({
      viewRole: state.viewRole === 'DOCTOR' ? 'CAREGIVER' : 'DOCTOR',
    })),

  logout: () =>
    set({
      accessToken: null,
      refreshToken: null,
      userId: null,
      userPhone: null,
      userName: null,
      userRole: null,
      viewRole: 'CAREGIVER',
    }),
});

const persistOptions: PersistOptions<AuthStoreState> = {
  name: 'auth-storage',
  storage: createJSONStorage(() => AsyncStorage),
};

export const useAuthStore = create<AuthStoreState>()(
  persist(createAuthStore, persistOptions)
);

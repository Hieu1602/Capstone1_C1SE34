// useAuthStore.ts
// Zustand store cho Authentication & User Profile (persisted)

import { create, StateCreator } from 'zustand';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuthStoreState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;

  login: (token: string, name: string, userId: string, email?: string) => void;
  setTokens: (access: string, refresh: string) => void;
  setUser: (id: string, email: string, name: string) => void;
  updateUserName: (id: string, name: string) => void;
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
  userEmail: null,
  userName: null,

  login: (token: string, name: string, userId: string, email?: string) =>
    set({
      accessToken: token,
      refreshToken: token,
      userId,
      userEmail: email ?? null,
      userName: name,
    }),

  setTokens: (access: string, refresh: string) =>
    set({ accessToken: access, refreshToken: refresh }),

  setUser: (id: string, email: string, name: string) =>
    set({ userId: id, userEmail: email, userName: name }),

  updateUserName: (id: string, name: string) =>
    set({ userId: id, userName: name }),

  logout: () =>
    set({
      accessToken: null,
      refreshToken: null,
      userId: null,
      userEmail: null,
      userName: null,
    }),
});

const persistOptions: PersistOptions<AuthStoreState> = {
  name: 'auth-storage',
  storage: createJSONStorage(() => AsyncStorage),
};

export const useAuthStore = create<AuthStoreState>()(
  persist(createAuthStore, persistOptions)
);

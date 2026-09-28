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

  login: (access: string, refreshOrName?: string, name?: string, userId?: string, email?: string) => void;
  setTokens: (access: string, refresh: string) => void;
  setUser: (id: string, email?: string, name?: string) => void;
  updateUserName: (nameOrId: string, name?: string) => void;
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

  login: (access: string, refreshOrName?: string, name?: string, userId?: string, email?: string) => {
    if (userId !== undefined) {
      set({
        accessToken: access,
        refreshToken: refreshOrName ?? null,
        userName: name ?? null,
        userId: userId,
        userEmail: email ?? null,
      });
    } else {
      set({
        accessToken: access,
        refreshToken: access,
        userName: refreshOrName ?? null,
        userId: name ?? null,
        userEmail: (userId as any) ?? null,
      });
    }
  },

  setTokens: (access: string, refresh: string) =>
    set({ accessToken: access, refreshToken: refresh }),

  setUser: (id: string, email?: string, name?: string) =>
    set((state) => ({
      userId: id,
      userEmail: email ?? state.userEmail ?? null,
      userName: name ?? state.userName ?? null,
    })),

  updateUserName: (nameOrId: string, name?: string) => {
    if (name !== undefined) {
      set({ userId: nameOrId, userName: name });
    } else {
      set({ userName: nameOrId });
    }
  },

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

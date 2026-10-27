// useAuthStore.ts
// Zustand store cho Authentication & User Profile (persisted)

import { create, StateCreator } from 'zustand';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuthStoreState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  user_id: number | string | null;
  userPhone: string | null;
  phone_number: string | null;
  userName: string | null;
  full_name: string | null;
  userRole: 'user' | 'doctor' | 'admin' | string | null;
  role: string | null;
  avatarUrl: string | null;
  avatar_url: string | null;
  household_id: number | string | null;
  viewRole: 'CAREGIVER' | 'DOCTOR';
  isHydrated: boolean;
  isRoleLoading: boolean;

  login: (
    access: string,
    refresh: string,
    name: string,
    userId: string | number,
    phone: string,
    role: string,
    householdId?: number | string,
    avatarUrl?: string | null
  ) => void;
  setTokens: (access: string, refresh: string) => void;
  setUser: (id: string | number, phone?: string, name?: string, role?: string, householdId?: number | string) => void;
  setProfile: (profile: {
    user_id?: number | string;
    full_name?: string;
    phone_number?: string;
    role?: string;
    household_id?: number | string;
    avatar_url?: string | null;
  }) => void;
  setAvatar: (url: string | null) => void;
  updateUserName: (nameOrId: string, name?: string) => void;
  setViewRole: (role: 'CAREGIVER' | 'DOCTOR') => void;
  setIsRoleLoading: (loading: boolean) => void;
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
  user_id: null,
  userPhone: null,
  phone_number: null,
  userName: null,
  full_name: null,
  userRole: null,
  role: null,
  avatarUrl: null,
  avatar_url: null,
  household_id: null,
  viewRole: 'CAREGIVER',
  isHydrated: false,
  isRoleLoading: false,

  setIsRoleLoading: (loading: boolean) => set({ isRoleLoading: loading }),

  login: (
    access: string,
    refresh: string,
    name: string,
    userId: string | number,
    phone: string,
    role: string,
    householdId?: number | string,
    avatarUrl?: string | null
  ) => {
    const normalizedRole = role.toLowerCase();
    const isDoctor = normalizedRole === 'doctor' || normalizedRole.includes('bác sĩ');
    const isAdmin = normalizedRole === 'admin' || normalizedRole.includes('quản trị');

    set({
      accessToken: access,
      refreshToken: refresh,
      userId: String(userId),
      user_id: Number.isNaN(Number(userId)) ? userId : Number(userId),
      userName: name,
      full_name: name,
      userPhone: phone,
      phone_number: phone,
      userRole: isDoctor ? 'doctor' : isAdmin ? 'admin' : 'user',
      role,
      avatarUrl: avatarUrl ?? null,
      avatar_url: avatarUrl ?? null,
      household_id: householdId ?? null,
      viewRole: isDoctor ? 'DOCTOR' : 'CAREGIVER',
    });
  },

  setTokens: (access: string, refresh: string) =>
    set({ accessToken: access, refreshToken: refresh }),

  setUser: (id: string | number, phone?: string, name?: string, role?: string, householdId?: number | string) =>
    set((state) => {
      const resolvedRole = role ?? state.role;
      const normalizedRole = resolvedRole?.toLowerCase() ?? '';
      const isDoctor = normalizedRole === 'doctor' || normalizedRole.includes('bác sĩ');
      const isAdmin = normalizedRole === 'admin' || normalizedRole.includes('quản trị');
      return {
        userId: String(id),
        user_id: isNaN(Number(id)) ? id : Number(id),
        userPhone: phone ?? state.userPhone ?? null,
        phone_number: phone ?? state.phone_number ?? null,
        userName: name ?? state.userName ?? null,
        full_name: name ?? state.full_name ?? null,
        userRole: isDoctor ? 'doctor' : isAdmin ? 'admin' : resolvedRole ? 'user' : state.userRole,
        role: resolvedRole ?? null,
        household_id: householdId ?? state.household_id ?? null,
        viewRole: isDoctor ? 'DOCTOR' : isAdmin || resolvedRole ? 'CAREGIVER' : state.viewRole,
      };
    }),

  setProfile: (profile) =>
    set((state) => ({
      user_id: profile.user_id !== undefined ? profile.user_id : state.user_id,
      userId: profile.user_id !== undefined ? String(profile.user_id) : state.userId,
      full_name: profile.full_name || state.full_name,
      userName: profile.full_name || state.userName,
      phone_number: profile.phone_number || state.phone_number,
      userPhone: profile.phone_number || state.userPhone,
      avatarUrl: profile.avatar_url !== undefined ? profile.avatar_url : state.avatarUrl,
      avatar_url: profile.avatar_url !== undefined ? profile.avatar_url : state.avatar_url,
      role: profile.role || state.role,
      userRole: profile.role?.toLowerCase() === 'doctor' || profile.role?.includes('Bác sĩ')
        ? 'doctor'
        : profile.role?.toLowerCase() === 'admin'
          ? 'admin'
          : profile.role
            ? 'user'
            : state.userRole,
      household_id: profile.household_id !== undefined ? profile.household_id : state.household_id,
      viewRole: profile.role?.toLowerCase() === 'doctor' || profile.role?.includes('Bác sĩ')
        ? 'DOCTOR'
        : profile.role
          ? 'CAREGIVER'
          : state.viewRole,
    })),

  setAvatar: (url: string | null) =>
    set({ avatarUrl: url, avatar_url: url }),

  updateUserName: (nameOrId: string, name?: string) => {
    if (name !== undefined) {
      set({ userId: nameOrId, user_id: nameOrId, userName: name, full_name: name });
    } else {
      set({ userName: nameOrId, full_name: nameOrId });
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
      user_id: null,
      userPhone: null,
      phone_number: null,
      userName: null,
      full_name: null,
      userRole: null,
      role: null,
      avatarUrl: null,
      avatar_url: null,
      household_id: null,
      viewRole: 'CAREGIVER',
    }),
});

const persistOptions: PersistOptions<AuthStoreState> = {
  name: 'auth-storage',
  storage: createJSONStorage(() => AsyncStorage),
  version: 1,
  partialize: (state) => ({
    ...state,
    isRoleLoading: false,
    isHydrated: false,
  }),
  onRehydrateStorage: () => () => {
    useAuthStore.setState({ isHydrated: true });
  },
  migrate: (persistedState) => {
    const state = persistedState as AuthStoreState;
    if (!state.accessToken?.startsWith('fake-')) {
      return state;
    }
    return {
      ...state,
      accessToken: null,
      refreshToken: null,
      userId: null,
      user_id: null,
      userPhone: null,
      phone_number: null,
      userName: null,
      full_name: null,
      userRole: null,
      role: null,
      avatarUrl: null,
      avatar_url: null,
      household_id: null,
      viewRole: 'CAREGIVER',
    };
  },
};

export const useAuthStore = create<AuthStoreState>()(
  persist(createAuthStore, persistOptions)
);

if (useAuthStore.persist?.hasHydrated?.()) {
  useAuthStore.setState({ isHydrated: true });
}

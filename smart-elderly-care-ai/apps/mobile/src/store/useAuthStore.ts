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
  household_id: number | string | null;
  viewRole: 'CAREGIVER' | 'DOCTOR';

  login: (
    access: string,
    refreshOrName?: string,
    name?: string,
    userId?: string | number,
    phone?: string,
    role?: string,
    householdId?: number | string
  ) => void;
  setTokens: (access: string, refresh: string) => void;
  setUser: (id: string | number, phone?: string, name?: string, role?: string, householdId?: number | string) => void;
  setProfile: (profile: {
    user_id?: number | string;
    full_name?: string;
    phone_number?: string;
    role?: string;
    household_id?: number | string;
  }) => void;
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
  accessToken: 'fake-jwt-token-demo-smartcare',
  refreshToken: 'fake-jwt-refresh-token-demo',
  userId: '1',
  user_id: 1,
  userPhone: '0905123456',
  phone_number: '0905123456',
  userName: 'Nguyễn Hữu Nghĩa',
  full_name: 'Nguyễn Hữu Nghĩa',
  userRole: 'user',
  role: 'Chủ nhà / Người sở hữu',
  household_id: 1,
  viewRole: 'CAREGIVER',

  login: (
    access: string,
    refreshOrName?: string,
    name?: string,
    userId?: string | number,
    phone?: string,
    role?: string,
    householdId?: number | string
  ) => {
    let resolvedName = name || refreshOrName || '';
    let resolvedPhone = phone || (typeof userId === 'string' && userId.startsWith('0') ? userId : '');
    let resolvedUserId = userId !== undefined ? String(userId) : '1';
    let rawRole = role || '';

    const isDoctor =
      resolvedPhone.includes('888') ||
      resolvedPhone.includes('999') ||
      resolvedPhone.includes('111222') ||
      resolvedName.includes('Bác sĩ') ||
      resolvedName.includes('BS.') ||
      rawRole.toLowerCase().includes('doctor') ||
      rawRole.toLowerCase().includes('bác sĩ');

    const resolvedUserRole: 'user' | 'doctor' | 'admin' = isDoctor ? 'doctor' : 'user';
    const resolvedRoleTitle = isDoctor ? 'Bác sĩ phụ trách' : (role || 'Chủ nhà / Người sở hữu');
    const defaultView = isDoctor ? 'DOCTOR' : 'CAREGIVER';

    if (!resolvedName) {
      resolvedName = isDoctor ? 'BS. Nguyễn Văn Minh' : 'Nguyễn Hữu Nghĩa';
    }
    if (!resolvedPhone) {
      resolvedPhone = isDoctor ? '0905888999' : '0905123456';
    }

    set({
      accessToken: access,
      refreshToken: refreshOrName && refreshOrName.startsWith('fake-') ? refreshOrName : access,
      userId: resolvedUserId,
      user_id: isNaN(Number(resolvedUserId)) ? resolvedUserId : Number(resolvedUserId),
      userName: resolvedName,
      full_name: resolvedName,
      userPhone: resolvedPhone,
      phone_number: resolvedPhone,
      userRole: resolvedUserRole,
      role: resolvedRoleTitle,
      household_id: householdId !== undefined ? householdId : 1,
      viewRole: defaultView,
    });
  },

  setTokens: (access: string, refresh: string) =>
    set({ accessToken: access, refreshToken: refresh }),

  setUser: (id: string | number, phone?: string, name?: string, role?: string, householdId?: number | string) =>
    set((state) => {
      const uRole = (role as any) || state.userRole || 'user';
      const isDoctor = uRole === 'doctor' || String(role).includes('Bác sĩ');
      return {
        userId: String(id),
        user_id: isNaN(Number(id)) ? id : Number(id),
        userPhone: phone ?? state.userPhone ?? null,
        phone_number: phone ?? state.phone_number ?? null,
        userName: name ?? state.userName ?? null,
        full_name: name ?? state.full_name ?? null,
        userRole: isDoctor ? 'doctor' : 'user',
        role: role ?? state.role ?? (isDoctor ? 'Bác sĩ phụ trách' : 'Chủ nhà / Người sở hữu'),
        household_id: householdId ?? state.household_id ?? 1,
        viewRole: isDoctor ? 'DOCTOR' : state.viewRole,
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
      role: profile.role || state.role,
      userRole: profile.role?.includes('Bác sĩ') ? 'doctor' : 'user',
      household_id: profile.household_id !== undefined ? profile.household_id : state.household_id,
      viewRole: profile.role?.includes('Bác sĩ') ? 'DOCTOR' : state.viewRole,
    })),

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
      household_id: null,
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

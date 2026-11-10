// useAuthStore.ts
// Zustand store cho Authentication & User Profile (persisted)

import { create, StateCreator } from 'zustand';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HousePermissions {
  can_view_health: boolean;
  can_view_camera: boolean;
  can_handle_emergency: boolean;
  can_manage_devices: boolean;
  can_manage_records: boolean;
  role_in_house: string;
  is_owner: boolean;
}

export const selectIsOwner = (state: { userRole?: string | null; role?: string | null; permissions?: HousePermissions | null }): boolean => {
  return Boolean(
    state.userRole === 'admin' ||
    state.role === 'admin' ||
    state.userRole === 'owner' ||
    state.role === 'owner' ||
    state.permissions?.is_owner === true ||
    state.permissions?.role_in_house === 'OWNER'
  );
};

export const selectCanViewCamera = (state: { userRole?: string | null; role?: string | null; permissions?: HousePermissions | null }): boolean => {
  if (selectIsOwner(state)) return true;
  return Boolean(state.permissions?.can_view_camera);
};

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
  has_house: boolean | null;
  assigned_house: string | null;
  has_devices: boolean | null;
  device_count: number;
  viewRole: 'CAREGIVER' | 'DOCTOR';
  isHydrated: boolean;
  isRoleLoading: boolean;
  permissions: HousePermissions | null;

  login: (
    access: string,
    refresh: string,
    name: string,
    userId: string | number,
    phone: string,
    role: string,
    householdId?: number | string,
    avatarUrl?: string | null,
    profileExtras?: any
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
  fetchMyPermissions: (householdId?: number | string) => Promise<HousePermissions>;
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
  set: AuthSet,
  get
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
  has_house: null,
  assigned_house: null,
  has_devices: null,
  device_count: 0,
  viewRole: 'CAREGIVER',
  isHydrated: true,
  isRoleLoading: false,
  permissions: null,

  setIsRoleLoading: (loading: boolean) => set({ isRoleLoading: loading }),

  login: (
    access: string,
    refresh: string,
    name: string,
    userId: string | number,
    phone: string,
    role: string,
    householdId?: number | string,
    avatarUrl?: string | null,
    profileExtras?: any
  ) => {
    const normalizedRole = role.toLowerCase();
    const isDoctor = normalizedRole === 'doctor' || normalizedRole.includes('bác sĩ');
    const isAdmin = normalizedRole === 'admin' || normalizedRole.includes('quản trị');
    const isOwner = normalizedRole === 'owner' || profileExtras?.is_owner === true || profileExtras?.role_in_house === 'OWNER';

    // Chỉ reset domain stores khi chuyển đổi giữa 2 tài khoản khác nhau để tối ưu tốc độ và giữ cache
    const currentUserId = get().userId;
    if (currentUserId && String(currentUserId) !== String(userId)) {
      try {
        require('./useDeviceStore').useDeviceStore.getState().resetDeviceStore?.();
        require('./usePatientStore').usePatientStore.getState().resetPatientStore?.();
        require('./useHealthStore').useHealthStore.getState().resetHealthStore?.();
        require('./useAlertStore').useAlertStore.getState().resetAlertStore?.();
      } catch {}
    }

    const resolvedHouseId = householdId ?? profileExtras?.household_id ?? null;

    const isPrivileged = isAdmin || isOwner;
    const initialPermissions: HousePermissions = {
      can_view_health: profileExtras?.can_view_health ?? isPrivileged,
      can_view_camera: profileExtras?.can_view_camera ?? isPrivileged,
      can_handle_emergency: profileExtras?.can_handle_emergency ?? isPrivileged,
      can_manage_devices: profileExtras?.can_manage_devices !== undefined && profileExtras?.can_manage_devices !== null
        ? Boolean(profileExtras.can_manage_devices)
        : (isPrivileged || !resolvedHouseId),
      can_manage_records: profileExtras?.can_manage_records ?? isPrivileged,
      role_in_house: isDoctor ? 'DOCTOR' : (isPrivileged ? 'OWNER' : (profileExtras?.role_in_house || (resolvedHouseId ? 'MEMBER' : 'NEW_USER'))),
      is_owner: isPrivileged,
    };

    const hasHouse = profileExtras?.has_house ?? Boolean(resolvedHouseId);
    const assignedHouse = profileExtras?.assigned_house || (hasHouse ? 'Nhà của tôi' : null);
    const hasDevices = profileExtras?.has_devices ?? false;
    const deviceCount = profileExtras?.device_count ?? 0;

    set({
      accessToken: access,
      refreshToken: refresh,
      userId: String(userId),
      user_id: Number.isNaN(Number(userId)) ? userId : Number(userId),
      userName: name,
      full_name: name,
      userPhone: phone,
      phone_number: phone,
      userRole: isDoctor ? 'doctor' : isAdmin ? 'admin' : isOwner ? 'owner' : 'member',
      role,
      avatarUrl: avatarUrl ?? null,
      avatar_url: avatarUrl ?? null,
      household_id: resolvedHouseId,
      has_house: hasHouse,
      assigned_house: assignedHouse,
      has_devices: hasDevices,
      device_count: deviceCount,
      viewRole: isDoctor ? 'DOCTOR' : 'CAREGIVER',
      permissions: initialPermissions,
    });

    if (resolvedHouseId) {
      try {
        const devStore = require('./useDeviceStore').useDeviceStore.getState();
        devStore.setHouseInfo?.({
          id: String(resolvedHouseId),
          name: profileExtras?.assigned_house || 'Nhà của tôi',
          hasHouse: true,
        });
        if (profileExtras?.default_camera_id) {
          devStore.setCameraDefault?.({
            id: String(profileExtras.default_camera_id),
            name: profileExtras.default_camera_name || 'Camera AI',
            isOnline: true,
          });
        }
        devStore.fetchDevicesFromBackend?.().catch(() => {});
      } catch {}
    } else if (profileExtras?.has_house === false) {
      try {
        const devStore = require('./useDeviceStore').useDeviceStore.getState();
        devStore.resetDeviceStore?.();
      } catch {}
    }
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
        userRole: isDoctor ? 'doctor' : isAdmin ? 'admin' : resolvedRole ? 'member' : state.userRole,
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
          : profile.role?.toLowerCase() === 'owner'
            ? 'owner'
            : profile.role?.toLowerCase() === 'member'
              ? 'member'
              : profile.role
                ? 'member'
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

  fetchMyPermissions: async (hId?: number | string) => {
    const s = get();
    const isAdmin = s.userRole === 'admin' || s.role === 'admin';
    if (isAdmin) {
      const p: HousePermissions = {
        can_view_health: true,
        can_view_camera: true,
        can_handle_emergency: true,
        can_manage_devices: true,
        can_manage_records: true,
        role_in_house: 'OWNER',
        is_owner: true,
      };
      set({ permissions: p });
      return p;
    }
    try {
      const { householdApi } = await import('../services/api');
      const target = hId || s.household_id || 'current';
      const res = await householdApi.getMyPermissions(target);
      if (res.data) {
        const isOwner = res.data.role_in_house === 'OWNER' || res.data.is_owner === true;
        const p: HousePermissions = {
          can_view_health: isOwner ? true : Boolean(res.data.can_view_health),
          can_view_camera: isOwner ? true : Boolean(res.data.can_view_camera),
          can_handle_emergency: isOwner ? true : Boolean(res.data.can_handle_emergency),
          can_manage_devices: isOwner ? true : Boolean(res.data.can_manage_devices),
          can_manage_records: isOwner ? true : Boolean(res.data.can_manage_records),
          role_in_house: res.data.role_in_house || (isOwner ? 'OWNER' : 'MEMBER'),
          is_owner: isOwner,
        };
        const nextState: any = { permissions: p };
        if (res.data.house_id) {
          nextState.household_id = res.data.house_id;
          nextState.has_house = true;
        }
        if (isOwner) {
          nextState.userRole = 'owner';
        }
        set(nextState);
        return p;
      }
    } catch {}
    const def: HousePermissions = {
      can_view_health: false,
      can_view_camera: false,
      can_handle_emergency: true,
      can_manage_devices: true,
      can_manage_records: false,
      role_in_house: s.household_id ? 'MEMBER' : 'NEW_USER',
      is_owner: false,
    };
    set({ permissions: def });
    return def;
  },

  logout: () => {
    try {
      const state = get();
      const uName = state.userName || state.full_name || undefined;
      const uRole = state.userRole || state.role || undefined;
      import('../services/api')
        .then(({ authApi }) => {
          authApi.logout(uName, uRole);
        })
        .catch(() => {});
    } catch {}
    try {
      require('./useDeviceStore').useDeviceStore.getState().resetDeviceStore?.();
      require('./usePatientStore').usePatientStore.getState().resetPatientStore?.();
      require('./useHealthStore').useHealthStore.getState().resetHealthStore?.();
      require('./useAlertStore').useAlertStore.getState().resetAlertStore?.();
      AsyncStorage.multiRemove([
        'auth-storage',
        'device-store',
        'patient-store',
        'health-store',
        'alert-store',
      ]).catch(() => {});
    } catch {}
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
      has_house: null,
      assigned_house: null,
      has_devices: null,
      device_count: 0,
      viewRole: 'CAREGIVER',
      permissions: null,
    });
  },
});

const safeStorage = {
  getItem: async (name: string) => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string) => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch (err) {
      console.warn('[useAuthStore] AsyncStorage setItem warning (quota handled):', err);
    }
  },
  removeItem: async (name: string) => {
    try {
      await AsyncStorage.removeItem(name);
    } catch {}
  },
};

const persistOptions: PersistOptions<AuthStoreState> = {
  name: 'auth-storage',
  storage: createJSONStorage(() => safeStorage),
  version: 1,
  partialize: (state) => {
    const isBigAvatarUrl = Boolean(state.avatarUrl && state.avatarUrl.length > 5000);
    const isBigAvatar_url = Boolean(state.avatar_url && state.avatar_url.length > 5000);
    return {
      ...state,
      avatarUrl: isBigAvatarUrl ? null : state.avatarUrl,
      avatar_url: isBigAvatar_url ? null : state.avatar_url,
      isRoleLoading: false,
      isHydrated: true,
    };
  },
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
      has_house: null,
      assigned_house: null,
      has_devices: null,
      device_count: 0,
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

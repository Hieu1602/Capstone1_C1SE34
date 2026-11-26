import { create } from 'zustand';
import { doctorApi } from '../services/api';
import type { AppointmentItem } from '../features/doctor/components/types';

interface DoctorAppointmentsState {
  appointments: AppointmentItem[];
  loading: boolean;
  lastFetchedAt: number | null;
  fetchAppointments: () => Promise<AppointmentItem[]>;
  setAppointments: (items: AppointmentItem[]) => void;
  upsertAppointments: (items: AppointmentItem[]) => void;
  updateAppointmentStatus: (
    id: string,
    status: AppointmentItem['status'],
    extra?: Partial<AppointmentItem>
  ) => void;
  removeAppointment: (id: string) => void;
  reset: () => void;
}

const sortAppointmentsAsc = (items: AppointmentItem[]): AppointmentItem[] =>
  [...items].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );

export const useDoctorAppointmentsStore = create<DoctorAppointmentsState>((set, get) => ({
  appointments: [],
  loading: false,
  lastFetchedAt: null,

  fetchAppointments: async () => {
    set({ loading: true });
    try {
      const res = await doctorApi.getAppointments();
      if (res?.data && Array.isArray(res.data)) {
        const sorted = sortAppointmentsAsc(res.data);
        set({ appointments: sorted, lastFetchedAt: Date.now() });
        return sorted;
      }
      return get().appointments;
    } catch {
      return get().appointments;
    } finally {
      set({ loading: false });
    }
  },

  setAppointments: (items) => {
    set({ appointments: sortAppointmentsAsc(items) });
  },

  upsertAppointments: (items) => {
    const incomingIds = new Set(items.map((item) => item.id));
    const remaining = get().appointments.filter((existing) => !incomingIds.has(existing.id));
    set({ appointments: sortAppointmentsAsc([...items, ...remaining]) });
  },

  updateAppointmentStatus: (id, status, extra) => {
    set({
      appointments: get().appointments.map((apt) =>
        apt.id === id ? { ...apt, status, ...(extra || {}) } : apt
      ),
    });
  },

  removeAppointment: (id) => {
    set({
      appointments: get().appointments.filter((apt) => apt.id !== id),
    });
  },

  reset: () => {
    set({ appointments: [], loading: false, lastFetchedAt: null });
  },
}));

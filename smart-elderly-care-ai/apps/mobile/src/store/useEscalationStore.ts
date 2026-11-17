import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTO_ESCALATION_KEY = '@seca_auto_escalation_enabled';
const AUTO_ESCALATION_DELAY_KEY = '@seca_auto_escalation_delay';

export interface ActiveEscalation {
  incidentId: string;
  alertType: string;
  patientName: string;
  location: string;
  message: string;
  thumbnailUrl?: string | null;
  delaySeconds: number;
  status: 'COUNTDOWN' | 'ESCALATED';
  createdAt: string;
}

interface EscalationStoreState {
  autoCallEnabled: boolean;
  autoCallDelaySec: number;
  activeEscalation: ActiveEscalation | null;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  setAutoCallEnabled: (enabled: boolean) => Promise<void>;
  setAutoCallDelaySec: (seconds: number) => Promise<void>;
  triggerEscalation: (payload: Omit<ActiveEscalation, 'delaySeconds' | 'status'> & { delaySeconds?: number }) => void;
  markEscalated: (incidentId: string) => void;
  clearEscalation: (incidentId?: string) => void;
}

export const useEscalationStore = create<EscalationStoreState>((set, get) => ({
  autoCallEnabled: true,
  autoCallDelaySec: 45,
  activeEscalation: null,
  isLoaded: false,

  loadSettings: async () => {
    try {
      const [enabledStr, delayStr] = await Promise.all([
        AsyncStorage.getItem(AUTO_ESCALATION_KEY),
        AsyncStorage.getItem(AUTO_ESCALATION_DELAY_KEY),
      ]);
      set({
        autoCallEnabled: enabledStr === null ? true : enabledStr === 'true',
        autoCallDelaySec: delayStr ? Math.max(10, Number(delayStr) || 45) : 45,
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },

  setAutoCallEnabled: async (enabled: boolean) => {
    set({ autoCallEnabled: enabled });
    try {
      await AsyncStorage.setItem(AUTO_ESCALATION_KEY, String(enabled));
    } catch {}
  },

  setAutoCallDelaySec: async (seconds: number) => {
    const valid = Math.max(10, Math.min(300, seconds));
    set({ autoCallDelaySec: valid });
    try {
      await AsyncStorage.setItem(AUTO_ESCALATION_DELAY_KEY, String(valid));
    } catch {}
  },

  triggerEscalation: (payload) => {
    const { autoCallDelaySec, activeEscalation } = get();
    // Tránh mở đè nếu đang hiển thị đúng incidentId này
    if (activeEscalation && activeEscalation.incidentId === payload.incidentId) {
      return;
    }
    set({
      activeEscalation: {
        ...payload,
        delaySeconds: payload.delaySeconds || autoCallDelaySec || 45,
        status: 'COUNTDOWN',
      },
    });
  },

  markEscalated: (incidentId: string) => {
    set((state) => {
      if (!state.activeEscalation || state.activeEscalation.incidentId !== incidentId) {
        return state;
      }
      return {
        activeEscalation: {
          ...state.activeEscalation,
          status: 'ESCALATED',
        },
      };
    });
  },

  clearEscalation: (incidentId?: string) => {
    set((state) => {
      if (!state.activeEscalation) return state;
      if (incidentId && state.activeEscalation.incidentId !== incidentId) return state;
      return { activeEscalation: null };
    });
  },
}));

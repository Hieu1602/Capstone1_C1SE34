// src/services/api.ts
// Axios API Client cho Doctor Web Portal

import axios from 'axios';
import {
  DoctorPatientCard,
  DoctorPatientDetail,
  PrescriptionItem,
  AppointmentItem,
  AnalyticsData,
  DoctorUser,
  Incident,
  SystemNotification,
} from '../types';

const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname
    ? `http://${window.location.hostname}:8000/api/v1`
    : 'http://localhost:8000/api/v1');

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor đính kèm JWT Token và định danh nền tảng Cổng Web Bác sĩ
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('seca_doctor_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['x-client-platform'] = 'DOCTOR_WEB';
  return config;
});

// Interceptor xử lý lỗi 401: chuyển hướng về trang /login của Doctor
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('seca_doctor_token');
      localStorage.removeItem('seca_doctor_user');
      if (
        window.location.pathname !== '/login' &&
        window.location.pathname !== '/forgot-password'
      ) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// 1. AUTH API
export const authApi = {
  login: async (phone: string, pass: string) => {
    const params = new URLSearchParams();
    const formattedPhone = phone.startsWith('0') ? `+84${phone.slice(1)}` : phone;
    params.append('username', formattedPhone);
    params.append('password', pass);
    const res = await api.post('/auth/login', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data;
  },
  requestPasswordResetOtp: async (phone: string) => {
    const res = await api.post('/auth/password/request-otp', { phone: phone.trim() });
    return res.data;
  },
  verifyOtp: async (phone: string, otp_code: string) => {
    const res = await api.post('/auth/verify-otp', {
      phone: phone.trim(),
      otp_code: otp_code.trim(),
    });
    return res.data;
  },
  completePasswordReset: async (payload: {
    phone: string;
    otp_code: string;
    new_password: string;
  }) => {
    const res = await api.post('/auth/password/reset', payload);
    return res.data;
  },
  getMe: async (): Promise<DoctorUser> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  updateMe: async (data: any) => {
    const res = await api.patch('/users/me', data);
    return res.data;
  },
  deleteAvatar: async () => {
    const res = await api.delete('/users/me/avatar');
    return res.data;
  },
  changePassword: async (data: {
    current_password: string;
    new_password: string;
    confirm_new_password: string;
  }) => {
    const res = await api.patch('/users/me/password', data);
    return res.data;
  },
  getTerminals: async (): Promise<any[]> => {
    try {
      const res = await api.get('/users/me/terminals');
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  },
  deleteTerminal: async (terminalId: string) => {
    const res = await api.delete(`/users/me/terminals/${terminalId}`);
    return res.data;
  },
  logout: async (userName?: string, role: string = 'doctor') => {
    const token = localStorage.getItem('seca_doctor_token');
    try {
      await api.post(
        '/auth/logout',
        { user_name: userName, role },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
    } catch (e) {
      console.warn('[DoctorWeb] Lỗi gửi yêu cầu ghi nhận đăng xuất:', e);
    } finally {
      localStorage.removeItem('seca_doctor_token');
      localStorage.removeItem('seca_doctor_user');
    }
  },
};

// 2. DOCTOR API
export const doctorApi = {
  // Lấy danh sách bệnh nhân được phân công
  getPatients: async (): Promise<DoctorPatientCard[]> => {
    const res = await api.get('/doctor/patients');
    return res.data;
  },

  // Chi tiết bệnh án
  getPatientDetail: async (elderlyId: string): Promise<DoctorPatientDetail> => {
    const res = await api.get(`/doctor/patients/${elderlyId}`);
    return res.data;
  },

  // Cập nhật bệnh án
  updateMedicalRecord: async (elderlyId: string, data: any) => {
    const res = await api.put(`/doctor/patients/${elderlyId}/medical-record`, data);
    return res.data;
  },

  // Lấy dữ liệu phân tích sinh hiệu (TimescaleDB)
  getAnalytics: async (
    elderlyId: string,
    days: number = 7,
    startDate?: string,
    endDate?: string
  ): Promise<AnalyticsData> => {
    let url = `/doctor/patients/${elderlyId}/analytics?days=${days}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    const res = await api.get(url);
    return res.data;
  },

  // Đơn thuốc
  getPrescriptions: async (elderlyId: string): Promise<PrescriptionItem[]> => {
    const res = await api.get(`/doctor/patients/${elderlyId}/prescriptions`);
    return res.data;
  },

  createPrescription: async (elderlyId: string, data: any): Promise<PrescriptionItem> => {
    const res = await api.post(`/doctor/patients/${elderlyId}/prescriptions`, data);
    return res.data;
  },

  createBatchPrescriptions: async (elderlyId: string, data: any): Promise<PrescriptionItem[]> => {
    const res = await api.post(`/doctor/patients/${elderlyId}/prescriptions/batch`, data);
    return res.data;
  },

  deletePrescription: async (elderlyId: string, rxId: string) => {
    const res = await api.delete(`/doctor/patients/${elderlyId}/prescriptions/${rxId}`);
    return res.data;
  },

  togglePrescriptionReminder: async (elderlyId: string, rxId: string): Promise<PrescriptionItem> => {
    const res = await api.patch(`/doctor/patients/${elderlyId}/prescriptions/${rxId}/toggle-reminder`);
    return res.data;
  },

  // Lịch hẹn & Tái khám
  getAppointments: async (status?: string, patientId?: string): Promise<AppointmentItem[]> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (patientId) params.append('patient_id', patientId);
    const res = await api.get(`/doctor/appointments?${params.toString()}`);
    return res.data;
  },

  createAppointment: async (data: any): Promise<AppointmentItem> => {
    const res = await api.post('/doctor/appointments', data);
    return res.data;
  },

  updateAppointment: async (appointmentId: string, data: any): Promise<AppointmentItem> => {
    const res = await api.put(`/doctor/appointments/${appointmentId}`, data);
    return res.data;
  },

  cancelAppointment: async (appointmentId: string, reason: string) => {
    const res = await api.post(`/doctor/appointments/${appointmentId}/cancel`, { cancellation_reason: reason });
    return res.data;
  },

  completeAppointment: async (appointmentId: string, _clinicalNotes?: string) => {
    const res = await api.post(`/doctor/appointments/${appointmentId}/complete`);
    return res.data;
  },
};

// 3. HOUSEHOLD API (Lời mời bác sĩ gia đình)
export const householdApi = {
  getInvites: async () => {
    try {
      const res = await api.get('/houses/my-invitations');
      return res.data || [];
    } catch {
      return [];
    }
  },

  respondInvite: async (inviteId: string, action: 'accept' | 'reject') => {
    const res = await api.post(`/houses/invitations/${inviteId}/${action}`);
    return res.data;
  },
};

// 4. INCIDENTS & NOTIFICATIONS API (Đồng bộ trực tiếp với Backend CSDL & Mobile App)
export const incidentsApi = {
  list: async (deviceId?: string, limit = 50, targetRole = 'doctor'): Promise<Incident[]> => {
    try {
      const res = await api.get('/notifications', { params: { device_id: deviceId, limit, target_role: targetRole } });
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  },
  get: async (id: string): Promise<Incident> => {
    const res = await api.get(`/incidents/${id}`);
    return res.data;
  },
  acknowledge: async (id: string, notes?: string) => {
    const res = await api.post(`/incidents/${id}/acknowledge`, null, { params: { note: notes } });
    return res.data;
  },
  reopen: async (id: string, notes?: string) => {
    const res = await api.post(`/incidents/${id}/reopen`, null, { params: { note: notes } });
    return res.data;
  },
  acknowledgeAll: async () => {
    const res = await api.post('/incidents/acknowledge-all');
    return res.data;
  },
};

// 5. SYSTEM NOTIFICATIONS API (Đồng bộ thông báo toàn hệ thống từ Web Admin)
export const systemNotificationsApi = {
  getActiveBroadcasts: async (targetAudience: string = 'doctors'): Promise<SystemNotification[]> => {
    try {
      const res = await api.get<SystemNotification[]>('/system-notifications/broadcasts/active', {
        params: { target_audience: targetAudience },
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  },
};




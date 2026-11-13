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

// Interceptor đính kèm JWT Token của Bác sĩ
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('seca_doctor_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor xử lý lỗi 401: chuyển hướng về trang /login của Doctor
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('seca_doctor_token');
      localStorage.removeItem('seca_doctor_user');
      if (window.location.pathname !== '/login') {
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
  getMe: async (): Promise<DoctorUser> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  logout: async () => {
    localStorage.removeItem('seca_doctor_token');
    localStorage.removeItem('seca_doctor_user');
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
  getAnalytics: async (elderlyId: string, days: number = 7): Promise<AnalyticsData> => {
    const res = await api.get(`/doctor/patients/${elderlyId}/analytics?days=${days}`);
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


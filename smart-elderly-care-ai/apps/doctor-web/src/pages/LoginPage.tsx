// src/pages/LoginPage.tsx
// Trang đăng nhập dành riêng cho Bác Sĩ Gia Đình (Doctor Portal) - Bố cục Split-Screen 50/50

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDoctorAuthStore } from '../store/useDoctorAuthStore';
import { authApi } from '../services/api';
import {
  Stethoscope,
  Lock,
  Phone,
  AlertCircle,
  Loader2,
  HeartPulse,
  Eye,
  EyeOff,
  FileText,
  BellRing,
} from 'lucide-react';

// Khung bố cục Split-Screen 50/50 dùng chung cho Đăng nhập & Khôi phục mật khẩu Bác sĩ
export const DoctorAuthSplitShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-screen w-full flex-col lg:h-screen lg:flex-row lg:overflow-hidden bg-[#F0F6FF] font-sans text-[#0F172A]">
    {/* CỘT TRÁI (50%): Khu vực Form */}
    <div className="flex min-h-screen w-full flex-col justify-between bg-[#F0F6FF] lg:min-h-0 lg:w-1/2">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-4 sm:px-10">
        {/* Header thương hiệu */}
        <div className="mb-5 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 shadow-md border border-blue-100 shrink-0">
            <img src="/assets/logo.png" alt="SECA Logo" className="h-full w-full object-contain" />
          </div>
          <span className="font-heading text-xl font-extrabold tracking-tight text-[#1D4ED8] border-b-2 border-[#2563EB] pb-0.5">
            Smart Elderly Care AI
          </span>
        </div>

        {/* Khung thẻ chính */}
        <div className="w-full max-w-[440px] rounded-2xl border border-[#DBEAFE] bg-[#E0EDFF]/90 p-7 sm:p-8 shadow-[0_14px_34px_-6px_rgba(29,78,216,0.16)] backdrop-blur-sm">
          {children}
        </div>
      </div>

      {/* Đường kẻ chân trang căn giữa */}
      <footer className="border-t-2 border-blue-200 px-8 py-4 text-center">
        <p className="text-xs font-semibold text-[#1D4ED8]">© 2026 Smart Elderly Care AI</p>
      </footer>
    </div>

    {/* CỘT PHẢI (50%): Ảnh minh họa & Thẻ kính mờ Glassmorphism */}
    <div className="relative hidden lg:flex lg:w-1/2 lg:items-center lg:justify-center lg:p-10 overflow-hidden">
      <img
        src="/doctorr.jpg"
        alt="Bác sĩ gia đình tận tâm chăm sóc bệnh nhân"
        className="absolute -top-[14%] left-0 h-[114%] w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-blue-950/35 via-blue-950/10 to-transparent" />

      <div className="relative z-10 mt-20 w-full max-w-[400px]">
        {/* Thẻ nổi 1: Hồ sơ Bệnh án Điện tử */}
        <div className="animate-float-badge-top absolute -top-5 -right-3 z-20 flex items-center gap-2.5 rounded-full border border-blue-100 bg-white/90 px-4 py-2 shadow-lg backdrop-blur-md">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-[#2563EB]">
            <FileText className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold text-[#0F172A]">Hồ sơ Bệnh án Điện tử</span>
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </span>
        </div>

        {/* Thẻ kính mờ chính */}
        <div className="animate-float relative rounded-3xl border border-white/80 bg-white/80 px-7 py-6 text-center shadow-[0_20px_50px_rgba(37,99,235,0.18)] backdrop-blur-xl">
          <div className="relative mx-auto mb-3 flex h-12 w-12 items-center justify-center">
            <span className="absolute inline-flex h-12 w-12 animate-ping rounded-2xl bg-blue-400/35" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-2 shadow-md shadow-blue-600/20 border border-blue-100">
              <img src="/assets/logo.png" alt="SECA Logo" className="h-full w-full object-contain" />
            </div>
          </div>

          <div className="inline-flex flex-col items-center">
            <h2 className="font-heading text-2xl font-extrabold tracking-tight text-[#1D4ED8]">
              Smart Elderly Care AI
            </h2>
            <svg viewBox="0 0 200 22" className="mt-1 h-5 w-48 overflow-visible" fill="none" aria-hidden="true">
              <path
                d="M4 12 H62 L72 12 L79 4 L86 19 L94 2 L102 18 L108 9 L114 12 H196"
                stroke="#BFDBFE"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 12 H62 L72 12 L79 4 L86 19 L94 2 L102 18 L108 9 L114 12 H196"
                stroke="#2563EB"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-ecg-wave"
              />
            </svg>
          </div>

          <p className="mt-1.5 text-sm font-medium leading-relaxed text-[#0F172A]">
            Đồng hành tận tâm, bảo vệ sức khỏe người cao tuổi mỗi ngày.
          </p>
        </div>

        {/* Thẻ nổi 2: Cảnh báo Lâm sàng & Lịch khám */}
        <div className="animate-float-badge-bottom absolute -bottom-4 -left-3 z-20 flex items-center gap-2.5 rounded-2xl border border-blue-100 bg-white/90 px-4 py-2.5 shadow-lg backdrop-blur-md">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
            <BellRing className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold text-[#0F172A]">Cảnh báo Lâm sàng &amp; Lịch khám</span>
        </div>
      </div>
    </div>
  </div>
);

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useDoctorAuthStore();

  const [phone, setPhone] = useState('0905111222');
  const [password, setPassword] = useState('12345678');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const data = await authApi.login(phone.trim(), password);
      const token = data.access_token || data.token;
      const user = data.user;
      if (!token || !user) throw new Error('Dữ liệu xác thực không hợp lệ từ máy chủ.');

      if (user.role !== 'doctor') {
        setErrorMessage(
          `Truy cập bị từ chối: Tài khoản "${user.full_name}" có vai trò là [${user.role}]. Cổng thông tin này chỉ dành riêng cho Bác sĩ gia đình.`
        );
        return;
      }

      login(token, user);
      navigate('/');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const rawMsg = String(err.message || '');
      if (err.code === 'ECONNABORTED' || rawMsg.includes('timeout')) {
        setErrorMessage('Máy chủ phản hồi quá thời gian chờ. Vui lòng thử lại ngay.');
      } else if (err.code === 'ERR_NETWORK' || rawMsg.includes('Network Error')) {
        setErrorMessage('Không thể kết nối tới máy chủ Backend (http://localhost:8000). Vui lòng kiểm tra kết nối.');
      } else {
        setErrorMessage(detail || rawMsg || 'Đăng nhập không thành công. Vui lòng kiểm tra lại số điện thoại và mật khẩu.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <DoctorAuthSplitShell>
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#1D4ED8]">Đăng nhập</h1>
        <p className="mt-0.5 text-sm font-bold text-[#0F172A]">Cổng Y Tế Bác Sĩ Gia Đình</p>
        <p className="mt-1.5 text-xs leading-relaxed text-[#475569]">
          Hệ thống Giám sát &amp; Quản lý Chăm sóc Sức khỏe Người cao tuổi AI
        </p>
        <div className="mt-3 inline-flex items-center space-x-1.5 rounded-full border border-blue-300/80 bg-white/85 px-3 py-1 text-[11px] font-semibold text-[#1D4ED8] shadow-xs">
          <HeartPulse className="h-3.5 w-3.5 text-[#2563EB]" />
          <span>Chăm sóc Lâm sàng &amp; Theo dõi Từ xa</span>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-5 flex items-start space-x-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 shadow-xs">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <p className="leading-relaxed">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="doctor-phone" className="mb-1.5 block text-xs font-bold text-[#0F172A]">
            Số điện thoại Bác sĩ
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#475569]">
              <Phone className="h-4 w-4" />
            </div>
            <input
              id="doctor-phone"
              name="username"
              type="tel"
              autoComplete="username"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0905111222"
              className="h-12 w-full rounded-xl border border-[#DBEAFE] bg-white pl-10 pr-4 text-sm font-medium text-[#0F172A] placeholder:text-slate-400 shadow-xs transition-all focus:border-[#2563EB] focus:outline-none focus:ring-3 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label htmlFor="doctor-password" className="mb-1.5 block text-xs font-bold text-[#0F172A]">
            Mật khẩu
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#475569]">
              <Lock className="h-4 w-4" />
            </div>
            <input
              id="doctor-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-12 w-full rounded-xl border border-[#DBEAFE] bg-white pl-10 pr-11 text-sm font-medium text-[#0F172A] placeholder:text-slate-400 shadow-xs transition-all focus:border-[#2563EB] focus:outline-none focus:ring-3 focus:ring-blue-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#475569] transition-colors hover:text-[#1D4ED8]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/forgot-password', { state: { phone } })}
              className="text-xs font-semibold text-[#1D4ED8] transition-colors hover:text-[#2563EB] hover:underline"
            >
              Quên mật khẩu?
            </button>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center space-x-2 rounded-full bg-[#2563EB] px-6 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[#1D4ED8] active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang xác thực thông tin bác sĩ...</span>
              </>
            ) : (
              <span>Đăng nhập Cổng Bác sĩ</span>
            )}
          </button>
        </div>
      </form>
    </DoctorAuthSplitShell>
  );
};

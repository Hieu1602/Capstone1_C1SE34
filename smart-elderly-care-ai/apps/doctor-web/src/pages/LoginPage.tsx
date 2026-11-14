// src/pages/LoginPage.tsx
// Trang đăng nhập dành riêng cho Bác Sĩ Gia Đình (Doctor Portal)

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDoctorAuthStore } from '../store/useDoctorAuthStore';
import { authApi } from '../services/api';
import { Stethoscope, Lock, Phone, AlertCircle, Loader2, ShieldCheck, HeartPulse } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useDoctorAuthStore();

  const [phone, setPhone] = useState('0905111222');
  const [password, setPassword] = useState('12345678');
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

      if (!token || !user) {
        throw new Error('Dữ liệu xác thực không hợp lệ từ máy chủ.');
      }

      // Kiểm tra quyền: Chỉ tài khoản vai trò Bác sĩ mới được đăng nhập cổng này
      if (user.role !== 'doctor') {
        setErrorMessage(
          `Truy cập bị từ chối: Tài khoản "${user.full_name}" có vai trò là [${user.role}]. Cổng thông tin này chỉ dành riêng cho Bác sĩ gia đình.`
        );
        setLoading(false);
        return;
      }

      login(token, user);
      navigate('/');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrorMessage(detail || err.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại số điện thoại và mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-indigo-100/60 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Card đăng nhập */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/50 backdrop-blur-md">
          {/* Logo & Header */}
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white shadow-lg shadow-blue-500/30">
              <Stethoscope className="h-8 w-8" />
            </div>
            <h1 className="mt-4 font-heading text-xl font-extrabold tracking-tight text-slate-900">
              Cổng Y Tế Bác Sĩ Gia Đình
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Hệ thống Giám sát & Quản lý Chăm sóc Sức khỏe Người cao tuổi AI
            </p>
            <div className="mt-3 inline-flex items-center space-x-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200/60">
              <HeartPulse className="h-3.5 w-3.5 text-blue-600" />
              <span>Chăm sóc Lâm sàng & Theo dõi Từ xa</span>
            </div>
          </div>

          {/* Thông báo lỗi nếu có */}
          {errorMessage && (
            <div className="mt-5 flex items-start space-x-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* Form đăng nhập */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Số điện thoại Bác sĩ
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Phone className="h-4 w-4" />
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0905111222"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 transition-all focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-3 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 transition-all focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-3 focus:ring-blue-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center space-x-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 py-3 text-xs font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-blue-800 active:scale-[0.99] disabled:opacity-50"
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
          </form>


        </div>
      </div>
    </div>
  );
};

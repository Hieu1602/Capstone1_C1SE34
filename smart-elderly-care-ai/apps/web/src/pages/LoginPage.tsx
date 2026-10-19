// src/pages/LoginPage.tsx
// ui-ux-pro-max: Glassmorphism Dark OLED login · Admin-only access
// Credentials: Admin123 / 123456 · Blocks doctor & user roles

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Shield,
  Lock,
  User as UserIcon,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Terminal,
} from 'lucide-react';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [username, setUsername] = useState('Admin123');
  const [password, setPassword] = useState('123456');
  const [loading,  setLoading]  = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res   = await authApi.login(username.trim(), password);
      const token = res.data?.access_token;

      if (!token) throw new Error('Không nhận được token xác thực.');

      localStorage.setItem('seca_admin_token', token);
      const meRes      = await authApi.getMe();
      const userProfile = meRes.data;

      if (userProfile.role !== 'admin') {
        localStorage.removeItem('seca_admin_token');
        localStorage.removeItem('seca_admin_user');
        setErrorMsg(
          `Quyền truy cập bị từ chối — Tài khoản "${userProfile.full_name}" có vai trò [${userProfile.role.toUpperCase()}]. Chỉ Quản Trị Viên được phép truy cập cổng này.`
        );
        return;
      }

      login(token, userProfile);
      navigate('/');
    } catch (err: unknown) {
      localStorage.removeItem('seca_admin_token');
      localStorage.removeItem('seca_admin_user');

      // Demo fallback — Admin123 / 123456
      if (username.trim() === 'Admin123' && password === '123456') {
        login('demo-admin-token', {
          id:        '154b7921-7e8c-4019-bd05-34260f3358cf',
          phone:     'Admin123',
          full_name: 'Quản Trị Viên Hệ Thống',
          role:      'admin',
          is_active:  true,
        });
        navigate('/');
        return;
      }

      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
      setErrorMsg(
        axiosErr.response?.data?.detail ||
        axiosErr.message ||
        'Tên đăng nhập hoặc mật khẩu không chính xác.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFillAdmin = () => {
    setUsername('Admin123');
    setPassword('123456');
    setErrorMsg(null);
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden"
      style={{ background: '#0F172A' }}
    >
      {/* ── Decorative blobs ── */}
      <div
        aria-hidden="true"
        className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="absolute bottom-1/4 -right-32 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)' }}
      />

      {/* ── Main Login Card ── */}
      <div
        className="w-full max-w-sm relative z-10 animate-slide-up"
        style={{
          background:     'rgba(27,35,54,0.9)',
          border:         '1px solid rgba(255,255,255,0.08)',
          borderRadius:   '20px',
          boxShadow:      '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          backdropFilter: 'blur(16px)',
          padding:        '28px',
        }}
      >
        {/* Inset top highlight */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.4), transparent)',
            borderRadius: '999px',
          }}
        />

        {/* ── Brand ── */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{
              background:  'linear-gradient(135deg, #22c55e, #15803d)',
              boxShadow:   '0 8px 24px rgba(34,197,94,0.3)',
            }}
          >
            <Activity className="w-7 h-7 text-white stroke-[2]" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-xl font-bold text-white tracking-tight">
            SECA <span style={{ color: '#22c55e' }}>Admin Portal</span>
          </h1>
          <p className="text-[11px] text-slate-500 mt-1 font-sans flex items-center justify-center gap-1">
            <Terminal className="w-3 h-3" aria-hidden="true" />
            Smart Elderly Care — System Console
          </p>
        </div>

        {/* ── Error Alert ── */}
        {errorMsg && (
          <div
            role="alert"
            className="mb-5 p-3 rounded-xl flex items-start gap-2.5 text-[11px] leading-relaxed animate-fade-in"
            style={{
              background:  'rgba(239,68,68,0.1)',
              border:      '1px solid rgba(239,68,68,0.25)',
              color:       '#f87171',
            }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ── Login Form ── */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Username */}
          <div>
            <label
              htmlFor="login-username"
              className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1.5 font-mono"
            >
              Admin Username
            </label>
            <div className="relative">
              <UserIcon
                className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
                aria-hidden="true"
              />
              <input
                id="login-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                placeholder="Admin123"
                className="input-glass pl-9 font-mono"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="login-password"
              className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1.5 font-mono"
            >
              Mật khẩu
            </label>
            <div className="relative">
              <Lock
                className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
                aria-hidden="true"
              />
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="••••••"
                className="input-glass pl-9 font-mono"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                Đang xác thực...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" aria-hidden="true" />
                Đăng nhập 
                <ArrowRight className="w-4 h-4 ml-auto" aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* ── Footer ── */}
      <p className="mt-6 text-[10px] text-slate-700 text-center font-mono">
        © 2026 Smart Elderly Care AI · C1SE.34 · Secure Admin Console
      </p>
    </div>
  );
};

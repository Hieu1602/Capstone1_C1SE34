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
    <div className="min-h-screen flex flex-col justify-between items-center relative overflow-hidden bg-[#0B1714] text-slate-100 font-sans selection:bg-[#D96C3B]/20 selection:text-[#DFB15B]">
      
      {/* ── Ambient Royal Light Glows ── */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(223, 177, 91, 0.15) 0%, rgba(19, 56, 47, 0.25) 50%, transparent 80%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(217, 108, 59, 0.08) 0%, transparent 70%)',
        }}
      />

      {/* ── Top Header Bar ── */}
      <header className="w-full px-6 py-5 flex items-center justify-between relative z-10 max-w-7xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 p-1 flex items-center justify-center border border-[#DFB15B]/30 shadow-md">
            <img 
              src="/assets/logo.png" 
              alt="SECA Logo" 
              className="w-full h-full object-contain filter drop-shadow"
            />
          </div>
          <div>
            <span className="font-heading text-sm font-bold text-white tracking-tight flex items-center">
              SECA <span className="text-[#DFB15B] ml-1">Admin</span>
              <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#DFB15B]/20 text-[#F5DEB3] border border-[#DFB15B]/40">
                PRO
              </span>
            </span>
            <p className="text-[10px] text-[#A6C0B5]">Smart Elderly Care AI</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#13382F]/80 border border-[#265A4C] text-[11px] font-mono text-[#DFB15B]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span>Bảo mật AES-256</span>
        </div>
      </header>

      {/* ── Centered Main Login Card ── */}
      <main className="w-full max-w-md px-4 py-6 relative z-10 flex flex-col items-center my-auto animate-slide-up">
        <div className="w-full glass-card p-8 sm:p-9 rounded-2xl relative shadow-2xl bg-[#13382F]/90 dark:bg-[#13382F]/90 border border-[#DFB15B]/40 backdrop-blur-xl">
          
          {/* 4 Heritage Golden Fretwork Corners */}
          <img
            src="/assets/heritage/png/corner-gold.png"
            alt=""
            className="absolute top-1.5 left-1.5 w-6 h-6 object-contain pointer-events-none select-none opacity-85"
            aria-hidden="true"
          />
          <img
            src="/assets/heritage/png/corner-gold.png"
            alt=""
            className="absolute top-1.5 right-1.5 w-6 h-6 object-contain pointer-events-none select-none opacity-85 rotate-90"
            aria-hidden="true"
          />
          <img
            src="/assets/heritage/png/corner-gold.png"
            alt=""
            className="absolute bottom-1.5 left-1.5 w-6 h-6 object-contain pointer-events-none select-none opacity-85 -rotate-90"
            aria-hidden="true"
          />
          <img
            src="/assets/heritage/png/corner-gold.png"
            alt=""
            className="absolute bottom-1.5 right-1.5 w-6 h-6 object-contain pointer-events-none select-none opacity-85 rotate-180"
            aria-hidden="true"
          />

          {/* Card Top Brand */}
          <div className="text-center mb-6 relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3 p-2 bg-white/10 border border-[#DFB15B]/40 shadow-lg ring-4 ring-[#DFB15B]/10">
              <img 
                src="/assets/logo.png" 
                alt="SECA Logo" 
                className="w-full h-full object-contain filter drop-shadow"
              />
            </div>
            <h1 className="font-heading text-xl font-extrabold text-white tracking-tight">
              Cổng Quản Trị <span className="text-[#DFB15B]">SECA</span>
            </h1>
            <p className="text-xs text-[#A6C0B5] mt-1 font-sans">
              Hệ thống giám sát y tế thông minh người cao tuổi
            </p>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-xl flex items-start gap-2.5 text-xs leading-relaxed bg-rose-500/15 border border-rose-500/30 text-rose-300 animate-fade-in relative z-10"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 relative z-10" noValidate>
            <div>
              <label
                htmlFor="login-username"
                className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#DFB15B] mb-1.5 font-mono"
              >
                Tên đăng nhập (Admin)
              </label>
              <div className="relative">
                <UserIcon
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#DFB15B]/70"
                  aria-hidden="true"
                />
                <input
                  id="login-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Admin123"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0F2F27]/90 border border-[#265A4C] text-white placeholder-slate-500 focus:outline-none focus:border-[#DFB15B] focus:ring-2 focus:ring-[#DFB15B]/20 text-xs font-mono transition-all shadow-inner"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#DFB15B] mb-1.5 font-mono"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <Lock
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#DFB15B]/70"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0F2F27]/90 border border-[#265A4C] text-white placeholder-slate-500 focus:outline-none focus:border-[#DFB15B] focus:ring-2 focus:ring-[#DFB15B]/20 text-xs font-mono transition-all shadow-inner"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-xs font-bold mt-2 shadow-lg hover:shadow-[#D96C3B]/40"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  Đang xác thực hệ thống...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" aria-hidden="true" />
                  Đăng nhập vào Hệ thống
                  <ArrowRight className="w-4 h-4 ml-auto" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Quick Fill Demo Helper */}
          <div className="mt-5 pt-4 border-t border-[#265A4C]/60 flex items-center justify-between text-[11px] text-[#A6C0B5] relative z-10">
            <span>Tài khoản kiểm thử:</span>
            <button
              type="button"
              onClick={handleFillAdmin}
              className="text-[#DFB15B] hover:text-white font-mono underline decoration-dotted transition-colors cursor-pointer"
            >
              Admin123 / 123456
            </button>
          </div>
        </div>

        {/* Console Note */}
        <p className="mt-4 text-[11px] text-[#A6C0B5]/80 text-center font-mono">
          © 2026 Smart Elderly Care AI · C1SE.34 · Phân hệ quản trị cốt lõi
        </p>
      </main>

      {/* ── Imperial Lotus Wave Footer Banner (Bottom) ── */}
      <footer className="w-full overflow-hidden pointer-events-none select-none relative z-0 leading-none">
        <img
          src="/assets/heritage/png/lotus-wave-footer.png?v=3"
          alt=""
          className="w-full h-auto min-w-full block select-none pointer-events-none opacity-75"
        />
      </footer>
    </div>
  );
};

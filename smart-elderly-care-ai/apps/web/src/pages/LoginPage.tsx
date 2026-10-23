// src/pages/LoginPage.tsx
// Metallic Cyber-Tech Admin Login · Anodized Orange & Titanium Surface
// Credentials: +84900000000 / 12345678 (AWS TimescaleDB) · Admin-only access

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Lock,
  User as UserIcon,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Cpu,
} from 'lucide-react';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [username, setUsername] = useState('+84900000000');
  const [password, setPassword] = useState('12345678');
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

      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
      const detail = axiosErr.response?.data?.detail;
      const msg = axiosErr.message || '';

      if (msg.includes('Network Error')) {
        setErrorMsg(
          'Không thể kết nối đến máy chủ AWS EC2 (Network Error / Mixed Content). Nếu đang mở trên trình duyệt HTTPS, hãy cấp quyền: Bấm biểu tượng ổ khóa/cài đặt cạnh URL -> Cài đặt trang web (Site settings) -> Nội dung không an toàn (Insecure content) -> Cho phép (Allow).'
        );
      } else {
        setErrorMsg(
          detail ||
          msg ||
          'Tên đăng nhập hoặc mật khẩu không chính xác.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFillAdmin = () => {
    setUsername('+84900000000');
    setPassword('12345678');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between items-center relative overflow-hidden bg-[#12151C] text-[#F1F4F9] font-sans selection:bg-[#F05A24]/25 selection:text-[#FF7037]">
      
      {/* ── Cyber Tech Background Grid & Ambient Beams ── */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(240, 90, 36, 0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(240, 90, 36, 0.16) 0%, rgba(217, 72, 20, 0.04) 50%, transparent 80%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute bottom-0 right-0 w-[550px] h-[550px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(240, 90, 36, 0.06) 0%, transparent 70%)',
        }}
      />

      {/* ── Top Header Bar ── */}
      <header className="w-full px-6 py-5 flex items-center justify-between relative z-10 max-w-7xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2A2F3D] to-[#181C25] p-1.5 flex items-center justify-center border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_8px_rgba(0,0,0,0.5)]">
            <img 
              src="/assets/logo.png" 
              alt="SECA Logo" 
              className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
            />
          </div>
          <div>
            <div className="font-heading text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>SECA</span>
              <span className="text-[#FF7037] drop-shadow-[0_0_10px_rgba(240,90,36,0.4)]">Admin</span>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gradient-to-r from-[#F05A24]/25 to-[#D94814]/20 text-[#FF8A54] border border-[#F05A24]/40 shadow-[0_0_8px_rgba(240,90,36,0.2)]">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-[#737780] font-mono">Smart Elderly Care AI</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#1D222D] to-[#161922] border border-[#323846] text-[11px] font-mono text-[#16A36A] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_6px_#10B981]" />
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            AES-256 / TLS 1.3 Active
          </span>
        </div>
      </header>

      {/* ── Centered Metallic Login Chassis ── */}
      <main className="w-full max-w-md px-4 py-8 relative z-10 flex flex-col items-center my-auto animate-slide-up">
        <div className="w-full rounded-2xl relative shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_12px_40px_rgba(0,0,0,0.65)] bg-gradient-to-b from-[#1E2330] via-[#171B24] to-[#12151C] border border-[#323846] p-8 sm:p-9 backdrop-blur-xl">
          
          {/* Specular top light reflex */}
          <div className="absolute top-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

          {/* Card Top Brand */}
          <div className="text-center mb-6 relative z-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 p-2 bg-gradient-to-br from-[#282D3B] to-[#161922] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_16px_rgba(0,0,0,0.5)] ring-4 ring-[#F05A24]/15">
              <img 
                src="/assets/logo.png" 
                alt="SECA Logo" 
                className="w-full h-full object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
              />
            </div>
            <h1 className="font-heading text-xl font-extrabold text-white tracking-tight flex items-center justify-center gap-1.5">
              <span>Cổng Quản Trị</span>
              <span className="text-[#FF7037] drop-shadow-[0_0_12px_rgba(240,90,36,0.35)]">SECA</span>
            </h1>
            <p className="text-xs text-[#737780] mt-1 font-sans">
              Hệ thống giám sát y tế thông minh người cao tuổi
            </p>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-xl flex items-start gap-2.5 text-xs leading-relaxed bg-[#E5484D]/15 border border-[#E5484D]/35 text-[#F87171] animate-fade-in relative z-10 shadow-[0_0_12px_rgba(229,72,77,0.2)]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#E5484D]" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 relative z-10" noValidate>
            <div>
              <label
                htmlFor="login-username"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#9AA1AF] mb-1.5 font-mono flex items-center justify-between"
              >
                <span>Số điện thoại</span>
                <span className="text-[10px] text-[#FF7037] opacity-80">AWS Database</span>
              </label>
              <div className="relative">
                <UserIcon
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737780]"
                  aria-hidden="true"
                />
                <input
                  id="login-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Tài Khoản"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gradient-to-b from-[#13161F] to-[#1A1F2B] border border-[#323846] text-white placeholder-[#737780] focus:outline-none focus:border-[#F05A24] focus:ring-2 focus:ring-[#F05A24]/25 text-xs font-mono transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#9AA1AF] mb-1.5 font-mono flex items-center justify-between"
              >
                <span>Mật khẩu</span>
                <span className="text-[10px] text-[#737780]">JWT Session</span>
              </label>
              <div className="relative">
                <Lock
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737780]"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gradient-to-b from-[#13161F] to-[#1A1F2B] border border-[#323846] text-white placeholder-[#737780] focus:outline-none focus:border-[#F05A24] focus:ring-2 focus:ring-[#F05A24]/25 text-xs font-mono transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-xs font-bold mt-2 shadow-[0_6px_20px_rgba(240,90,36,0.45)] hover:shadow-[0_8px_25px_rgba(240,90,36,0.6)]"
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

          {/* Quick Fill AWS Admin Helper */}
          <div className="mt-5 pt-4 border-t border-[#323846] flex items-center justify-between text-[11px] text-[#737780] relative z-10">
            <span className="flex items-center gap-1 font-mono">
              <Cpu className="w-3 h-3 text-[#FF7037]" />
              Admin AWS:
            </span>
            <button
              type="button"
              onClick={handleFillAdmin}
              className="text-[#FF7037] hover:text-[#FFA070] font-mono underline decoration-dotted transition-colors cursor-pointer drop-shadow-[0_0_6px_rgba(240,90,36,0.3)]"
            >
              +84900000000 / 12345678
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <p className="mt-5 text-[11px] text-[#636A78] text-center font-mono">
          © 2026 Smart Elderly Care AI · C1SE.34 · Phân hệ quản trị cốt lõi
        </p>
      </main>

      {/* Cyber Tech Footer */}
      <footer className="w-full py-4 text-center text-[10px] text-[#636A78] font-mono relative z-10">
        Bản quyền thuộc SECA Team · Nền tảng điều hành IoT & AI Y Tế
      </footer>
    </div>
  );
};

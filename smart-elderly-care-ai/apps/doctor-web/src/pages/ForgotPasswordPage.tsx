// src/pages/ForgotPasswordPage.tsx
// Trang Khôi phục / Đặt lại Mật khẩu dành cho Bác sĩ Gia đình (3 bước OTP)

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../services/api';
import { DoctorAuthSplitShell } from './LoginPage';
import {
  Lock,
  Phone,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';

type Step = 'request' | 'verify' | 'newPassword';
type Feedback = { type: 'success' | 'error' | 'info' | 'complete'; message: string };

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialPhone = (location.state as { phone?: string } | null)?.phone || '0905111222';

  const [step, setStep] = useState<Step>('request');
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (step === 'verify') setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
  }, [step]);

  const getApiErrorMessage = (error: any, fallback: string) => {
    const detail = error?.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join('\n') || fallback;
    }
    return typeof detail === 'string' ? detail : fallback;
  };

  // Bước 1: Gửi mã xác minh OTP qua SMS
  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const normalizedPhone = phone.replace(/\s+/g, '');
    if (!/^\+?[0-9]{9,15}$/.test(normalizedPhone)) {
      setFeedback({ type: 'error', message: 'Số điện thoại không hợp lệ. Vui lòng kiểm tra và nhập lại.' });
      return;
    }
    setIsLoading(true);
    setFeedback(null);
    try {
      await authApi.requestPasswordResetOtp(normalizedPhone);
      setStep('verify');
      setFeedback({ type: 'info', message: `Đã gửi mã xác minh 6 chữ số đến số điện thoại ${normalizedPhone}.` });
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(error, 'Không thể gửi mã xác minh. Vui lòng kiểm tra lại số điện thoại.'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Bước 2: Xác thực mã OTP 6 chữ số
  const handleVerifyCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (otp.length !== 6) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập đủ 6 chữ số của mã xác minh.' });
      return;
    }
    const normalizedPhone = phone.replace(/\s+/g, '');
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await authApi.verifyOtp(normalizedPhone, otp);
      if (res?.verified !== false) {
        setStep('newPassword');
        setFeedback({ type: 'info', message: 'Xác minh số điện thoại thành công. Vui lòng thiết lập mật khẩu mới.' });
      } else {
        setFeedback({ type: 'error', message: 'Mã xác minh không chính xác hoặc đã hết hạn.' });
      }
    } catch (error: any) {
      setFeedback({ type: 'error', message: getApiErrorMessage(error, 'Mã xác minh không đúng hoặc đã hết hạn.') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    const normalizedPhone = phone.replace(/\s+/g, '');
    setIsLoading(true);
    setFeedback(null);
    try {
      await authApi.requestPasswordResetOtp(normalizedPhone);
      setOtp('');
      setFeedback({ type: 'info', message: `Đã gửi lại mã xác minh mới tới ${normalizedPhone}.` });
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (error: any) {
      setFeedback({ type: 'error', message: getApiErrorMessage(error, 'Không thể gửi lại mã. Vui lòng thử lại sau.') });
    } finally {
      setIsLoading(false);
    }
  };

  // Bước 3: Đặt lại mật khẩu mới
  const handleResetPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (password.length < 8 || password.length > 16) {
      setFeedback({ type: 'error', message: 'Mật khẩu cần có độ dài từ 8 đến 16 ký tự.' });
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,16}$/.test(password)) {
      setFeedback({ type: 'error', message: 'Mật khẩu cần bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.' });
      return;
    }
    if (password !== confirmPassword) {
      setFeedback({ type: 'error', message: 'Mật khẩu mới và ô xác nhận mật khẩu chưa khớp.' });
      return;
    }
    setIsLoading(true);
    setFeedback(null);
    try {
      await authApi.completePasswordReset({
        phone: phone.replace(/\s+/g, ''),
        otp_code: otp,
        new_password: password,
      });
      setFeedback({
        type: 'complete',
        message: 'Đặt lại mật khẩu thành công! Mật khẩu mới đã được lưu, vui lòng đăng nhập lại.',
      });
    } catch (error: any) {
      setFeedback({ type: 'error', message: getApiErrorMessage(error, 'Không thể cập nhật mật khẩu. Vui lòng thử lại sau.') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    const digitsOnly = value.replace(/[^0-9]/g, '');
    if (!digitsOnly) {
      const nextOtp = otp.split('');
      nextOtp[index] = '';
      setOtp(nextOtp.join(''));
      return;
    }
    if (digitsOnly.length > 1) {
      const pasted = digitsOnly.slice(0, 6);
      setOtp(pasted);
      otpInputRefs.current[Math.min(pasted.length, 5)]?.focus();
      return;
    }
    const chars = otp.padEnd(6, ' ').split('');
    chars[index] = digitsOnly[0];
    setOtp(chars.join('').replace(/\s/g, ''));
    if (index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const isLengthValid = password.length >= 8 && password.length <= 16;
  const isComplexValid =
    /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);

  const title = step === 'request' ? 'Quên mật khẩu' : step === 'verify' ? 'Xác minh số điện thoại' : 'Tạo mật khẩu mới';
  const description =
    step === 'request'
      ? 'Nhập số điện thoại tài khoản Bác sĩ để nhận mã OTP xác thực và đặt lại mật khẩu.'
      : step === 'verify'
        ? `Nhập mã xác minh gồm 6 chữ số được gửi tới số điện thoại ${phone}.`
        : 'Xác minh số điện thoại thành công. Vui lòng thiết lập mật khẩu mới an toàn.';

  return (
    <DoctorAuthSplitShell>
      {/* Nút quay lại & Thanh tiến trình 3 bước */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (step === 'verify') {
              setStep('request');
              setFeedback(null);
            } else if (step === 'newPassword' && feedback?.type !== 'complete') {
              setStep('verify');
              setFeedback(null);
            } else {
              navigate('/login');
            }
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1D4ED8] transition-colors hover:text-[#2563EB]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại</span>
        </button>

        <div className="flex items-center gap-1.5">
          {(['request', 'verify', 'newPassword'] as const).map((s) => (
            <span
              key={s}
              className={`h-1.5 w-6 rounded-full transition-all ${step === s ? 'bg-[#2563EB]' : 'bg-blue-300'}`}
            />
          ))}
        </div>
      </div>

      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#1D4ED8]">{title}</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-[#475569]">{description}</p>
      </div>

      {feedback && (
        <div
          role="alert"
          className={`mt-4 flex items-start space-x-2.5 rounded-xl border p-3.5 text-xs shadow-xs ${
            feedback.type === 'success' || feedback.type === 'complete'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : feedback.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-blue-200 bg-white/90 text-[#1D4ED8]'
          }`}
        >
          {feedback.type === 'success' || feedback.type === 'complete' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          ) : feedback.type === 'error' ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
          )}
          <p className="leading-relaxed font-medium">{feedback.message}</p>
        </div>
      )}

      {step === 'request' && (
        <form onSubmit={handleSendCode} className="mt-5 space-y-4">
          <div>
            <label htmlFor="reset-phone" className="mb-1.5 block text-xs font-bold text-[#0F172A]">
              Số điện thoại Bác sĩ
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#475569]">
                <Phone className="h-4 w-4" />
              </div>
              <input
                id="reset-phone"
                type="tel"
                required
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Nhập số điện thoại của bạn (VD: 0905111222)"
                className="h-12 w-full rounded-xl border border-[#DBEAFE] bg-white pl-10 pr-4 text-sm font-medium text-[#0F172A] placeholder:text-slate-400 shadow-xs transition-all focus:border-[#2563EB] focus:outline-none focus:ring-3 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex h-12 w-full items-center justify-center space-x-2 rounded-full bg-[#2563EB] px-6 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[#1D4ED8] active:scale-[0.99] disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang gửi mã xác minh...</span>
              </>
            ) : (
              <span>Gửi mã xác minh</span>
            )}
          </button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerifyCode} className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold text-[#0F172A]">Mã xác minh OTP (6 chữ số)</label>
            <div className="flex items-center justify-between gap-2">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <input
                  key={index}
                  ref={(el) => {
                    otpInputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp[index] || ''}
                  onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !otp[index] && index > 0) otpInputRefs.current[index - 1]?.focus();
                  }}
                  className="h-12 w-12 rounded-xl border border-[#DBEAFE] bg-white text-center text-lg font-extrabold text-[#0F172A] shadow-xs transition-all focus:border-[#2563EB] focus:outline-none focus:ring-3 focus:ring-blue-500/20"
                />
              ))}
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] transition-colors hover:text-[#2563EB] hover:underline disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Gửi lại mã xác minh</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex h-12 w-full items-center justify-center space-x-2 rounded-full bg-[#2563EB] px-6 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[#1D4ED8] active:scale-[0.99] disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang xác minh...</span>
              </>
            ) : (
              <span>Xác minh tiếp tục</span>
            )}
          </button>
        </form>
      )}

      {step === 'newPassword' && (
        <form onSubmit={handleResetPassword} className="mt-5 space-y-4">
          {feedback?.type !== 'complete' && (
            <>
              <div>
                <label htmlFor="new-password" className="mb-1.5 block text-xs font-bold text-[#0F172A]">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#475569]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mật khẩu mới (8-16 ký tự)"
                    className="h-12 w-full rounded-xl border border-[#DBEAFE] bg-white pl-10 pr-11 text-sm font-medium text-[#0F172A] placeholder:text-slate-400 shadow-xs transition-all focus:border-[#2563EB] focus:outline-none focus:ring-3 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#475569] hover:text-[#1D4ED8]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-blue-200/80 bg-white/85 p-3.5 text-xs">
                <p className="mb-1.5 font-bold text-[#0F172A]">Yêu cầu bảo mật mật khẩu:</p>
                <p className={`flex items-center gap-1.5 ${isLengthValid ? 'font-semibold text-emerald-600' : 'text-[#475569]'}`}>
                  <span>{isLengthValid ? '●' : '◯'}</span>
                  <span>Độ dài từ 8 đến 16 ký tự</span>
                </p>
                <p className={`mt-1 flex items-center gap-1.5 ${isComplexValid ? 'font-semibold text-emerald-600' : 'text-[#475569]'}`}>
                  <span>{isComplexValid ? '●' : '◯'}</span>
                  <span>Bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt</span>
                </p>
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-bold text-[#0F172A]">
                  Xác nhận lại mật khẩu mới
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#475569]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="h-12 w-full rounded-xl border border-[#DBEAFE] bg-white pl-10 pr-11 text-sm font-medium text-[#0F172A] placeholder:text-slate-400 shadow-xs transition-all focus:border-[#2563EB] focus:outline-none focus:ring-3 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#475569] hover:text-[#1D4ED8]"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {feedback?.type === 'complete' ? (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="flex h-12 w-full items-center justify-center space-x-2 rounded-full bg-[#2563EB] px-6 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[#1D4ED8]"
            >
              <span>Đăng nhập ngay</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={isLoading}
              className="flex h-12 w-full items-center justify-center space-x-2 rounded-full bg-[#2563EB] px-6 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[#1D4ED8] active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang lưu mật khẩu mới...</span>
                </>
              ) : (
                <span>Lưu mật khẩu mới</span>
              )}
            </button>
          )}
        </form>
      )}

      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="text-xs font-bold text-[#1D4ED8] transition-colors hover:text-[#2563EB] hover:underline"
        >
          {feedback?.type === 'complete' ? 'Đăng nhập bằng mật khẩu mới' : 'Quay lại màn hình đăng nhập'}
        </button>
      </div>
    </DoctorAuthSplitShell>
  );
};

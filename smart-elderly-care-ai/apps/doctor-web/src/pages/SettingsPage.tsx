// src/pages/SettingsPage.tsx
// Trang Cài đặt & Hồ sơ Bác sĩ Gia đình (Đồng bộ 100% tính năng với tab Cài đặt trên Mobile App)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDoctorAuthStore, getDoctorAvatarUri } from '../store/useDoctorAuthStore';
import { authApi, doctorApi } from '../services/api';
import {
  ShieldCheck,
  Camera,
  Edit3,
  Users,
  Calendar,
  Award,
  KeyRound,
  Bell,
  FileCheck2,
  LogOut,
  ChevronRight,
  Monitor,
  Smartphone,
  Trash2,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  RefreshCw,
  Moon,
} from 'lucide-react';

interface DoctorProfileInfo {
  name: string;
  degree: string;
  specialty: string;
  hospital: string;
  department: string;
  phone: string;
  cchn_number: string;
  avatarUri?: string | null;
}

const maskPhone = (phone?: string) => {
  const c = phone?.trim() || '';
  return !c ? 'Chưa cập nhật' : c.length <= 4 ? '***' : `${c.slice(0, 3)}****${c.slice(-3)}`;
};

const COMPLIANCE_SECTIONS = [
  {
    title: '1. Tiêu chuẩn Dữ liệu Y tế Quốc tế & Bảo mật Đa lớp',
    desc: 'Hệ thống Smart Elderly Care AI tuân thủ nghiêm ngặt các quy chuẩn truyền nhận và lưu trữ bệnh án điện tử quốc tế. Dữ liệu chỉ số sinh hiệu, đơn thuốc điều trị và tiền sử bệnh lý của người cao tuổi đều được mã hóa đầu cuối bảo mật tuyệt đối bằng thuật toán chuẩn AES-256.',
  },
  {
    title: '2. Cam kết Bảo mật Thông tin Bệnh nhân của Bác sĩ',
    desc: 'Bác sĩ gia đình có nghĩa vụ bảo mật toàn diện thông tin cá nhân, hồ sơ bệnh án và hình ảnh giám sát của người cao tuổi. Mọi hành vi sao chép, chụp màn hình hoặc chia sẻ dữ liệu y tế ra bên ngoài khi chưa có sự đồng ý của gia đình đều vi phạm Luật Khám bệnh, chữa bệnh.',
  },
  {
    title: '3. Nhật ký Kiểm toán & Giám sát Truy cập An toàn',
    desc: 'Mọi thao tác tra cứu hồ sơ, kê đơn thuốc, cập nhật chỉ số sức khỏe của Bác sĩ đều được hệ thống ghi nhận lịch sử kiểm toán tự động, phục vụ công tác thanh tra chuyên môn y tế và đối soát định kỳ.',
  },
];

export const SettingsPage: React.FC = () => {
  const { user, logout } = useDoctorAuthStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [docInfo, setDocInfo] = useState<DoctorProfileInfo>(() => {
    const saved = localStorage.getItem('seca_doctor_profile_custom');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      name: parsed.name || user?.full_name || 'BS. Trần Văn Minh',
      degree: parsed.degree || 'Bác sĩ chuyên khoa',
      specialty: parsed.specialty || user?.specialty || 'Y học Gia đình & Lão khoa',
      hospital: parsed.hospital || user?.workplace || 'Hệ thống Smart Elderly Care AI',
      department: parsed.department || 'Khoa Chăm sóc Người cao tuổi',
      phone: parsed.phone || user?.phone || '0905111222',
      cchn_number: parsed.cchn_number || user?.cchn_number || '028491/BYT-CCHN',
      avatarUri: getDoctorAvatarUri(user?.avatar_url),
    };
  });

  useEffect(() => {
    const handleProfileUpdate = () => {
      const nextAvatar = getDoctorAvatarUri(user?.avatar_url);
      setDocInfo((prev) => ({ ...prev, avatarUri: nextAvatar }));
      setEditForm((prev) => ({ ...prev, avatarUri: nextAvatar }));
    };
    window.addEventListener('doctor-profile-updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);
    return () => {
      window.removeEventListener('doctor-profile-updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, [user]);

  const [patientCount, setPatientCount] = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [terminals, setTerminals] = useState<any[]>([]);
  const [loadingTerminals, setLoadingTerminals] = useState(false);

  // Modals state
  const [activeModal, setActiveModal] = useState<
    'NONE' | 'EDIT_PROFILE' | 'PASSWORD' | 'NOTIF' | 'COMPLIANCE' | 'DEVICES' | 'LOGOUT'
  >('NONE');

  // Edit profile state
  const [editForm, setEditForm] = useState<DoctorProfileInfo>(docInfo);
  const [savingProfile, setSavingProfile] = useState(false);

  // Change password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState({ old: false, new: false, confirm: false });
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  // Notification switches & Vital Thresholds
  const [notifyEmergency, setNotifyEmergency] = useState(true);
  const [notifyAppt, setNotifyAppt] = useState(true);
  const [notifyHubSpeaker, setNotifyHubSpeaker] = useState(true);
  const [notifyFallAlert, setNotifyFallAlert] = useState(true);
  const [hrThresholdMax, setHrThresholdMax] = useState('110');
  const [spo2ThresholdMin, setSpo2ThresholdMin] = useState('94');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('@doctor_theme') === 'dark';
  });
  const [toastMsg, setToastMsg] = useState('');

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('@doctor_theme', 'dark');
      showToast('Đã bật Chế độ nền tối (Dark mode).');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('@doctor_theme', 'light');
      showToast('Đã chuyển về Chế độ sáng.');
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const fetchStatsAndDevices = useCallback(async () => {
    setLoadingTerminals(true);
    try {
      const [patRes, aptRes, termRes] = await Promise.allSettled([
        doctorApi.getPatients(),
        doctorApi.getAppointments(),
        authApi.getTerminals(),
      ]);
      if (patRes.status === 'fulfilled' && Array.isArray(patRes.value)) {
        setPatientCount(patRes.value.length);
      }
      if (aptRes.status === 'fulfilled' && Array.isArray(aptRes.value)) {
        setAppointmentCount(aptRes.value.length);
      }
      if (termRes.status === 'fulfilled' && Array.isArray(termRes.value)) {
        setTerminals(termRes.value);
      }
    } finally {
      setLoadingTerminals(false);
    }
  }, []);

  useEffect(() => {
    fetchStatsAndDevices();
  }, [fetchStatsAndDevices]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      const next = { ...docInfo, avatarUri: dataUrl };
      setDocInfo(next);
      setEditForm((prev) => ({ ...prev, avatarUri: dataUrl }));
      localStorage.setItem('seca_doctor_profile_custom', JSON.stringify(next));
      useDoctorAuthStore.getState().updateUser({ avatar_url: dataUrl });
      window.dispatchEvent(new Event('doctor-profile-updated'));
      try {
        await authApi.updateMe({ avatar_url: dataUrl });
      } catch {
        // ignore
      }
      showToast('Đã cập nhật ảnh đại diện Bác sĩ thành công.');
    };
    reader.readAsDataURL(file);
  };

  const handleResetAvatar = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = { ...docInfo, avatarUri: null };
    setDocInfo(next);
    setEditForm((prev) => ({ ...prev, avatarUri: null }));
    localStorage.setItem('seca_doctor_profile_custom', JSON.stringify(next));
    useDoctorAuthStore.getState().updateUser({ avatar_url: null });
    window.dispatchEvent(new Event('doctor-profile-updated'));
    try {
      await authApi.deleteAvatar();
    } catch {
      try {
        await authApi.updateMe({ avatar_url: null });
      } catch {}
    }
    showToast('Đã đặt lại ảnh đại diện mặc định (Chữ M nền xanh y tế).');
  };

  const handleOpenEdit = () => {
    setEditForm(docInfo);
    setActiveModal('EDIT_PROFILE');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) return;
    setSavingProfile(true);
    try {
      const updated = {
        ...editForm,
        name: editForm.name.trim(),
        degree: editForm.degree.trim(),
        specialty: editForm.specialty.trim(),
        hospital: editForm.hospital.trim(),
        department: editForm.department.trim(),
        phone: editForm.phone.trim(),
      };
      setDocInfo(updated);
      localStorage.setItem('seca_doctor_profile_custom', JSON.stringify(updated));
      useDoctorAuthStore.getState().updateUser({
        full_name: updated.name,
        specialty: updated.specialty,
        workplace: updated.hospital,
        avatar_url: updated.avatarUri || null,
      });
      window.dispatchEvent(new Event('doctor-profile-updated'));
      try {
        await authApi.updateMe({
          full_name: updated.name,
          specialty: updated.specialty,
          workplace: updated.hospital,
          avatar_url: updated.avatarUri || null,
        });
      } catch {
        // ignore
      }
      setActiveModal('NONE');
      showToast('Đã cập nhật hồ sơ chuyên môn Bác sĩ thành công.');
    } finally {
      setSavingProfile(false);
    }
  };

  const pwdRules = [
    { valid: newPassword.length >= 8 && newPassword.length <= 16, text: 'Độ dài 8 - 16 ký tự' },
    { valid: /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword), text: 'Chữ hoa & chữ thường' },
    { valid: /[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword), text: 'Có số & ký tự đặc biệt (!@#$)' },
  ];
  const isConfirmMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');
    if (!oldPassword.trim()) return setPwdError('Vui lòng nhập mật khẩu hiện tại.');
    if (!pwdRules.every((r) => r.valid)) {
      return setPwdError('Mật khẩu mới phải từ 8-16 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.');
    }
    if (!isConfirmMatch) return setPwdError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
    if (oldPassword === newPassword) return setPwdError('Mật khẩu mới phải khác mật khẩu hiện tại.');

    setSavingPwd(true);
    try {
      await authApi.changePassword({
        current_password: oldPassword,
        new_password: newPassword,
        confirm_new_password: confirmPassword,
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActiveModal('NONE');
      showToast('Đã thay đổi mật khẩu tài khoản Bác sĩ thành công.');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setPwdError(
        typeof detail === 'string'
          ? detail
          : 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại.'
      );
    } finally {
      setSavingPwd(false);
    }
  };

  const getDoctorInitial = (name?: string) => {
    if (!name) return 'M';
    const clean = name.replace(/^(bs\.|bác sĩ|dr\.)\s+/i, '').trim();
    const parts = clean.split(/\s+/);
    return parts[parts.length - 1]?.[0]?.toUpperCase() || 'M';
  };
  const doctorInitial = getDoctorInitial(docInfo.name);
  const hasMobile = terminals.some((t) => t.device_type === 'mobile');

  const menuActions = [
    {
      icon: Monitor,
      bg: 'bg-indigo-600',
      title: 'Thiết bị đang đăng nhập (Web & App)',
      sub: hasMobile
        ? 'Đang mở song song trên cả Máy tính (Web) & Điện thoại (App)'
        : 'Đang mở trên Cổng Web Máy tính',
      onClick: () => {
        setActiveModal('DEVICES');
        fetchStatsAndDevices();
      },
    },
    {
      icon: KeyRound,
      bg: 'bg-sky-600',
      title: 'Đổi mật khẩu',
      sub: 'Bảo mật tài khoản đăng nhập Cổng Bác sĩ',
      onClick: () => {
        setPwdError('');
        setPwdSuccess('');
        setActiveModal('PASSWORD');
      },
    },
    {
      icon: Bell,
      bg: 'bg-amber-500',
      title: 'Cài đặt thông báo ca trực',
      sub: 'Chuông cảnh báo sinh hiệu & nhắc lịch khám',
      onClick: () => setActiveModal('NOTIF'),
    },
    {
      icon: FileCheck2,
      bg: 'bg-emerald-600',
      title: 'Chính sách & Bảo mật dữ liệu',
      sub: 'Tiêu chuẩn an toàn hồ sơ bệnh án điện tử',
      onClick: () => setActiveModal('COMPLIANCE'),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarChange}
      />

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Tiêu đề trang */}
      <div>
        <h1 className="font-heading text-xl lg:text-2xl font-extrabold text-slate-900">
          Cài đặt & Hồ sơ Bác sĩ
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Quản lý thông tin hành nghề, chứng chỉ CCHN, thiết bị đăng nhập và cài đặt hệ thống
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái: Card Hồ sơ Bác sĩ, Thống kê & Pháp lý (6 cột) */}
        <div className="lg:col-span-6 space-y-5">
          {/* 1. Hero Profile Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              {/* Avatar */}
              <div className="flex flex-col items-center sm:items-start gap-1.5 shrink-0">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-20 w-20 cursor-pointer group"
                  title="Nhấn để đổi ảnh đại diện"
                >
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-blue-600 text-2xl font-extrabold text-white shadow-md">
                    {docInfo.avatarUri ? (
                      <img src={docInfo.avatarUri} alt={docInfo.name} className="h-full w-full object-cover" />
                    ) : (
                      doctorInitial
                    )}
                  </div>
                  <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
                  <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-xs group-hover:scale-110 transition">
                    <Camera className="h-3.5 w-3.5" />
                  </span>
                </div>
                {docInfo.avatarUri && (
                  <button
                    type="button"
                    onClick={handleResetAvatar}
                    className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 hover:underline transition"
                    title="Khôi phục về chữ M nền xanh chuẩn y tế"
                  >
                    Xóa ảnh / Đặt lại
                  </button>
                )}
              </div>

              {/* Thông tin */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Đã xác minh CCHN
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                    <Monitor className="h-3 w-3" />
                    Web MT + App ĐT
                  </span>
                </div>
                <h2 className="truncate text-lg font-extrabold text-slate-900">{docInfo.name}</h2>
                <p className="text-xs font-bold text-blue-600 mt-0.5">{docInfo.degree}</p>
                <p className="text-xs text-slate-500 mt-0.5">{docInfo.specialty}</p>
              </div>
            </div>

            <button
              onClick={handleOpenEdit}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 py-2.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
            >
              <Edit3 className="h-4 w-4" />
              <span>Chỉnh sửa hồ sơ chuyên môn Bác sĩ</span>
            </button>
          </div>

          {/* 2. Thống kê 2 cột: Bệnh nhân & Lịch khám */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Users className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-slate-500">Bệnh nhân</span>
              </div>
              <p className="text-2xl font-extrabold text-blue-600">{patientCount}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Đang phụ trách điều trị</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <Calendar className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-slate-500">Lịch khám</span>
              </div>
              <p className="text-2xl font-extrabold text-teal-600">{appointmentCount}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Ca khám bệnh</p>
            </div>
          </div>

          {/* 3. Thông tin hành nghề & Pháp lý */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Award className="h-4 w-4" />
                </div>
                <span className="text-xs font-extrabold tracking-wide text-slate-900">
                  HỒ SƠ CHUYÊN MÔN & PHÁP LÝ
                </span>
              </div>
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-blue-700">
                BỘ Y TẾ CẤP
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">Số chứng chỉ CCHN:</span>
                <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-bold text-blue-700">
                  {docInfo.cchn_number}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">Đơn vị công tác:</span>
                <span className="font-semibold text-slate-900">{docInfo.hospital}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">Chuyên khoa phụ trách:</span>
                <span className="font-semibold text-slate-900">{docInfo.department}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">SĐT trực cấp cứu:</span>
                <span className="font-bold text-blue-600">{maskPhone(docInfo.phone)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cột phải: Cấu hình ngưỡng cảnh báo sinh hiệu, Loa Hub & Bảo mật tài khoản (6 cột) */}
        <div className="lg:col-span-6 space-y-5">
          {/* 1. Thẻ Cấu hình Ngưỡng Cảnh báo Sinh hiệu & Thông báo Loa Hub */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Bell className="h-4 w-4" />
                </div>
                <span className="text-xs font-extrabold uppercase tracking-wide text-slate-900">
                  Ngưỡng Cảnh báo Sinh hiệu & Loa Hub
                </span>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                Đang kích hoạt
              </span>
            </div>

            {/* Ngưỡng Nhịp tim & SpO2 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                <label className="block text-[10px] font-bold uppercase text-slate-400">
                  Ngưỡng Nhịp tim tối đa
                </label>
                <div className="mt-1 flex items-center justify-between">
                  <input
                    type="number"
                    value={hrThresholdMax}
                    onChange={(e) => setHrThresholdMax(e.target.value)}
                    className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-extrabold text-slate-900 focus:border-blue-600 focus:outline-hidden"
                  />
                  <span className="text-xs font-bold text-rose-600">bpm (Cảnh báo)</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                <label className="block text-[10px] font-bold uppercase text-slate-400">
                  Ngưỡng SpO2 tối thiểu
                </label>
                <div className="mt-1 flex items-center justify-between">
                  <input
                    type="number"
                    value={spo2ThresholdMin}
                    onChange={(e) => setSpo2ThresholdMin(e.target.value)}
                    className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-extrabold text-slate-900 focus:border-blue-600 focus:outline-hidden"
                  />
                  <span className="text-xs font-bold text-blue-600">% (Suy hô hấp)</span>
                </div>
              </div>
            </div>

            {/* Danh sách Toggle Switch hiện đại */}
            <div className="space-y-3.5 divide-y divide-slate-100">
              {[
                {
                  title: 'Cảnh báo Nhịp tim & SpO2 vượt ngưỡng an toàn',
                  sub: `Báo động đỏ khi Nhịp tim > ${hrThresholdMax} bpm hoặc SpO2 < ${spo2ThresholdMin}%`,
                  val: notifyEmergency,
                  setVal: setNotifyEmergency,
                },
                {
                  title: 'Tự động phát giọng nói nhắc nhở qua Loa Hub',
                  sub: 'Đồng bộ lịch uống thuốc và lịch khám xuống thiết bị Hub gia đình',
                  val: notifyHubSpeaker,
                  setVal: setNotifyHubSpeaker,
                },
                {
                  title: 'Nhắc lịch khám định kỳ (Trước 24h & 2h)',
                  sub: 'Gửi thông báo đẩy đồng thời trên Web Máy tính và App Điện thoại',
                  val: notifyAppt,
                  setVal: setNotifyAppt,
                },
                {
                  title: 'Ưu tiên cuộc gọi & cảnh báo té ngã khẩn cấp',
                  sub: 'Phát âm thanh cảnh báo mức cao nhất ngay cả khi ở chế độ im lặng',
                  val: notifyFallAlert,
                  setVal: setNotifyFallAlert,
                },
              ].map((sw) => (
                <div key={sw.title} className="flex items-center justify-between gap-4 pt-3 first:pt-0">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">{sw.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{sw.sub}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sw.setVal(!sw.val);
                      showToast(`Đã cập nhật cấu hình: ${sw.title}`);
                    }}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      sw.val ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                        sw.val ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Bảo mật Tài khoản & Quản lý Thiết bị */}
          <div>
            <p className="px-1 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              BẢO MẬT TÀI KHOẢN & THIẾT BỊ ĐỒNG BỘ
            </p>
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white divide-y divide-slate-100 shadow-xs">
              {menuActions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    onClick={item.onClick}
                    className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-slate-50"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${item.bg}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900">{item.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{item.sub}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                  </button>
                );
              })}

              {/* Chế độ nền tối (Tối ưu thị giác khi trực ca đêm - Đồng bộ 100% với App Mobile) */}
              <div className="flex w-full items-center justify-between gap-3.5 px-4 py-3.5 transition hover:bg-slate-50">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white bg-blue-600">
                    <Moon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">Chế độ nền tối</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      Tối ưu thị giác khi Bác sĩ trực ca đêm
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    isDarkMode ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                      isDarkMode ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Nút Đăng xuất */}
          <button
            onClick={() => setActiveModal('LOGOUT')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white py-3.5 text-xs font-bold text-rose-600 shadow-xs transition hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" />
            <span>Đăng xuất khỏi tài khoản Bác sĩ</span>
          </button>
        </div>
      </div>

      {/* =========================================================
          MODAL 1: CHỈNH SỬA HỒ SƠ BÁC SĨ
         ========================================================= */}
      {activeModal === 'EDIT_PROFILE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-extrabold text-slate-900">Sửa Hồ Sơ Bác Sĩ</h3>
              <button onClick={() => setActiveModal('NONE')} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-base font-bold text-white shrink-0">
                  {editForm.avatarUri ? (
                    <img src={editForm.avatarUri} alt="" className="h-full w-full object-cover" />
                  ) : (
                    doctorInitial
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-100"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Chọn / Đổi ảnh</span>
                  </button>
                  {editForm.avatarUri && (
                    <button
                      type="button"
                      onClick={() => setEditForm((prev) => ({ ...prev, avatarUri: null }))}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Xóa ảnh</span>
                    </button>
                  )}
                </div>
              </div>

              {[
                { label: 'Họ và tên Bác sĩ (*)', key: 'name' as const, placeholder: 'Nhập họ và tên bác sĩ' },
                { label: 'Học hàm, học vị', key: 'degree' as const, placeholder: 'VD: Bác sĩ CKI, Thạc sĩ Y khoa...' },
                { label: 'Chuyên khoa', key: 'specialty' as const, placeholder: 'VD: Lão khoa, Tim mạch...' },
                { label: 'Bệnh viện / Cơ sở y tế', key: 'hospital' as const, placeholder: 'VD: Bệnh viện Đa khoa Đà Nẵng' },
                { label: 'Khoa / Phòng công tác', key: 'department' as const, placeholder: 'VD: Khoa Chăm sóc Người cao tuổi' },
                { label: 'Số điện thoại liên hệ (*)', key: 'phone' as const, placeholder: 'VD: 0905111222' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                  <input
                    type="text"
                    value={editForm[f.key] || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal('NONE')}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingProfile ? 'Đang lưu...' : 'Lưu Hồ Sơ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 2: ĐỔI MẬT KHẨU BÁC SĨ
         ========================================================= */}
      {activeModal === 'PASSWORD' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-extrabold text-slate-900">Đổi Mật Khẩu Bác Sĩ</h3>
              </div>
              <button onClick={() => setActiveModal('NONE')} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {pwdError && (
              <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-600">
                {pwdError}
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-3">
              {[
                { key: 'old' as const, label: 'Mật khẩu hiện tại (*)', val: oldPassword, setVal: setOldPassword, ph: 'Nhập mật khẩu hiện tại' },
                { key: 'new' as const, label: 'Mật khẩu mới (*)', val: newPassword, setVal: setNewPassword, ph: '8 - 16 ký tự (Hoa, thường, số, đặc biệt)' },
                { key: 'confirm' as const, label: 'Xác nhận mật khẩu mới (*)', val: confirmPassword, setVal: setConfirmPassword, ph: 'Nhập lại mật khẩu mới' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                  <div className="relative">
                    <input
                      type={showPwd[f.key] ? 'text' : 'password'}
                      value={f.val}
                      onChange={(e) => f.setVal(e.target.value)}
                      placeholder={f.ph}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => ({ ...s, [f.key]: !s[f.key] }))}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPwd[f.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {f.key === 'new' && newPassword.length > 0 && (
                    <div className="mt-2 space-y-1 rounded-xl bg-slate-50 p-2.5">
                      {pwdRules.map((r) => (
                        <div key={r.text} className="flex items-center gap-1.5 text-[11px]">
                          {r.valid ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 text-slate-400" />
                          )}
                          <span className={r.valid ? 'font-semibold text-emerald-600' : 'text-slate-500'}>
                            {r.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal('NONE')}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingPwd}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingPwd ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 3: THIẾT BỊ ĐANG ĐĂNG NHẬP (WEB & APP)
         ========================================================= */}
      {activeModal === 'DEVICES' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-extrabold text-slate-900">Thiết bị Bác sĩ đang mở</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchStatsAndDevices}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingTerminals ? 'animate-spin text-blue-600' : ''}`} />
                </button>
                <button onClick={() => setActiveModal('NONE')} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
              {terminals.map((t) => {
                const isDesktop = t.device_type === 'desktop';
                return (
                  <div
                    key={String(t.id)}
                    className={`flex items-start justify-between rounded-xl border p-3.5 ${
                      t.is_current ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${
                          isDesktop ? 'bg-blue-600' : 'bg-emerald-600'
                        }`}
                      >
                        {isDesktop ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {t.device_name || (isDesktop ? 'Cổng Web Bác sĩ — Máy tính' : 'Ứng dụng SECA — Điện thoại')}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {t.browser || (isDesktop ? 'Doctor Web Portal' : 'SECA Mobile App')} • {t.location || 'Đà Nẵng, VN'}
                        </p>
                        <p className={`text-[11px] font-bold mt-1 ${t.is_current ? 'text-blue-600' : 'text-emerald-600'}`}>
                          {t.is_current ? '● Đang mở trên thiết bị này' : '● Đang trực tuyến song song'}
                        </p>
                      </div>
                    </div>
                    {!t.is_current && (
                      <button
                        onClick={async () => {
                          await authApi.deleteTerminal(String(t.id)).catch(() => {});
                          fetchStatsAndDevices();
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Thu hồi phiên đăng nhập"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setActiveModal('NONE')}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 4: CÀI ĐẶT THÔNG BÁO CA TRỰC
         ========================================================= */}
      {activeModal === 'NOTIF' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-extrabold text-slate-900">Cài đặt thông báo</h3>
              </div>
              <button onClick={() => setActiveModal('NONE')} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 mb-5">
              {[
                {
                  title: 'Cảnh báo sinh hiệu nguy cấp',
                  sub: 'Tự động phát chuông to khi phát hiện cụ bị té ngã hoặc suy hô hấp',
                  val: notifyEmergency,
                  setVal: setNotifyEmergency,
                },
                {
                  title: 'Nhắc nhở ca trực & Lịch khám',
                  sub: 'Thông báo trước giờ thăm khám định kỳ của bệnh nhân',
                  val: notifyAppt,
                  setVal: setNotifyAppt,
                },
              ].map((sw) => (
                <div key={sw.title} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{sw.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{sw.sub}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => sw.setVal(!sw.val)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      sw.val ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition ${
                        sw.val ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setActiveModal('NONE');
                showToast('Đã lưu cài đặt thông báo ca trực.');
              }}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              Lưu cài đặt
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 5: CHÍNH SÁCH & BẢO MẬT DỮ LIỆU
         ========================================================= */}
      {activeModal === 'COMPLIANCE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-900">Chính sách bảo mật dữ liệu</h3>
              </div>
              <button onClick={() => setActiveModal('NONE')} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-80 overflow-y-auto mb-5">
              {COMPLIANCE_SECTIONS.map((item) => (
                <div key={item.title}>
                  <p className="text-xs font-bold text-slate-900 mb-1">{item.title}</p>
                  <p className="text-xs leading-relaxed text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveModal('NONE')}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              Đã hiểu & Đồng ý
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 6: XÁC NHẬN ĐĂNG XUẤT
         ========================================================= */}
      {activeModal === 'LOGOUT' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <LogOut className="h-7 w-7" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1.5">
              Đăng xuất tài khoản Bác sĩ
            </h3>
            <p className="text-xs leading-relaxed text-slate-500 mb-5">
              Bạn có chắc chắn muốn đăng xuất khỏi hệ thống? Mọi phiên làm việc và bảo mật hồ sơ bệnh án sẽ được kết thúc.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setActiveModal('NONE')}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                onClick={logout}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-700"
              >
                Đăng xuất ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

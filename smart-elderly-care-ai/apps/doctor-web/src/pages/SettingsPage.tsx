// src/pages/SettingsPage.tsx
// Trang Cài đặt & Hồ sơ Bác sĩ Gia đình (Đồng bộ 100% tính năng với tab Cài đặt trên Mobile App)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDoctorAuthStore, getDoctorAvatarUri } from '../store/useDoctorAuthStore';
import { authApi, doctorApi } from '../services/api';
import { useDoctorDataStore } from '../store/useDoctorDataStore';
import { DoctorProfileInfo } from '../types';
import {
  DoctorEditProfileModal,
  DoctorChangePasswordModal,
  DoctorDevicesModal,
  DoctorNotificationModal,
  DoctorComplianceModal,
  DoctorLogoutModal,
} from '../components/settings';
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
  CheckCircle2,
  Moon,
} from 'lucide-react';

const maskPhone = (phone?: string) => {
  const c = phone?.trim() || '';
  return !c ? 'Chưa cập nhật' : c.length <= 4 ? '***' : `${c.slice(0, 3)}****${c.slice(-3)}`;
};

export const SettingsPage: React.FC = () => {
  const { user, logout } = useDoctorAuthStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [docInfo, setDocInfo] = useState<DoctorProfileInfo>(() => {
    const saved = localStorage.getItem('seca_doctor_profile_custom');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      name: parsed.name || user?.full_name || 'BS. Trần Văn Minh',
      gender: parsed.gender || (user as any)?.gender || 'Nam',
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

  const [patientCount, setPatientCount] = useState(() => useDoctorDataStore.getState().patients.length);
  const [appointmentCount, setAppointmentCount] = useState(() => useDoctorDataStore.getState().appointments.length);
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
  const [pwdError, setPwdError] = useState('');
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
        gender: editForm.gender || 'Nam',
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
        ...({ gender: updated.gender } as any),
      });
      window.dispatchEvent(new Event('doctor-profile-updated'));
      try {
        await authApi.updateMe({
          full_name: updated.name,
          specialty: updated.specialty,
          workplace: updated.hospital,
          avatar_url: updated.avatarUri || null,
          ...({ gender: updated.gender } as any),
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

  const handleSavePassword = async (oldPwd: string, newPwd: string, confirmPwd: string) => {
    setPwdError('');
    if (!oldPwd.trim()) {
      setPwdError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPwd.length < 8 || newPwd.length > 16) {
      setPwdError('Mật khẩu mới phải từ 8-16 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }
    if (oldPwd === newPwd) {
      setPwdError('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }

    setSavingPwd(true);
    try {
      await authApi.changePassword({
        current_password: oldPwd,
        new_password: newPwd,
        confirm_new_password: confirmPwd,
      });
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

  const handleRevokeTerminal = async (terminalId: string) => {
    try {
      await authApi.deleteTerminal(terminalId);
      await fetchStatsAndDevices();
      showToast('Đã thu hồi phiên đăng nhập thành công.');
    } catch {
      showToast('Không thể thu hồi phiên đăng nhập.');
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
                  <span className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full ring-2 ring-white shadow-md bg-emerald-500 z-10" />
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
                <span className="font-medium text-slate-500">Giới tính:</span>
                <span className="font-semibold text-slate-900">{docInfo.gender || 'Nam'}</span>
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

      {/* MODALS */}
      {activeModal === 'EDIT_PROFILE' && (
        <DoctorEditProfileModal
          editForm={editForm}
          setEditForm={setEditForm}
          doctorInitial={doctorInitial}
          savingProfile={savingProfile}
          onClose={() => setActiveModal('NONE')}
          onSave={handleSaveProfile}
          onTriggerFileInput={() => fileInputRef.current?.click()}
        />
      )}

      {activeModal === 'PASSWORD' && (
        <DoctorChangePasswordModal
          onClose={() => setActiveModal('NONE')}
          onSavePassword={handleSavePassword}
          pwdError={pwdError}
          savingPwd={savingPwd}
        />
      )}

      {activeModal === 'DEVICES' && (
        <DoctorDevicesModal
          terminals={terminals}
          loadingTerminals={loadingTerminals}
          onRefresh={fetchStatsAndDevices}
          onRevokeTerminal={handleRevokeTerminal}
          onClose={() => setActiveModal('NONE')}
        />
      )}

      {activeModal === 'NOTIF' && (
        <DoctorNotificationModal
          notifyEmergency={notifyEmergency}
          setNotifyEmergency={setNotifyEmergency}
          notifyAppt={notifyAppt}
          setNotifyAppt={setNotifyAppt}
          onSave={() => {
            setActiveModal('NONE');
            showToast('Đã lưu cài đặt thông báo ca trực.');
          }}
          onClose={() => setActiveModal('NONE')}
        />
      )}

      {activeModal === 'COMPLIANCE' && (
        <DoctorComplianceModal onClose={() => setActiveModal('NONE')} />
      )}

      {activeModal === 'LOGOUT' && (
        <DoctorLogoutModal
          onClose={() => setActiveModal('NONE')}
          onLogout={logout}
        />
      )}
    </div>
  );
};
export default SettingsPage;

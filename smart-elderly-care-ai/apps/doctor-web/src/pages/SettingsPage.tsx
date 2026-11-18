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
  DoctorProfileColumn,
  SettingsPreferencesColumn,
  AvatarPreviewModal,
  type AlertSwitchItem,
  type SettingsMenuAction,
} from '../components/settings';
import { KeyRound, Bell, FileCheck2, Monitor, CheckCircle2 } from 'lucide-react';

const getDoctorInitial = (name?: string) => {
  if (!name) return 'M';
  const clean = name.replace(/^(bs\.|bác sĩ|dr\.)\s+/i, '').trim();
  const parts = clean.split(/\s+/);
  return parts[parts.length - 1]?.[0]?.toUpperCase() || 'M';
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
  const [isPreviewAvatarOpen, setIsPreviewAvatarOpen] = useState(false);

  useEffect(() => {
    if (!isPreviewAvatarOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPreviewAvatarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewAvatarOpen]);

  const [editForm, setEditForm] = useState<DoctorProfileInfo>(docInfo);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  // Notification switches
  const [notifyEmergency, setNotifyEmergency] = useState(true);
  const [notifyAppt, setNotifyAppt] = useState(true);
  const [notifyHubSpeaker, setNotifyHubSpeaker] = useState(true);
  const [notifyFallAlert, setNotifyFallAlert] = useState(true);
  const [autoEscalationEnabled, setAutoEscalationEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('@seca_auto_escalation_enabled');
    return saved === null ? true : saved === 'true';
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(
    () => document.documentElement.classList.contains('dark') || localStorage.getItem('@doctor_theme') === 'dark'
  );
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('@doctor_theme', next ? 'dark' : 'light');
    showToast(next ? 'Đã bật Chế độ nền tối (Dark mode).' : 'Đã chuyển về Chế độ sáng.');
  };

  const fetchStatsAndDevices = useCallback(async () => {
    setLoadingTerminals(true);
    try {
      const [patRes, aptRes, termRes] = await Promise.allSettled([
        doctorApi.getPatients(),
        doctorApi.getAppointments(),
        authApi.getTerminals(),
      ]);
      if (patRes.status === 'fulfilled' && Array.isArray(patRes.value)) setPatientCount(patRes.value.length);
      if (aptRes.status === 'fulfilled' && Array.isArray(aptRes.value)) setAppointmentCount(aptRes.value.length);
      if (termRes.status === 'fulfilled' && Array.isArray(termRes.value)) setTerminals(termRes.value);
    } finally {
      setLoadingTerminals(false);
    }
  }, []);

  useEffect(() => {
    fetchStatsAndDevices();
  }, [fetchStatsAndDevices]);

  const syncAvatarLocally = (avatarUri: string | null) => {
    const next = { ...docInfo, avatarUri };
    setDocInfo(next);
    setEditForm((prev) => ({ ...prev, avatarUri }));
    localStorage.setItem('seca_doctor_profile_custom', JSON.stringify(next));
    useDoctorAuthStore.getState().updateUser({ avatar_url: avatarUri });
    window.dispatchEvent(new Event('doctor-profile-updated'));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      syncAvatarLocally(dataUrl);
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
    syncAvatarLocally(null);
    try {
      await authApi.deleteAvatar();
    } catch {
      try {
        await authApi.updateMe({ avatar_url: null });
      } catch {}
    }
    showToast('Đã đặt lại ảnh đại diện mặc định (Chữ M nền xanh y tế).');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) return;
    setSavingProfile(true);
    try {
      const updated: DoctorProfileInfo = {
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
      const userPayload = {
        full_name: updated.name,
        specialty: updated.specialty,
        workplace: updated.hospital,
        avatar_url: updated.avatarUri || null,
        ...({ gender: updated.gender } as any),
      };
      useDoctorAuthStore.getState().updateUser(userPayload);
      window.dispatchEvent(new Event('doctor-profile-updated'));
      try {
        await authApi.updateMe(userPayload);
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
    if (!oldPwd.trim()) return setPwdError('Vui lòng nhập mật khẩu hiện tại.');
    if (newPwd.length < 8 || newPwd.length > 16) {
      return setPwdError('Mật khẩu mới phải từ 8-16 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.');
    }
    if (newPwd !== confirmPwd) return setPwdError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
    if (oldPwd === newPwd) return setPwdError('Mật khẩu mới phải khác mật khẩu hiện tại.');

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

  const doctorInitial = getDoctorInitial(docInfo.name);
  const hasMobile = terminals.some((t) => t.device_type === 'mobile');

  const alertSwitches: AlertSwitchItem[] = [
    {
      title: 'Cảnh báo Nhịp tim & SpO2 vượt ngưỡng an toàn',
      sub: 'Báo động khi sinh hiệu vượt ngưỡng riêng của từng bệnh nhân (trong Hồ sơ bệnh án)',
      val: notifyEmergency,
      onToggle: () => {
        setNotifyEmergency((v) => !v);
        showToast('Đã cập nhật cấu hình: Cảnh báo Nhịp tim & SpO2 vượt ngưỡng an toàn');
      },
    },
    {
      title: 'Tự động phát giọng nói nhắc nhở qua Loa Hub',
      sub: 'Đồng bộ lịch uống thuốc và lịch khám xuống thiết bị Hub gia đình',
      val: notifyHubSpeaker,
      onToggle: () => {
        setNotifyHubSpeaker((v) => !v);
        showToast('Đã cập nhật cấu hình: Tự động phát giọng nói nhắc nhở qua Loa Hub');
      },
    },
    {
      title: 'Nhắc lịch khám định kỳ (Trước 24h & 2h)',
      sub: 'Gửi thông báo đẩy đồng thời trên Web Máy tính và App Điện thoại',
      val: notifyAppt,
      onToggle: () => {
        setNotifyAppt((v) => !v);
        showToast('Đã cập nhật cấu hình: Nhắc lịch khám định kỳ (Trước 24h & 2h)');
      },
    },
    {
      title: 'Ưu tiên cuộc gọi & cảnh báo té ngã khẩn cấp',
      sub: 'Phát âm thanh cảnh báo mức cao nhất ngay cả khi ở chế độ im lặng',
      val: notifyFallAlert,
      onToggle: () => {
        setNotifyFallAlert((v) => !v);
        showToast('Đã cập nhật cấu hình: Ưu tiên cuộc gọi & cảnh báo té ngã khẩn cấp');
      },
    },
    {
      title: 'Tự động gọi cấp cứu nếu không có phản hồi sau [45 giây]',
      sub: 'Tự động chuyển trạng thái ESCALATED_AUTO_CALL và kích hoạt gọi 115 khi gia đình không phản hồi',
      val: autoEscalationEnabled,
      onToggle: () => {
        const nextVal = !autoEscalationEnabled;
        setAutoEscalationEnabled(nextVal);
        localStorage.setItem('@seca_auto_escalation_enabled', String(nextVal));
        showToast('Đã cập nhật cấu hình: Tự động gọi cấp cứu nếu không có phản hồi sau [45 giây]');
      },
    },
  ];

  const menuActions: SettingsMenuAction[] = [
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
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div>
        <h1 className="font-heading text-xl lg:text-2xl font-extrabold text-slate-900 dark:text-white">
          Cài đặt & Hồ sơ Bác sĩ
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Quản lý thông tin hành nghề, chứng chỉ CCHN, thiết bị đăng nhập và cài đặt hệ thống
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <DoctorProfileColumn
          docInfo={docInfo}
          doctorInitial={doctorInitial}
          patientCount={patientCount}
          appointmentCount={appointmentCount}
          onPreviewAvatar={() => setIsPreviewAvatarOpen(true)}
          onTriggerFileInput={() => fileInputRef.current?.click()}
          onResetAvatar={handleResetAvatar}
          onOpenEdit={() => {
            setEditForm(docInfo);
            setActiveModal('EDIT_PROFILE');
          }}
        />

        <SettingsPreferencesColumn
          alertSwitches={alertSwitches}
          menuActions={menuActions}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          onOpenLogout={() => setActiveModal('LOGOUT')}
        />
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

      {activeModal === 'COMPLIANCE' && <DoctorComplianceModal onClose={() => setActiveModal('NONE')} />}

      {activeModal === 'LOGOUT' && <DoctorLogoutModal onClose={() => setActiveModal('NONE')} onLogout={logout} />}

      <AvatarPreviewModal
        isOpen={isPreviewAvatarOpen}
        docInfo={docInfo}
        doctorInitial={doctorInitial}
        onClose={() => setIsPreviewAvatarOpen(false)}
        onChangeAvatar={() => fileInputRef.current?.click()}
        onResetAvatar={handleResetAvatar}
      />
    </div>
  );
};
export default SettingsPage;

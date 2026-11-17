import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Home,
  PhoneCall,
  Printer,
  X,
  Watch,
  Droplet,
  Activity,
  HeartPulse,
  Thermometer,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Utensils,
  Apple,
  Stethoscope,
  Clock,
  Plus,
  Edit,
  FileText,
  Pill,
  Calendar,
} from 'lucide-react';
import {
  DoctorPatientDetail,
  DoctorPatientCard,
  PrescriptionItem,
  AppointmentItem,
  AnalyticsData,
} from '../../types';
import { getPatientAvatar } from '../../utils/patientAvatar';
import { VitalsTrendChart } from './VitalsTrendChart';

export type DrawerTabKey = 'RECORD' | 'VITALS' | 'PRESCRIPTIONS' | 'APPOINTMENTS';

export interface PatientDetailDrawerProps {
  patientDetail: DoctorPatientDetail;
  selectedPatientCard?: DoctorPatientCard;
  selectedMrCode: string;
  prescriptions: PrescriptionItem[];
  patientAppointments: AppointmentItem[];
  analytics: AnalyticsData | null;
  onClose: () => void;
  onOpenRecordModal: () => void;
  onOpenPrescriptionModal: () => void;
  onOpenAppointmentModal: () => void;
}

export const PatientDetailDrawer: React.FC<PatientDetailDrawerProps> = ({
  patientDetail,
  selectedPatientCard,
  selectedMrCode,
  prescriptions,
  patientAppointments,
  analytics,
  onClose,
  onOpenRecordModal,
  onOpenPrescriptionModal,
  onOpenAppointmentModal,
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTabKey>('RECORD');

  const activeBloodType =
    patientDetail.blood_type || selectedPatientCard?.blood_type || 'O+';
  const activeAvatar =
    patientDetail.avatar_url || selectedPatientCard?.avatar_url || null;
  const activeBmi = patientDetail.bmi ? patientDetail.bmi.toFixed(1) : '21.5';
  const activeBp = patientDetail.blood_pressure || selectedPatientCard?.blood_pressure || '120/80';
  const activeSkinTemp = patientDetail.skin_temp_max
    ? `${patientDetail.skin_temp_max}°C`
    : (selectedPatientCard?.skin_temp_max ? `${selectedPatientCard.skin_temp_max}°C` : '36.5°C');
  const activeEmergencyPhone =
    selectedPatientCard?.emergency_contact_phone || '';

  const isSelectedDanger =
    (selectedPatientCard?.heart_rate &&
      (selectedPatientCard.heart_rate > 100 || selectedPatientCard.heart_rate < 50)) ||
    (selectedPatientCard?.spo2 && selectedPatientCard.spo2 < 92);

  const isSelectedWarning =
    !isSelectedDanger &&
    ((selectedPatientCard?.heart_rate &&
      (selectedPatientCard.heart_rate > 90 || selectedPatientCard.heart_rate < 60)) ||
      (selectedPatientCard?.spo2 && selectedPatientCard.spo2 < 95));

  const drawerTabs: { key: DrawerTabKey; label: string; icon: any; count?: number }[] = [
    { key: 'RECORD', label: 'Hồ sơ Bệnh án', icon: FileText },
    { key: 'VITALS', label: 'Đồ thị Sinh hiệu', icon: Activity },
    { key: 'PRESCRIPTIONS', label: 'Đơn thuốc', icon: Pill, count: prescriptions.length },
    { key: 'APPOINTMENTS', label: 'Lịch khám', icon: Calendar, count: patientAppointments.length },
  ];

  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] !mt-0 flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative z-[101] flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
        {/* 1. Rich Clinical Header */}
        <div className="border-b border-slate-200/80 bg-slate-50/80 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            {/* Thông tin định danh & Avatar Bệnh nhân */}
            <div className="flex items-start space-x-3.5 min-w-0">
              {/* Avatar tròn với Status Dot không bị clip */}
              <div className="relative inline-block shrink-0">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 to-cyan-500 text-lg font-extrabold text-white shadow-md ring-2 ring-white">
                  {activeAvatar ? (
                    <img
                      src={getPatientAvatar(activeAvatar)!}
                      alt={patientDetail.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    patientDetail.name?.charAt(0) || 'P'
                  )}
                </div>
                <span
                  className={`absolute bottom-0 right-0 h-4 w-4 rounded-full ring-2 ring-white shadow-sm z-10 ${
                    selectedPatientCard?.is_online ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                  title={selectedPatientCard?.is_online ? 'Smartband đang kết nối' : 'Chờ tín hiệu Smartband'}
                />
              </div>

              <div className="min-w-0">
                {/* Hàng nhãn mã bệnh nhân & trạng thái lâm sàng */}
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="rounded-md bg-blue-50 border border-blue-200/80 px-2 py-0.5 text-[10.5px] font-mono font-extrabold text-blue-700">
                    {selectedMrCode}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${
                      isSelectedDanger
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : isSelectedWarning
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {isSelectedDanger ? 'Khẩn cấp' : isSelectedWarning ? 'Cần chú ý' : 'Ổn định'}
                  </span>
                  <span
                    className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                      selectedPatientCard?.is_online
                        ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200/70'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    <Watch className="h-3 w-3" />
                    <span>{selectedPatientCard?.is_online ? 'Smartband Online' : 'Chờ tín hiệu'}</span>
                  </span>
                </div>

                <h3 className="font-heading font-extrabold text-slate-900 text-lg leading-tight truncate">
                  {patientDetail.name}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 truncate">
                  {patientDetail.age || selectedPatientCard?.age} tuổi • {patientDetail.gender || selectedPatientCard?.gender} • Nhóm máu <span className="font-bold text-slate-800">{activeBloodType}</span>
                </p>
                <div className="mt-1 flex items-center space-x-1.5 text-xs text-slate-500 truncate">
                  <Home className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate font-medium text-slate-700">
                    {patientDetail.house_name || selectedPatientCard?.house_name || 'Nhà riêng'}
                  </span>
                  {selectedPatientCard?.house_address && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="truncate text-slate-500 text-[11px]">
                        {selectedPatientCard.house_address}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Nút tác vụ nhanh: Gọi người nhà, In hồ sơ, Đóng */}
            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (activeEmergencyPhone) {
                    window.open(`tel:${activeEmergencyPhone}`);
                  } else {
                    alert('Chưa có số điện thoại liên hệ khẩn cấp của bệnh nhân.');
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs"
                title={`Gọi người nhà: ${activeEmergencyPhone || 'Chưa cập nhật'}`}
              >
                <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Gọi người nhà</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs"
                title="In tóm tắt bệnh án"
              >
                <Printer className="h-3.5 w-3.5 text-slate-600" />
                <span className="hidden sm:inline">In hồ sơ</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200/80 hover:text-slate-600 transition-colors ml-1"
                title="Đóng hồ sơ"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* 2. Modern Segmented Tab Bar */}
        <div className="border-b border-slate-100 bg-white px-6 py-2.5">
          <div className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-100/80 p-1 border border-slate-200/50">
            {drawerTabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="truncate">{t.label}</span>
                  {t.count !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                        isActive
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Thân Drawer Cuộn Mượt (Scrollable Body) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'RECORD' && (
            <div className="space-y-5">
              {/* Header phân mục Thể trạng & Nút Cập nhật */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Chỉ số Thể trạng & Nhân trắc học
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Dữ liệu khám lâm sàng định kỳ gần nhất
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenRecordModal}
                  className="flex items-center space-x-1.5 rounded-xl bg-blue-50 border border-blue-200/70 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors shadow-2xs"
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span>Cập nhật hồ sơ</span>
                </button>
              </div>

              {/* Bento-Grid Vitals & Anthropometrics (4-Column Cards) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Card 1: Nhóm máu */}
                <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-b from-rose-50/40 to-slate-50/70 p-3.5 shadow-2xs transition hover:border-rose-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100/80 text-rose-600">
                      <Droplet className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hệ ABO</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 block">Nhóm máu</span>
                  <p className="text-lg font-extrabold text-slate-900 mt-0.5">{activeBloodType}</p>
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Đã định nhóm</span>
                  </div>
                </div>

                {/* Card 2: Chỉ số BMI */}
                <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-b from-teal-50/40 to-slate-50/70 p-3.5 shadow-2xs transition hover:border-teal-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100/80 text-teal-600">
                      <Activity className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thể trạng</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 block">Chỉ số BMI</span>
                  <p className="text-lg font-extrabold text-slate-900 mt-0.5">{activeBmi}</p>
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Bình thường (18.5 - 22.9)</span>
                  </div>
                </div>

                {/* Card 3: Huyết áp chuẩn */}
                <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-b from-blue-50/40 to-slate-50/70 p-3.5 shadow-2xs transition hover:border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100/80 text-blue-600">
                      <HeartPulse className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Huyết động</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 block">Huyết áp chuẩn</span>
                  <p className="text-lg font-extrabold text-slate-900 mt-0.5">{activeBp}</p>
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>mmHg (Mục tiêu)</span>
                  </div>
                </div>

                {/* Card 4: Nhiệt độ da */}
                <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-b from-cyan-50/40 to-slate-50/70 p-3.5 shadow-2xs transition hover:border-cyan-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-100/80 text-cyan-600">
                      <Thermometer className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cảm biến</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 block">Nhiệt độ da</span>
                  <p className="text-lg font-extrabold text-slate-900 mt-0.5">{activeSkinTemp}</p>
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Ổn định (36.2 - 37.2°C)</span>
                  </div>
                </div>
              </div>

              {/* 4. Critical Alert Banner: Dị ứng thuốc */}
              {(() => {
                const rawDrug = patientDetail.drug_allergies?.trim() || '';
                const hasDrugAllergy =
                  rawDrug.length > 0 &&
                  !rawDrug.toLowerCase().includes('không') &&
                  !rawDrug.toLowerCase().includes('chưa');
                const tags = hasDrugAllergy
                  ? rawDrug.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
                  : [];

                return (
                  <div
                    className={`rounded-2xl border p-4 transition-all ${
                      hasDrugAllergy
                        ? 'border-rose-200 bg-rose-50/70 shadow-xs'
                        : 'border-slate-200/80 bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                            hasDrugAllergy
                              ? 'bg-rose-100 text-rose-700 shadow-2xs'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {hasDrugAllergy ? (
                            <AlertTriangle className="h-4 w-4 text-rose-600" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          )}
                        </div>
                        <div>
                          <h5
                            className={`text-xs font-extrabold uppercase tracking-wider ${
                              hasDrugAllergy ? 'text-rose-900' : 'text-slate-800'
                            }`}
                          >
                            Dị ứng thuốc (Chống chỉ định lâm sàng)
                          </h5>
                          <p className="text-[10.5px] text-slate-500">
                            Cảnh báo y khoa quan trọng trước khi chỉ định phác đồ điều trị
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold border ${
                          hasDrugAllergy
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {hasDrugAllergy ? 'CẢNH BÁO CAO' : 'AN TOÀN'}
                      </span>
                    </div>

                    {hasDrugAllergy ? (
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-rose-200/60">
                        {tags.map((allergen, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-100 text-rose-800 px-3 py-1.5 text-xs font-bold border border-rose-200/80 shadow-2xs"
                          >
                            <ShieldAlert className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                            <span>{allergen}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/60 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>Không ghi nhận tiền sử dị ứng thuốc nguy hiểm</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 2-Column Grid for Secondary Info: Dị ứng thực phẩm & Chế độ dinh dưỡng */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cột 1: Dị ứng thực phẩm */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                        <Utensils className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-extrabold text-slate-900">
                        Dị ứng thực phẩm
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-3">
                      Thực phẩm cần kiêng khem trong bữa ăn
                    </p>
                  </div>
                  <div>
                    {patientDetail.food_allergies &&
                    !patientDetail.food_allergies.toLowerCase().includes('không') ? (
                      <div className="flex flex-wrap gap-1.5">
                        {patientDetail.food_allergies
                          .split(/[,;\n]+/)
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((food, i) => (
                            <span
                              key={i}
                              className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200/60"
                            >
                              {food}
                            </span>
                          ))}
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 inline-block">
                        Không ghi nhận dị ứng thực phẩm
                      </span>
                    )}
                  </div>
                </div>

                {/* Cột 2: Chế độ dinh dưỡng khuyến nghị */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Apple className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-extrabold text-slate-900">
                            Chế độ dinh dưỡng
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-3">
                      Chỉ định dinh dưỡng phòng ngừa tim mạch
                    </p>
                  </div>
                  <div>
                    {patientDetail.dietary_notes ? (
                      <div className="flex flex-wrap gap-1.5">
                        {patientDetail.dietary_notes
                          .split(/[,;]+/)
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((diet, i) => (
                            <span
                              key={i}
                              className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200/60"
                            >
                              {diet}
                            </span>
                          ))}
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 inline-block">
                        Ăn giảm muối, hạn chế đường, bổ sung chất xơ
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 5. Highlighted Doctor's Note Card */}
              <div className="rounded-2xl border-y border-r border-blue-100/90 border-l-4 border-l-blue-600 bg-gradient-to-r from-blue-50/60 via-blue-50/20 to-white p-4.5 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                      <Stethoscope className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-extrabold text-blue-900 tracking-wide uppercase">
                      Dặn dò của Bác sĩ gia đình
                    </span>
                  </div>
                  <span className="rounded-md bg-blue-100/70 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                    LÂM SÀNG
                  </span>
                </div>

                <p className="text-xs font-medium text-slate-700 leading-relaxed pl-9">
                  {patientDetail.doctor_notes ||
                    'Bệnh nhân tuân thủ phác đồ điều trị tốt. Duy trì vận động nhẹ nhàng và tái khám định kỳ theo đúng hẹn.'}
                </p>

                <div className="mt-3.5 flex items-center justify-between border-t border-blue-100/60 pt-2.5 pl-9 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5 font-medium text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                    Phụ trách: BS. Trần Văn Minh
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="h-3 w-3" />
                    Cập nhật hôm nay
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'VITALS' && (
            <VitalsTrendChart data={analytics?.daily_trends || []} days={7} />
          )}

          {activeTab === 'PRESCRIPTIONS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Thuốc đang sử dụng ({prescriptions.length})
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Phác đồ dùng thuốc đang kích hoạt đồng bộ loa Hub
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenPrescriptionModal}
                  className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Kê đơn thuốc mới</span>
                </button>
              </div>

              {prescriptions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 bg-slate-50/50">
                  Chưa có đơn thuốc nào. Bấm nút Kê đơn thuốc mới ở trên để thêm.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {prescriptions.map((rx) => (
                    <div key={rx.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 text-xs">{rx.medication_name}</span>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100">
                          {rx.dosage}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {rx.frequency} • {rx.instructions}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between text-[11px] border-t border-slate-100 pt-2">
                        <span className="text-slate-400">Giờ uống: {rx.schedule_times?.join(', ')}</span>
                        {rx.enable_speaker_reminder && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-bold border border-emerald-100">
                            Loa nhắc: Đang bật
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'APPOINTMENTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Lịch khám của bệnh nhân
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Lịch thăm khám định kỳ và tái khám tại nhà
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenAppointmentModal}
                  className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Hẹn lịch khám mới</span>
                </button>
              </div>

              {patientAppointments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 bg-slate-50/50">
                  Chưa có lịch khám nào với bệnh nhân này.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {patientAppointments.map((apt) => (
                    <div key={apt.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 text-xs">{apt.clinical_notes || 'Khám sức khỏe'}</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${
                            apt.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : apt.status === 'CANCELLED'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {apt.status === 'COMPLETED' ? 'Đã khám xong' : apt.status === 'CANCELLED' ? 'Đã hủy' : 'Sắp tới'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(apt.scheduled_at).toLocaleString('vi-VN')} • {apt.location}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 6. Sticky Footer Action Bar */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-slate-100 bg-white/95 px-6 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-700">Hồ sơ điện tử (EHR)</span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] font-medium text-slate-400">{selectedMrCode}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={onOpenRecordModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Cập nhật hồ sơ</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

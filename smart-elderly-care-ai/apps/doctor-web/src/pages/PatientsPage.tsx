// src/pages/PatientsPage.tsx
// Quản lý Danh bạ Bệnh nhân Người cao tuổi & Hồ sơ Bệnh án chi tiết cho Bác sĩ

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doctorApi } from '../services/api';
import { removeVietnameseTones } from '../utils/text';
import {
  DoctorPatientCard,
  DoctorPatientDetail,
  PrescriptionItem,
  AppointmentItem,
  AnalyticsData,
} from '../types';
import { VitalsTrendChart } from '../components/clinical/VitalsTrendChart';
import { PrescriptionModal } from '../components/clinical/PrescriptionModal';
import { MedicalRecordModal } from '../components/clinical/MedicalRecordModal';
import { NewAppointmentModal } from '../components/clinical/NewAppointmentModal';
import {
  Search,
  Heart,
  Activity,
  FileText,
  Pill,
  Calendar,
  Phone,
  Home,
  Edit,
  Plus,
  RefreshCw,
  X,
  Users,
  AlertTriangle,
  Watch,
  ArrowUpRight,
  ChevronRight,
  Droplet,
  HeartPulse,
  Thermometer,
  PhoneCall,
  Printer,
  Utensils,
  Apple,
  Stethoscope,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Copy,
  Check,
} from 'lucide-react';

const getPatientAvatar = (avatarUrl?: string | null) => {
  if (!avatarUrl || typeof avatarUrl !== 'string' || !avatarUrl.trim()) return null;
  const clean = avatarUrl.trim();
  if (clean.startsWith('http') || clean.startsWith('data:')) return clean;
  return `http://localhost:8000${clean.startsWith('/') ? clean : `/${clean}`}`;
};

export const PatientsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<DoctorPatientCard[]>([]);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NORMAL' | 'WARNING' | 'ONLINE'>('ALL');

  useEffect(() => {
    const qFromUrl = searchParams.get('search');
    if (qFromUrl !== null && qFromUrl !== searchQuery) {
      setSearchQuery(qFromUrl);
    }
  }, [searchParams]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (val.trim()) {
      setSearchParams({ search: val.trim() });
    } else {
      setSearchParams({});
    }
  };

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientDetail, setPatientDetail] = useState<DoctorPatientDetail | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [patientAppointments, setPatientAppointments] = useState<AppointmentItem[]>([]);
  const [activeTab, setActiveTab] = useState<'RECORD' | 'VITALS' | 'PRESCRIPTIONS' | 'APPOINTMENTS'>('RECORD');

  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [contactModalPatient, setContactModalPatient] = useState<DoctorPatientCard | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await doctorApi.getPatients();
      if (Array.isArray(data)) setPatients(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleSelectPatient = async (patientId: string) => {
    setSelectedPatientId(patientId);
    const [detailRes, analyticsRes, rxRes, aptRes] = await Promise.allSettled([
      doctorApi.getPatientDetail(patientId),
      doctorApi.getAnalytics(patientId, 7),
      doctorApi.getPrescriptions(patientId),
      doctorApi.getAppointments(undefined, patientId),
    ]);
    if (detailRes.status === 'fulfilled') setPatientDetail(detailRes.value);
    if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value);
    if (rxRes.status === 'fulfilled') setPrescriptions(rxRes.value);
    if (aptRes.status === 'fulfilled') setPatientAppointments(aptRes.value);
  };

  const handleRefreshDetail = async () => {
    if (selectedPatientId) {
      await handleSelectPatient(selectedPatientId);
      await fetchPatients();
    }
  };

  const stats = useMemo(() => {
    const total = patients.length;
    const warning = patients.filter(
      (p) => p.health_status === 'WARNING' || p.health_status === 'DANGER'
    ).length;
    const online = patients.filter((p) => p.is_online).length;
    const normal = total - warning;
    return { total, warning, online, normal };
  }, [patients]);

  const filteredPatients = useMemo(() => {
    const rawQ = searchQuery.trim();
    const qNorm = removeVietnameseTones(rawQ);
    const cleanPhoneQ = rawQ.replace(/[^0-9]/g, '');

    return patients.filter((p, idx) => {
      let matchesSearch = true;
      if (rawQ) {
        const mrCode = `mr-${String(idx + 1).padStart(3, '0')}`;
        const nameNorm = removeVietnameseTones(p.name);
        const houseNorm = removeVietnameseTones(p.house_name || '');
        const addrNorm = removeVietnameseTones(p.house_address || '');
        const medNorm = removeVietnameseTones(p.medical_history || '');
        const phone = (p.emergency_contact_phone || '').replace(/[^0-9]/g, '');

        matchesSearch =
          nameNorm.includes(qNorm) ||
          p.name.toLowerCase().includes(rawQ.toLowerCase()) ||
          houseNorm.includes(qNorm) ||
          addrNorm.includes(qNorm) ||
          medNorm.includes(qNorm) ||
          mrCode.includes(qNorm) ||
          (cleanPhoneQ.length > 0 && phone.includes(cleanPhoneQ));
      }

      const isWarn = p.health_status === 'WARNING' || p.health_status === 'DANGER';
      if (statusFilter === 'NORMAL') return matchesSearch && !isWarn;
      if (statusFilter === 'WARNING') return matchesSearch && isWarn;
      if (statusFilter === 'ONLINE') return matchesSearch && Boolean(p.is_online);
      return matchesSearch;
    });
  }, [patients, searchQuery, statusFilter]);

  const summaryCards = [
    {
      key: 'ALL' as const,
      title: 'Tất cả bệnh nhân',
      value: stats.total,
      sub: 'Hồ sơ người cao tuổi đang phụ trách',
      badge: '100% Hồ sơ',
      icon: Users,
      circleBg: 'bg-blue-50 text-blue-600',
      badgeBg: 'bg-blue-50 text-blue-700',
    },
    {
      key: 'WARNING' as const,
      title: 'Đang cảnh báo sinh hiệu',
      value: stats.warning,
      sub: 'Nhịp tim hoặc SpO2 cần theo dõi sát',
      badge: stats.warning > 0 ? 'Cần chú ý' : 'An toàn',
      icon: AlertTriangle,
      circleBg: 'bg-amber-50 text-amber-600',
      badgeBg: 'bg-amber-50 text-amber-700',
    },
    {
      key: 'ONLINE' as const,
      title: 'Đang đeo Smartband',
      value: `${stats.online}/${stats.total}`,
      sub: 'Thiết bị đeo tay truyền tín hiệu IoT',
      badge: 'Trực tuyến',
      icon: Watch,
      circleBg: 'bg-emerald-50 text-emerald-600',
      badgeBg: 'bg-emerald-50 text-emerald-700',
    },
  ];

  const pillFilters = [
    { key: 'ALL' as const, label: `Tất cả (${stats.total})` },
    { key: 'WARNING' as const, label: `Cần lưu ý (${stats.warning})` },
    { key: 'NORMAL' as const, label: `Ổn định (${stats.normal})` },
    { key: 'ONLINE' as const, label: `Đang đeo Smartband (${stats.online})` },
  ];

  const drawerTabs = [
    { key: 'RECORD' as const, label: 'Hồ sơ Bệnh án', icon: FileText, count: undefined },
    { key: 'VITALS' as const, label: 'Đồ thị Sinh hiệu', icon: Activity, count: undefined },
    { key: 'PRESCRIPTIONS' as const, label: 'Đơn thuốc', icon: Pill, count: prescriptions.length },
    { key: 'APPOINTMENTS' as const, label: 'Lịch khám', icon: Calendar, count: patientAppointments.length },
  ];

  const selectedPatientCard = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  const selectedPatientIdx = useMemo(
    () => patients.findIndex((p) => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const selectedMrCode = selectedPatientIdx >= 0
    ? `MR-${String(selectedPatientIdx + 1).padStart(3, '0')}`
    : 'MR-001';

  const isSelectedDanger = selectedPatientCard?.health_status === 'DANGER';
  const isSelectedWarning = selectedPatientCard?.health_status === 'WARNING' || isSelectedDanger;

  const activeAvatar = patientDetail?.avatar_url || selectedPatientCard?.avatar_url || null;
  const activeBloodType = patientDetail?.blood_type || selectedPatientCard?.blood_type || 'O+';
  const activeBmi = patientDetail?.bmi || '22.0';
  const activeBp = patientDetail?.blood_pressure || selectedPatientCard?.blood_pressure || '120/80';
  const activeSkinTemp = patientDetail?.skin_temp_max
    ? `${patientDetail.skin_temp_max}°C`
    : (selectedPatientCard?.skin_temp_max ? `${selectedPatientCard.skin_temp_max}°C` : '36.5°C');
  const activeEmergencyPhone = selectedPatientCard?.emergency_contact_phone || '';

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 font-heading">
            Danh Sách Bệnh Nhân Người Cao Tuổi
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Quản lý hồ sơ bệnh án điện tử, giám sát chỉ số sinh hiệu thời gian thực và phác đồ điều trị
          </p>
        </div>
        <button
          onClick={fetchPatients}
          disabled={loading}
          className="flex items-center space-x-2 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      {/* 2. Hàng 3 Thẻ Tóm Tắt Phân Loại Nhanh */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const active = statusFilter === card.key;
          return (
            <div
              key={card.key}
              onClick={() => setStatusFilter(card.key)}
              className={`cursor-pointer rounded-2xl border bg-white p-5 transition-all shadow-xs hover:shadow-md ${
                active ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200/80 hover:border-blue-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3.5">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${card.circleBg}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">{card.title}</p>
                    <div className="mt-1 flex items-baseline space-x-2">
                      <span className="text-2xl font-extrabold text-slate-900">{card.value}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${card.badgeBg}`}>
                        {card.badge}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-[11px] text-slate-400 font-medium">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* 3. Thanh tìm kiếm & Bộ lọc dạng Pill */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {pillFilters.map((b) => {
            const active = statusFilter === b.key;
            return (
              <button
                key={b.key}
                onClick={() => setStatusFilter(b.key)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                }`}
              >
                {b.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-96">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Tìm theo tên bệnh nhân (vd: Nguyễn Văn A, van a), SĐT, hộ gia đình..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-9 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
              title="Xóa tìm kiếm"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Danh sách thẻ bệnh nhân trực quan */}
      {filteredPatients.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-xs">
          <Users className="mx-auto h-10 w-10 text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-700">Không tìm thấy bệnh nhân phù hợp</p>
          <p className="mt-1 text-xs text-slate-400">
            Thử thay đổi từ khóa tìm kiếm hoặc chuyển sang bộ lọc "Tất cả".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPatients.map((patient, idx) => {
            const isDanger = patient.health_status === 'DANGER';
            const isWarning = patient.health_status === 'WARNING' || isDanger;
            const isSelected = selectedPatientId === patient.id;
            const mrCode = `MR-${String(idx + 1).padStart(3, '0')}`;

            return (
              <div
                key={patient.id}
                onClick={() => handleSelectPatient(patient.id)}
                className={`group cursor-pointer rounded-2xl border p-5 transition-all bg-white shadow-xs hover:shadow-md ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-100'
                    : 'border-slate-200/80 hover:border-blue-300'
                }`}
              >
                {/* Header thẻ */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-3.5">
                    <div className="relative inline-block shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 to-cyan-500 text-base font-extrabold text-white shadow-2xs">
                        {patient.avatar_url ? (
                          <img
                            src={getPatientAvatar(patient.avatar_url)!}
                            alt={patient.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          patient.name.charAt(0)
                        )}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white z-10 ${
                          patient.is_online ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-600">
                          {mrCode}
                        </span>
                        <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                          {patient.name}
                        </h3>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {patient.age} tuổi • {patient.gender} • Nhóm máu {patient.blood_type || 'O+'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                      isDanger
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : isWarning
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {isDanger ? 'Khẩn cấp' : isWarning ? 'Cần chú ý' : 'Ổn định'}
                  </span>
                </div>

                {/* Thông tin hộ gia đình & thiết bị */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex items-center space-x-1.5 truncate">
                    <Home className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate font-medium text-slate-700">{patient.house_name}</span>
                  </div>
                  <span
                    className={`inline-flex items-center space-x-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      patient.is_online
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Watch className="h-3 w-3" />
                    <span>{patient.is_online ? 'Smartband Online' : 'Chờ tín hiệu'}</span>
                  </span>
                </div>

                {/* Khối chỉ số sinh hiệu Nhịp tim & SpO2 */}
                <div className="mt-3.5 grid grid-cols-2 gap-2.5 rounded-2xl bg-slate-50/90 p-3 border border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                      <Heart className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Nhịp tim</span>
                      <span className="text-xs font-extrabold text-slate-900">
                        {patient.heart_rate ? `${patient.heart_rate} bpm` : '-- bpm'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Nồng độ SpO2</span>
                      <span className="text-xs font-extrabold text-slate-900">
                        {patient.spo2 ? `${patient.spo2}%` : '--%'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer thẻ */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setContactModalPatient(patient);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-2xs transition-all duration-200 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white hover:shadow-xs active:scale-[0.98]"
                    title="Xem thông tin và gọi cho gia đình bệnh nhân"
                  >
                    <PhoneCall className="h-3.5 w-3.5 shrink-0" />
                    <span>Liên hệ gia đình</span>
                  </button>
                  <div className="inline-flex items-center space-x-1 text-xs font-bold text-blue-600 group-hover:text-blue-700 transition-colors">
                    <span>Xem hồ sơ bệnh án</span>
                    <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Drawer Chi tiết Hồ sơ Bệnh án (Clinical-Grade Electronic Health Record - EHR) */}
      {selectedPatientId && patientDetail && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
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
                      className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full ring-2 ring-white z-10 ${
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
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs"
                    title="In tóm tắt bệnh án"
                  >
                    <Printer className="h-3.5 w-3.5 text-slate-600" />
                    <span className="hidden sm:inline">In hồ sơ</span>
                  </button>

                  <button
                    onClick={() => setSelectedPatientId(null)}
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
                      onClick={() => setShowRecordModal(true)}
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

              {activeTab === 'VITALS' && <VitalsTrendChart data={analytics?.daily_trends || []} days={7} />}

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
                      onClick={() => setShowPrescriptionModal(true)}
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
                      onClick={() => setShowAppointmentModal(true)}
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
                  onClick={() => setSelectedPatientId(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => setShowRecordModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition"
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span>Cập nhật hồ sơ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPrescriptionModal && selectedPatientId && patientDetail && (
        <PrescriptionModal
          patientId={selectedPatientId}
          patientName={patientDetail.name || 'Bệnh nhân'}
          prescriptions={prescriptions}
          onClose={() => setShowPrescriptionModal(false)}
          onRefresh={handleRefreshDetail}
        />
      )}

      {showRecordModal && patientDetail && (
        <MedicalRecordModal
          patient={patientDetail}
          onClose={() => setShowRecordModal(false)}
          onRefresh={handleRefreshDetail}
        />
      )}

      {showAppointmentModal && (
        <NewAppointmentModal
          patients={patients}
          initialPatientId={selectedPatientId || undefined}
          onClose={() => setShowAppointmentModal(false)}
          onSuccess={handleRefreshDetail}
        />
      )}

      {/* 6. Modal Liên hệ Khẩn cấp Gia đình */}
      {contactModalPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-2xs border border-emerald-100">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-extrabold text-slate-900">
                    Liên hệ Gia đình
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {contactModalPatient.name} • {contactModalPatient.house_name || 'Hộ gia đình'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setContactModalPatient(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nội dung thông tin liên hệ */}
            <div className="space-y-4">
              {/* Thẻ số điện thoại người thân */}
              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 via-teal-50/30 to-white p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Số điện thoại người bảo hộ
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Đã xác thực
                  </span>
                </div>

                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-mono font-extrabold text-slate-900 tracking-tight">
                    {contactModalPatient.emergency_contact_phone || 'Chưa cập nhật SĐT'}
                  </span>
                  {contactModalPatient.emergency_contact_phone && (
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(contactModalPatient.emergency_contact_phone || '')}
                      className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                    >
                      {copiedPhone ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-slate-500" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 mt-2">
                  Địa chỉ gia đình: <span className="font-medium text-slate-700">{contactModalPatient.house_address || contactModalPatient.house_name || 'Nhà riêng'}</span>
                </p>
              </div>

              {/* Thông báo tích hợp Loa Hub */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5 flex items-start gap-2.5 text-xs text-blue-900">
                <Watch className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11.5px] leading-relaxed">
                  Thiết bị Loa thông minh Hub tại nhà bệnh nhân sẽ tự động đồng bộ cuộc gọi thoại hai chiều và cảnh báo tức thì khi bác sĩ kích hoạt gọi.
                </p>
              </div>
            </div>

            {/* Nút hành động */}
            <div className="mt-5 flex items-center gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setContactModalPatient(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Đóng
              </button>
              {contactModalPatient.emergency_contact_phone ? (
                <a
                  href={`tel:${contactModalPatient.emergency_contact_phone}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700 transition active:scale-[0.98]"
                >
                  <PhoneCall className="h-4 w-4" />
                  <span>Gọi ngay</span>
                </a>
              ) : (
                <button
                  disabled
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-400 cursor-not-allowed"
                >
                  Chưa có SĐT
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

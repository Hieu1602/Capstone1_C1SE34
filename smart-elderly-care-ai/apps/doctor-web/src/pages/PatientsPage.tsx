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
    { key: 'RECORD' as const, label: 'Hồ sơ Bệnh án', icon: FileText },
    { key: 'VITALS' as const, label: 'Đồ thị Sinh hiệu', icon: Activity },
    { key: 'PRESCRIPTIONS' as const, label: `Đơn thuốc (${prescriptions.length})`, icon: Pill },
    { key: 'APPOINTMENTS' as const, label: 'Lịch khám', icon: Calendar },
  ];

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
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 to-cyan-500 text-base font-extrabold text-white shadow-sm">
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
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white ${
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
                  <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                    <Phone className="h-3 w-3" />
                    <span>{patient.emergency_contact_phone || 'Liên hệ gia đình'}</span>
                  </div>
                  <span className="inline-flex items-center space-x-1 text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                    <span>Xem hồ sơ bệnh án</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Drawer Chi tiết Hồ sơ Bệnh án */}
      {selectedPatientId && patientDetail && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold text-base shadow-xs">
                  {patientDetail.name?.charAt(0) || 'P'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{patientDetail.name}</h3>
                  <p className="text-xs text-slate-500">
                    {patientDetail.age} tuổi • {patientDetail.gender} • {patientDetail.house_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPatientId(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex border-b border-slate-100 px-6 bg-white space-x-6 text-xs font-bold">
              {drawerTabs.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`py-3 border-b-2 transition-colors flex items-center space-x-1.5 ${
                      activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeTab === 'RECORD' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Chỉ số Thể trạng & Y khoa</h4>
                    <button
                      onClick={() => setShowRecordModal(true)}
                      className="flex items-center space-x-1 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      <span>Cập nhật hồ sơ</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Nhóm máu', val: patientDetail.blood_type || 'O+' },
                      { label: 'Chỉ số BMI', val: patientDetail.bmi || '22.0' },
                      { label: 'Huyết áp chuẩn', val: patientDetail.blood_pressure || '120/80' },
                      { label: 'Nhiệt độ da', val: patientDetail.skin_temp_max ? `${patientDetail.skin_temp_max}°C` : '36.5°C' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center">
                        <span className="text-[10px] text-slate-400 block font-medium">{s.label}</span>
                        <span className="text-sm font-bold text-slate-800">{s.val}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: 'Dị ứng thuốc', val: patientDetail.drug_allergies || 'Không ghi nhận dị ứng thuốc' },
                      { label: 'Dị ứng thực phẩm', val: patientDetail.food_allergies || 'Không' },
                      {
                        label: 'Chế độ dinh dưỡng khuyến nghị',
                        val: patientDetail.dietary_notes || 'Ăn giảm muối, hạn chế đường tinh luyện, bổ sung chất xơ',
                      },
                    ].map((row) => (
                      <div key={row.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                        <span className="text-xs font-bold text-slate-700 block mb-1">{row.label}</span>
                        <p className="text-xs text-slate-600">{row.val}</p>
                      </div>
                    ))}

                    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                      <span className="text-xs font-bold text-blue-900 block mb-1">Dặn dò của Bác sĩ gia đình</span>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {patientDetail.doctor_notes || 'Bệnh nhân tuân thủ phác đồ điều trị tốt. Tái khám định kỳ theo lịch.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'VITALS' && <VitalsTrendChart data={analytics?.daily_trends || []} days={7} />}

              {activeTab === 'PRESCRIPTIONS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Thuốc đang sử dụng ({prescriptions.length})
                    </h4>
                    <button
                      onClick={() => setShowPrescriptionModal(true)}
                      className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Kê đơn thuốc mới</span>
                    </button>
                  </div>

                  {prescriptions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                      Chưa có đơn thuốc nào. Bấm nút Kê đơn thuốc mới ở trên để thêm.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {prescriptions.map((rx) => (
                        <div key={rx.id} className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-xs">{rx.medication_name}</span>
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              {rx.dosage}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {rx.frequency} • {rx.instructions}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Giờ uống: {rx.schedule_times?.join(', ')}</span>
                            {rx.enable_speaker_reminder && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-medium">
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
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Lịch khám của bệnh nhân</h4>
                    <button
                      onClick={() => setShowAppointmentModal(true)}
                      className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Hẹn lịch khám mới</span>
                    </button>
                  </div>

                  {patientAppointments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                      Chưa có lịch khám nào với bệnh nhân này.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {patientAppointments.map((apt) => (
                        <div key={apt.id} className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-xs">{apt.clinical_notes || 'Khám sức khỏe'}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                apt.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : apt.status === 'CANCELLED'
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-blue-50 text-blue-700'
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
    </div>
  );
};

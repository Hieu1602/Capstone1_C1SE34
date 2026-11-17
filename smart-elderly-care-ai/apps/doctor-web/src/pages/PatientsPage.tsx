// src/pages/PatientsPage.tsx
// Quản lý Danh bạ Bệnh nhân Người cao tuổi & Hồ sơ Bệnh án chi tiết cho Bác sĩ

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doctorApi } from '../services/api';
import { useDoctorDataStore } from '../store/useDoctorDataStore';
import { removeVietnameseTones } from '../utils/text';
import {
  DoctorPatientCard,
  DoctorPatientDetail,
  PrescriptionItem,
  AppointmentItem,
  AnalyticsData,
} from '../types';
import { PrescriptionModal } from '../components/clinical/PrescriptionModal';
import { MedicalRecordModal } from '../components/clinical/MedicalRecordModal';
import { NewAppointmentModal } from '../components/clinical/NewAppointmentModal';
import { PatientCard, PatientDetailDrawer, FamilyContactModal } from '../components/clinical';
import { Search, RefreshCw, X, Users, AlertTriangle, Watch, ArrowUpRight } from 'lucide-react';

export const PatientsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    patients,
    isLoadingPatients,
    isRevalidating,
    fetchPatients: loadPatients,
  } = useDoctorDataStore();

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

  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [contactModalPatient, setContactModalPatient] = useState<DoctorPatientCard | null>(null);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

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
      await loadPatients(true);
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

  const selectedPatientCard = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || undefined,
    [patients, selectedPatientId]
  );

  const selectedPatientIdx = useMemo(
    () => patients.findIndex((p) => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const selectedMrCode = selectedPatientIdx >= 0
    ? `MR-${String(selectedPatientIdx + 1).padStart(3, '0')}`
    : 'MR-001';

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
          onClick={() => loadPatients(true)}
          disabled={isRevalidating}
          className="flex items-center space-x-2 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-all cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRevalidating ? 'animate-spin text-blue-600' : ''}`} />
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
                      {isLoadingPatients && patients.length === 0 ? (
                        <div className="h-7 w-12 rounded-lg bg-slate-200 animate-pulse my-0.5" />
                      ) : (
                        <span className="text-2xl font-extrabold text-slate-900">{card.value}</span>
                      )}
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
      {isLoadingPatients && patients.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs animate-pulse space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-slate-200 shrink-0" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-slate-200" />
                    <div className="h-3 w-20 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="h-6 w-16 rounded-full bg-slate-100" />
              </div>
              <div className="space-y-2 pt-2">
                <div className="h-3 w-full rounded bg-slate-100" />
                <div className="h-3 w-4/5 rounded bg-slate-100" />
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="h-4 w-24 rounded bg-slate-200" />
                <div className="h-4 w-16 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredPatients.length === 0 ? (
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
            const mrCode = `MR-${String(idx + 1).padStart(3, '0')}`;

            return (
              <PatientCard
                key={patient.id}
                patient={patient}
                mrCode={mrCode}
                isDanger={isDanger}
                isWarning={isWarning}
                onSelect={handleSelectPatient}
                onContactFamily={(p) => setContactModalPatient(p)}
              />
            );
          })}
        </div>
      )}

      {/* 5. Drawer Chi tiết Hồ sơ Bệnh án (Clinical-Grade Electronic Health Record - EHR) */}
      {selectedPatientId && patientDetail && (
        <PatientDetailDrawer
          patientDetail={patientDetail}
          selectedPatientCard={selectedPatientCard}
          selectedMrCode={selectedMrCode}
          prescriptions={prescriptions}
          patientAppointments={patientAppointments}
          analytics={analytics}
          onClose={() => setSelectedPatientId(null)}
          onOpenRecordModal={() => setShowRecordModal(true)}
          onOpenPrescriptionModal={() => setShowPrescriptionModal(true)}
          onOpenAppointmentModal={() => setShowAppointmentModal(true)}
        />
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
        <FamilyContactModal
          patient={contactModalPatient}
          onClose={() => setContactModalPatient(null)}
        />
      )}
    </div>
  );
};
export default PatientsPage;

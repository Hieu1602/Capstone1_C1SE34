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
import { PatientCard, PatientDetailDrawer, FamilyContactModal, DrawerTabKey } from '../components/clinical';
import {
  VitalFilterState,
  computeVitalFilter,
  getTodayYMD,
} from '../utils/dateFilter';
import { Search, RefreshCw, X, Users, AlertTriangle, Watch } from 'lucide-react';

interface PatientDrawerCacheEntry {
  detail: DoctorPatientDetail;
  analytics: AnalyticsData | null;
  prescriptions: PrescriptionItem[];
  appointments: AppointmentItem[];
  updatedAt: number;
}

const patientDrawerCache = new Map<string, PatientDrawerCacheEntry>();

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
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [isLoadingPrescriptions, setIsLoadingPrescriptions] = useState(false);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [vitalFilter, setVitalFilter] = useState<VitalFilterState>(() =>
    computeVitalFilter('WEEK', getTodayYMD())
  );

  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [contactModalPatient, setContactModalPatient] = useState<DoctorPatientCard | null>(null);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const handleSelectPatient = async (patientId: string, forceRefresh = false) => {
    // 1. Mở Drawer tức thì (0ms) với dữ liệu có sẵn hoặc từ Cache
    setSelectedPatientId(patientId);
    const cached = patientDrawerCache.get(patientId);
    const cardData = patients.find((p) => p.id === patientId);

    if (cached && !forceRefresh) {
      setPatientDetail(cached.detail);
      setAnalytics(cached.analytics);
      setPrescriptions(cached.prescriptions);
      setPatientAppointments(cached.appointments);
      setIsLoadingDetail(false);
      setIsLoadingPrescriptions(false);
      setIsLoadingAppointments(false);
      return;
    }

    // Dựng ngay dữ liệu Optimistic từ thẻ bệnh nhân đang có trên danh sách
    if (cardData && !forceRefresh) {
      setPatientDetail({
        id: cardData.id,
        name: cardData.name,
        age: cardData.age,
        gender: cardData.gender,
        blood_type: cardData.blood_type || 'O+',
        avatar_url: cardData.avatar_url || undefined,
        house_name: cardData.house_name,
        house_address: cardData.house_address,
        heart_rate: cardData.heart_rate,
        spo2: cardData.spo2,
        blood_pressure: cardData.blood_pressure,
        skin_temp_max: cardData.skin_temp_max,
        conditions: [],
      });
      setAnalytics(null);
      setPrescriptions([]);
      setPatientAppointments([]);
    }

    // 2. Tải song song dữ liệu chi tiết ở chế độ nền (không chặn mở Drawer)
    setIsLoadingDetail(true);
    setIsLoadingPrescriptions(true);
    setIsLoadingAppointments(true);

    const [detailRes, rxRes, aptRes] = await Promise.allSettled([
      doctorApi.getPatientDetail(patientId),
      doctorApi.getPrescriptions(patientId),
      doctorApi.getAppointments(undefined, patientId),
    ]);

    const nextDetail =
      detailRes.status === 'fulfilled'
        ? detailRes.value
        : cached?.detail || (cardData ? { id: cardData.id, name: cardData.name, conditions: [] } : null);
    const nextRx = rxRes.status === 'fulfilled' ? rxRes.value : (cached?.prescriptions || []);
    const nextApt = aptRes.status === 'fulfilled' ? aptRes.value : (cached?.appointments || []);

    if (nextDetail) setPatientDetail(nextDetail);
    setPrescriptions(nextRx);
    setPatientAppointments(nextApt);
    setIsLoadingDetail(false);
    setIsLoadingPrescriptions(false);
    setIsLoadingAppointments(false);

    if (nextDetail) {
      patientDrawerCache.set(patientId, {
        detail: nextDetail,
        analytics: cached?.analytics || null,
        prescriptions: nextRx,
        appointments: nextApt,
        updatedAt: Date.now(),
      });
    }
  };

  // Lazy-load dữ liệu Đồ thị Sinh hiệu khi người dùng thực sự mở Tab 'VITALS'
  const handleDrawerTabChange = async (tab: DrawerTabKey) => {
    if (tab !== 'VITALS' || !selectedPatientId) return;
    setIsLoadingAnalytics(true);
    try {
      const data = await doctorApi.getAnalytics(
        selectedPatientId,
        vitalFilter.days,
        vitalFilter.startDate,
        vitalFilter.endDate
      );
      setAnalytics(data);
    } catch {
      // ignore
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const handleVitalFilterChange = async (newFilter: VitalFilterState) => {
    setVitalFilter(newFilter);
    if (!selectedPatientId) return;
    setIsLoadingAnalytics(true);
    try {
      const data = await doctorApi.getAnalytics(
        selectedPatientId,
        newFilter.days,
        newFilter.startDate,
        newFilter.endDate
      );
      setAnalytics(data);
    } catch {
      // ignore
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const handleRefreshDetail = async () => {
    if (selectedPatientId) {
      await handleSelectPatient(selectedPatientId, true);
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
      circleBg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
      badgeBg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    },
    {
      key: 'WARNING' as const,
      title: 'Đang cảnh báo sinh hiệu',
      value: stats.warning,
      sub: 'Nhịp tim hoặc SpO2 cần theo dõi sát',
      badge: stats.warning > 0 ? 'Cần chú ý' : 'An toàn',
      icon: AlertTriangle,
      circleBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
      badgeBg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    },
    {
      key: 'ONLINE' as const,
      title: 'Đang đeo Smartband',
      value: `${stats.online}/${stats.total}`,
      sub: 'Thiết bị đeo tay truyền tín hiệu IoT',
      badge: 'Trực tuyến',
      icon: Watch,
      circleBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
      badgeBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
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
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 dark:text-white font-heading">
            Danh Sách Bệnh Nhân Người Cao Tuổi
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Quản lý hồ sơ bệnh án điện tử, giám sát chỉ số sinh hiệu thời gian thực và phác đồ điều trị
          </p>
        </div>
        <button
          onClick={() => loadPatients(true)}
          disabled={isRevalidating}
          className="flex items-center space-x-2 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-all cursor-pointer dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
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
              className={`cursor-pointer rounded-2xl border bg-white dark:bg-[#131C31] p-5 transition-all shadow-xs hover:shadow-md ${
                active ? 'border-blue-500 ring-2 ring-blue-500/10 dark:border-blue-500 dark:ring-blue-500/20' : 'border-slate-200/80 dark:border-slate-800/80 hover:border-blue-200 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3.5">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${card.circleBg}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{card.title}</p>
                    <div className="mt-1 flex items-baseline space-x-2">
                      {isLoadingPatients && patients.length === 0 ? (
                        <div className="h-7 w-12 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse my-0.5" />
                      ) : (
                        <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{card.value}</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${card.badgeBg}`}>
                        {card.badge}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-slate-400 font-medium">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* 3. Thanh tìm kiếm & Bộ lọc dạng Pill */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white dark:bg-[#131C31] dark:border-slate-800/80 p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {pillFilters.map((b) => {
            const active = statusFilter === b.key;
            return (
              <button
                key={b.key}
                onClick={() => setStatusFilter(b.key)}
                className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
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
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-9 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-700/60 dark:bg-[#0F172A] dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-500 dark:focus:bg-[#0F172A]"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
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
              className="rounded-2xl border border-slate-200/80 bg-white dark:bg-[#131C31] dark:border-slate-800/80 p-5 shadow-xs animate-pulse space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-3 w-20 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                </div>
                <div className="h-6 w-16 rounded-full bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="space-y-2 pt-2">
                <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-3 w-4/5 rounded bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-[#131C31] dark:border-slate-800/80 p-12 text-center shadow-xs">
          <Users className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Không tìm thấy bệnh nhân phù hợp</p>
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
          isLoadingDetail={isLoadingDetail}
          isLoadingAnalytics={isLoadingAnalytics}
          isLoadingPrescriptions={isLoadingPrescriptions}
          isLoadingAppointments={isLoadingAppointments}
          vitalFilter={vitalFilter}
          onVitalFilterChange={handleVitalFilterChange}
          onTabChange={handleDrawerTabChange}
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

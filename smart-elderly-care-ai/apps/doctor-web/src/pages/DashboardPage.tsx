// src/pages/DashboardPage.tsx
// Trang chủ Bác sĩ gia đình: 4 tầng trực quan (Hero Banner, 4 KPI Cards, Biểu đồ Cảnh báo Y tế Cột chồng + Lịch tháng thu nhỏ, Bảng Theo dõi Bệnh nhân & Cảnh báo Lâm sàng)

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDoctorAuthStore, getDoctorAvatarUri } from '../store/useDoctorAuthStore';
import { useDoctorDataStore } from '../store/useDoctorDataStore';
import { householdApi, authApi } from '../services/api';
import { doctorWebSocket } from '../services/websocket';
import { removeVietnameseTones } from '../utils/text';
import { filterIncidentsByPatient } from '../utils/incidentFilter';
import { computeAlertStats, useAlertChartPeriod } from '../utils/alertStats';
import { isAppointmentOverdue, isUpcomingAppointmentStatus } from '../utils/appointmentHelpers';
import { DoctorPatientCard, AppointmentItem, HouseInvite } from '../types';
import { HouseInviteCard } from '../components/dashboard/HouseInviteCard';
import { NewAppointmentModal } from '../components/clinical/NewAppointmentModal';
import { DoctorHeroBanner } from '../components/dashboard/DoctorHeroBanner';
import { DoctorKpiCards } from '../components/dashboard/DoctorKpiCards';
import { DoctorMiniCalendar, MiniCalendarCell } from '../components/dashboard/DoctorMiniCalendar';
import { DayAppointmentsModal } from '../components/dashboard/DayAppointmentsModal';
import { DoctorAlertsAreaChart } from '../components/dashboard/DoctorAlertsAreaChart';
import { DoctorPatientTable } from '../components/dashboard/DoctorPatientTable';
import { EscalationStatusBanner } from '../components/dashboard/EscalationStatusBanner';
import { Sparkles } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useDoctorAuthStore();
  const doctorName = user?.full_name || 'BS. Trần Văn Minh';

  const {
    patients,
    appointments,
    invites,
    incidents,
    clinicalIncidents,
    isLoading,
    fetchAllData,
    setPatients,
    setInvites,
  } = useDoctorDataStore();

  const {
    chartRange,
    setChartRange,
    chartAnchorDate,
    periodLabel,
    handlePrevChart,
    handleNextChart,
    isNextDisabled,
    handleResetCurrentChart,
    isCurrentPeriod,
    selectedMonthStr,
    handleMonthSelect,
  } = useAlertChartPeriod();

  const nextAppointment = useMemo(() => {
    const nowMs = Date.now() - 15 * 60_000;
    const upcomingList = appointments
      .filter((a) => (a.status === 'UPCOMING' || a.status === 'CONFIRMED') && new Date(a.scheduled_at).getTime() >= nowMs)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    return upcomingList[0] || null;
  }, [appointments]);

  // Lọc biểu đồ cảnh báo theo bệnh nhân ('' = tất cả)
  const [chartPatientId, setChartPatientId] = useState('');
  const chartPatientOptions = useMemo(
    () => patients.map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [patients],
  );
  const alertStats = useMemo(() => {
    const patient = chartPatientId ? patients.find((p) => p.id === chartPatientId) : null;
    return computeAlertStats(filterIncidentsByPatient(clinicalIncidents, patient), chartRange, chartAnchorDate);
  }, [clinicalIncidents, chartRange, chartAnchorDate, chartPatientId, patients]);

  // Table search & filter
  const [tableSearch, setTableSearch] = useState('');
  const [tableFilter, setTableFilter] = useState<'ALL' | 'ALERT' | 'STABLE' | 'OFFLINE'>('ALL');

  // Mini Calendar month state & selected date (Local YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Create Appointment Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalAppointment, setCreateModalAppointment] = useState<AppointmentItem | null>(null);

  // Pop-up Modal chi tiết lịch khám theo ngày đã chọn
  const [showDayScheduleModal, setShowDayScheduleModal] = useState(false);

  // Handler khi click chọn bất kỳ ngày nào trên Mini Calendar
  const handleSelectCalendarDate = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
  }, []);

  // Handler mở tạo lịch khám mới gắn với ngày đang chọn
  const handleOpenCreateForDate = useCallback((dateStr: string) => {
    setCreateModalAppointment({
      id: '',
      patient_id: '',
      patient_name: '',
      scheduled_at: `${dateStr}T09:00:00`,
      status: 'UPCOMING',
    });
    setShowCreateModal(true);
  }, []);

  // Chữ cái viết tắt chuẩn xác: "M" (trong "Minh") thay vì "B" (trong "BS.")
  const doctorInitial = useMemo(() => {
    if (!doctorName) return 'M';
    const clean = doctorName.replace(/^(bs\.|bác sĩ|dr\.)\s+/i, '').trim();
    const parts = clean.split(/\s+/);
    return parts[parts.length - 1]?.[0]?.toUpperCase() || 'M';
  }, [doctorName]);

  const [doctorAvatar, setDoctorAvatar] = useState<string | null>(() => {
    return getDoctorAvatarUri(user?.avatar_url);
  });

  useEffect(() => {
    authApi.getMe().then((me) => {
      if (me) {
        useDoctorAuthStore.getState().updateUser(me);
        setDoctorAvatar(getDoctorAvatarUri(me.avatar_url));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setDoctorAvatar(getDoctorAvatarUri(user?.avatar_url));
  }, [user?.avatar_url]);

  useEffect(() => {
    const handleProfileUpdate = () => {
      const latestUser = useDoctorAuthStore.getState().user;
      setDoctorAvatar(getDoctorAvatarUri(latestUser?.avatar_url));
    };
    window.addEventListener('doctor-profile-updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);
    return () => {
      window.removeEventListener('doctor-profile-updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, []);

  useEffect(() => {
    // Tải trước / revalidate dữ liệu trong nền không chặn UI
    fetchAllData();

    // Lắng nghe WebSocket thông qua kết nối toàn cục sẵn có từ Root Layout
    const unsub = doctorWebSocket.subscribe((data) => {
      const evtType = String(data?.type || '').toLowerCase();
      if (
        data?.type === 'ALERT_NEW' ||
        data?.type === 'INITIAL_ALERTS' ||
        data?.type === 'DEVICE_STATUS' ||
        data?.type === 'INCIDENT_RESOLVED' ||
        data?.type === 'INCIDENT_ESCALATED' ||
        data?.alert_type
      ) {
        fetchAllData(true);
      }

      // Cập nhật sinh hiệu bệnh nhân thay đổi thời gian thực tức thì khi có bản tin
      if (evtType === 'vital_update' || evtType === 'vitals_update' || data?.heart_rate || data?.spo2) {
        const liveHr = data.heart_rate ? Number(data.heart_rate) : undefined;
        const liveSpo2 = data.spo2 ? Number(data.spo2) : undefined;
        const liveTemp = data.skin_temp_max ? Number(data.skin_temp_max) : undefined;
        const pid = data?.patient_id || data?.elderly_id;
        const hasTarget = Boolean(pid || data?.device_id || data?.device_uuid);
        if ((liveHr || liveSpo2 || liveTemp) && hasTarget) {
          const curPatients = useDoctorDataStore.getState().patients;
          setPatients(
            curPatients.map((p) => {
              const matched =
                (pid && String(p.id) === String(pid)) ||
                (data?.device_id && p.device_id === data.device_id) ||
                (data?.device_uuid && p.device_id === data.device_uuid);
              return matched
                ? {
                    ...p,
                    is_online: true,
                    heart_rate: liveHr ?? p.heart_rate,
                    spo2: liveSpo2 ?? p.spo2,
                    skin_temp_max: liveTemp ?? p.skin_temp_max,
                    last_updated: 'Vừa xong (Trực tuyến)',
                  }
                : p;
            })
          );
        }
      }
    });

    // Đồng bộ trạng thái Smartband mỗi 15s (phát hiện offline sau 45s không cần reload)
    const statusTicker = setInterval(() => {
      fetchAllData(true);
    }, 15000);

    return () => {
      unsub();
      clearInterval(statusTicker);
    };
  }, [fetchAllData, setPatients]);

  const handleRespondInvite = async (inviteId: string, action: 'accept' | 'reject') => {
    try {
      await householdApi.respondInvite(inviteId, action);
      setInvites(invites.filter((i) => i.id !== inviteId));
      fetchAllData(true);
    } catch {
      alert('Không thể thực hiện thao tác phản hồi.');
    }
  };

  const warningPatients = patients.filter(
    (p) => Boolean(p.is_online) && (p.health_status === 'WARNING' || p.health_status === 'DANGER')
  );
  const toLocalYMD = (iso?: string): string => {
    if (!iso) return '';
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return '';
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  const todayStr = toLocalYMD(new Date().toISOString());
  const todayAppointments = appointments.filter(
    (a) => toLocalYMD(a.scheduled_at) === todayStr && a.status !== 'CANCELLED'
  );
  const upcomingAppointments = appointments.filter((a) => a.status === 'UPCOMING' || a.status === 'CONFIRMED');
  const onlineCount = patients.filter((p) => p.is_online).length;

  // Mini Calendar grid calculation chuẩn tuần Việt Nam (T2 -> CN)
  const miniCalendarCells = useMemo<MiniCalendarCell[]>(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const rawFirstDay = new Date(year, month, 1).getDay(); // 0 is CN
    const firstDayIdx = rawFirstDay === 0 ? 6 : rawFirstDay - 1; // 0 is T2, 6 is CN
    const totalDays = new Date(year, month + 1, 0).getDate();
    const todayDateStr = todayStr;

    const cells: MiniCalendarCell[] = [];
    for (let i = 0; i < firstDayIdx; i++) {
      cells.push({ day: null });
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayApts = appointments.filter((a) => toLocalYMD(a.scheduled_at) === dateStr);
      let dotStatus: 'COMPLETED' | 'UPCOMING' | 'OVERDUE' | 'CRITICAL' | null = null;
      if (dayApts.some((a) => isAppointmentOverdue(a.scheduled_at, a.status))) {
        dotStatus = 'OVERDUE';
      } else if (dayApts.some((a) => isUpcomingAppointmentStatus(a.status))) {
        dotStatus = 'UPCOMING';
      } else if (dayApts.some((a) => a.status === 'COMPLETED')) {
        dotStatus = 'COMPLETED';
      } else if (dayApts.some((a) => a.status === 'CANCELLED')) {
        dotStatus = 'CRITICAL';
      }

      cells.push({
        day: d,
        dateStr,
        isToday: dateStr === todayDateStr,
        isSelected: dateStr === selectedDate,
        dotStatus,
      });
    }
    return cells;
  }, [calendarMonth, appointments, selectedDate, todayStr]);

  // Selected date appointments for preview (theo ngày địa phương, sắp xếp tăng dần theo giờ)
  const selectedDateApts = useMemo(() => {
    if (!selectedDate) return [];
    return appointments
      .filter((a) => toLocalYMD(a.scheduled_at) === selectedDate)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [appointments, selectedDate]);

  // Filtered patients for Tier 4 Table
  const filteredTablePatients = useMemo(() => {
    const rawQ = tableSearch.trim();
    const qNorm = removeVietnameseTones(rawQ);
    return patients.filter((p, idx) => {
      let matchSearch = true;
      if (rawQ) {
        const mrCode = `mr-${String(idx + 1).padStart(3, '0')}`;
        const nameNorm = removeVietnameseTones(p.name);
        const houseNorm = removeVietnameseTones(p.house_name || '');
        const medNorm = removeVietnameseTones(p.medical_history || '');
        matchSearch =
          nameNorm.includes(qNorm) ||
          p.name.toLowerCase().includes(rawQ.toLowerCase()) ||
          houseNorm.includes(qNorm) ||
          medNorm.includes(qNorm) ||
          mrCode.includes(qNorm);
      }
      const isAlert = Boolean(p.is_online) && (p.health_status === 'WARNING' || p.health_status === 'DANGER');
      if (tableFilter === 'ALERT') return matchSearch && isAlert;
      if (tableFilter === 'STABLE') return matchSearch && !isAlert && Boolean(p.is_online);
      if (tableFilter === 'OFFLINE') return matchSearch && !p.is_online;
      return matchSearch;
    });
  }, [patients, tableSearch, tableFilter]);

  return (
    <div className="space-y-6">
      {/* =========================================================
          TẦNG 1: HERO BANNER CHÀO MỪNG
         ========================================================= */}
      <DoctorHeroBanner
        doctorName={doctorName}
        doctorAvatar={doctorAvatar}
        doctorInitial={doctorInitial}
        nextAppointment={nextAppointment}
        patientCount={patients.length}
        warningCount={warningPatients.length}
        loading={isLoading && patients.length === 0}
        onRefresh={() => fetchAllData(true)}
        onOpenCreateAppointment={() => {
          setCreateModalAppointment(null);
          setShowCreateModal(true);
        }}
        onNavigateAppointments={() => navigate('/appointments')}
      />

      {/* Lời mời phụ trách Bác sĩ gia đình (nếu có) */}
      {invites.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Lời mời phụ trách Bác sĩ gia đình ({invites.length})
            </h3>
          </div>
          <div className="space-y-2.5">
            {invites.map((invite) => (
              <HouseInviteCard key={invite.id} invite={invite} onRespond={handleRespondInvite} />
            ))}
          </div>
        </div>
      )}

      {/* =========================================================
          TẦNG 1.5: TRẠNG THÁI LEO THANG KHẨN CẤP TỰ ĐỘNG (45s SOS)
         ========================================================= */}
      <EscalationStatusBanner
        incidents={incidents}
        onOpenNotifications={() => navigate('/notifications')}
      />

      {/* =========================================================
          TẦNG 2: HÀNG 4 THẺ CHỈ SỐ KPI
         ========================================================= */}
      <DoctorKpiCards
        patientCount={patients.length}
        warningCount={warningPatients.length}
        todayAppointmentsCount={todayAppointments.length}
        upcomingCount={upcomingAppointments.length}
        onlineCount={onlineCount}
        onNavigatePatients={() => navigate('/patients')}
        onNavigateAppointments={() => navigate(`/appointments?date=${todayStr}`)}
        loading={isLoading && patients.length === 0}
      />

      {/* =========================================================
          TẦNG 3: LƯỚI 2 CỘT (Biểu đồ Cột chồng Cảnh báo & Lịch tháng)
         ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái (8 cột): Biểu đồ Đường cong đổ bóng mượt Cảnh báo Y tế & Sự cố */}
        <div className="lg:col-span-8 flex flex-col justify-between">
          <DoctorAlertsAreaChart
            data={alertStats}
            range={chartRange}
            onRangeChange={setChartRange}
            periodLabel={periodLabel}
            onPrev={handlePrevChart}
            onNext={handleNextChart}
            isNextDisabled={isNextDisabled}
            onResetCurrent={handleResetCurrentChart}
            isCurrentPeriod={isCurrentPeriod}
            selectedMonthStr={selectedMonthStr}
            onMonthSelect={handleMonthSelect}
            patientOptions={chartPatientOptions}
            selectedPatientId={chartPatientId}
            onPatientChange={setChartPatientId}
          />
        </div>

        {/* Cột phải (4 cột): Widget Lịch tháng thu nhỏ */}
        <div className="lg:col-span-4 flex flex-col justify-between">
          <DoctorMiniCalendar
            calendarMonth={calendarMonth}
            onMonthChange={setCalendarMonth}
            miniCalendarCells={miniCalendarCells}
            selectedDate={selectedDate}
            onSelectDate={handleSelectCalendarDate}
            onNavigateAppointments={() =>
              navigate(selectedDate ? `/appointments?date=${selectedDate}` : '/appointments')
            }
          />
        </div>
      </div>

      {/* =========================================================
          TẦNG 4: BẢNG THEO DÕI BỆNH NHÂN & CẢNH BÁO LÂM SÀNG
         ========================================================= */}
      <DoctorPatientTable
        patients={filteredTablePatients}
        tableSearch={tableSearch}
        onSearchChange={setTableSearch}
        tableFilter={tableFilter}
        onFilterChange={setTableFilter}
        onSelectPatient={(patientId) => navigate(`/patients?id=${patientId}`)}
        loading={isLoading && patients.length === 0}
      />

      {/* Pop-up Modal chi tiết lịch khám theo ngày đã chọn */}
      {showDayScheduleModal && (
        <DayAppointmentsModal
          isOpen={showDayScheduleModal}
          dateStr={selectedDate}
          appointments={selectedDateApts}
          onClose={() => setShowDayScheduleModal(false)}
          onOpenCreate={handleOpenCreateForDate}
          onNavigateAppointments={(dateStr) =>
            navigate(dateStr ? `/appointments?date=${dateStr}` : '/appointments')
          }
          onSelectPatient={(patientId) => navigate(`/patients?id=${patientId}`)}
        />
      )}

      {/* Modal Tạo lịch khám mới */}
      {showCreateModal && (
        <NewAppointmentModal
          patients={patients}
          initialAppointment={createModalAppointment}
          onClose={() => {
            setShowCreateModal(false);
            setCreateModalAppointment(null);
          }}
          onSuccess={() => {
            fetchAllData(true);
            setCreateModalAppointment(null);
          }}
        />
      )}
    </div>
  );
};

export default DashboardPage;

// src/pages/DashboardPage.tsx
// Trang chủ Bác sĩ gia đình: 4 tầng trực quan (Hero Banner, 4 KPI Cards, Biểu đồ Cảnh báo Y tế Cột chồng + Lịch tháng thu nhỏ, Bảng Theo dõi Bệnh nhân & Cảnh báo Lâm sàng)

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDoctorAuthStore, getDoctorAvatarUri } from '../store/useDoctorAuthStore';
import { useDoctorDataStore } from '../store/useDoctorDataStore';
import { householdApi, authApi } from '../services/api';
import { doctorWebSocket } from '../services/websocket';
import { removeVietnameseTones } from '../utils/text';
import { isAppointmentOverdue, isUpcomingAppointmentStatus } from '../utils/appointmentHelpers';
import { DoctorPatientCard, AppointmentItem, HouseInvite } from '../types';
import { HouseInviteCard } from '../components/dashboard/HouseInviteCard';
import { NewAppointmentModal } from '../components/clinical/NewAppointmentModal';
import { DoctorHeroBanner } from '../components/dashboard/DoctorHeroBanner';
import { DoctorKpiCards } from '../components/dashboard/DoctorKpiCards';
import { DoctorMiniCalendar, MiniCalendarCell } from '../components/dashboard/DoctorMiniCalendar';
import { DayAppointmentsModal } from '../components/dashboard/DayAppointmentsModal';
import { DoctorAlertsAreaChart, AlertDayStat } from '../components/dashboard/DoctorAlertsAreaChart';
import { DoctorPatientTable } from '../components/dashboard/DoctorPatientTable';
import { EscalationStatusBanner } from '../components/dashboard/EscalationStatusBanner';
import { Sparkles } from 'lucide-react';

const DEFAULT_ALERT_STATS_7D: AlertDayStat[] = [
  { label: 'T2', fullLabel: 'Thứ Hai', fall: 1, heart_alert: 3, spo2_alert: 1, sos_alert: 0, total: 5 },
  { label: 'T3', fullLabel: 'Thứ Ba', fall: 0, heart_alert: 2, spo2_alert: 2, sos_alert: 1, total: 5 },
  { label: 'T4', fullLabel: 'Thứ Tư', fall: 2, heart_alert: 4, spo2_alert: 1, sos_alert: 0, total: 7 },
  { label: 'T5', fullLabel: 'Thứ Năm', fall: 0, heart_alert: 1, spo2_alert: 1, sos_alert: 0, total: 2 },
  { label: 'T6', fullLabel: 'Thứ Sáu', fall: 1, heart_alert: 3, spo2_alert: 2, sos_alert: 1, total: 7 },
  { label: 'T7', fullLabel: 'Thứ Bảy', fall: 0, heart_alert: 2, spo2_alert: 0, sos_alert: 0, total: 2 },
  { label: 'CN', fullLabel: 'Chủ Nhật', fall: 1, heart_alert: 2, spo2_alert: 1, sos_alert: 1, total: 5 },
];

const DEFAULT_ALERT_STATS_30D: AlertDayStat[] = [
  { label: 'Tuần 1', fullLabel: 'Tuần 1 (01 - 07)', fall: 3, heart_alert: 12, spo2_alert: 5, sos_alert: 2, total: 22 },
  { label: 'Tuần 2', fullLabel: 'Tuần 2 (08 - 14)', fall: 2, heart_alert: 15, spo2_alert: 7, sos_alert: 1, total: 25 },
  { label: 'Tuần 3', fullLabel: 'Tuần 3 (15 - 21)', fall: 4, heart_alert: 11, spo2_alert: 4, sos_alert: 3, total: 22 },
  { label: 'Tuần 4', fullLabel: 'Tuần 4 (22 - 30)', fall: 1, heart_alert: 9, spo2_alert: 3, sos_alert: 1, total: 14 },
];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function computeAlertStats(incidents: any[], range: '7D' | '30D', anchorDate: Date): AlertDayStat[] {
  if (range === '30D') {
    const y = anchorDate.getFullYear();
    const m = anchorDate.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();

    const weeks: AlertDayStat[] = [
      { label: 'Tuần 1', fullLabel: `Tuần 1 (01 - 07/${m + 1})`, fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
      { label: 'Tuần 2', fullLabel: `Tuần 2 (08 - 14/${m + 1})`, fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
      { label: 'Tuần 3', fullLabel: `Tuần 3 (15 - 21/${m + 1})`, fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
      { label: 'Tuần 4', fullLabel: `Tuần 4 (22 - ${lastDay}/${m + 1})`, fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
    ];

    if (!incidents || incidents.length === 0) {
      const now = new Date();
      return (y === now.getFullYear() && m === now.getMonth()) ? DEFAULT_ALERT_STATS_30D : weeks;
    }

    for (const inc of incidents) {
      const d = inc.created_at ? new Date(inc.created_at) : null;
      if (!d || isNaN(d.getTime())) continue;
      if (d.getFullYear() === y && d.getMonth() === m) {
        const dayNum = d.getDate();
        let targetWeek = 0;
        if (dayNum <= 7) targetWeek = 0;
        else if (dayNum <= 14) targetWeek = 1;
        else if (dayNum <= 21) targetWeek = 2;
        else targetWeek = 3;

        const type = (inc.alert_type || '').toUpperCase();
        if (type.includes('FALL')) weeks[targetWeek].fall++;
        else if (type.includes('HEART') || type.includes('NHIP_TIM')) weeks[targetWeek].heart_alert++;
        else if (type.includes('SPO2') || type.includes('OXY')) weeks[targetWeek].spo2_alert++;
        else if (type.includes('SOS')) weeks[targetWeek].sos_alert++;
        else weeks[targetWeek].heart_alert++;
        weeks[targetWeek].total++;
      }
    }

    const hasData = weeks.some((w) => w.total > 0);
    const now = new Date();
    if (!hasData && y === now.getFullYear() && m === now.getMonth()) {
      return DEFAULT_ALERT_STATS_30D;
    }
    return weeks;
  }

  // 7D: Tuần cụ thể (Thứ Hai -> Chủ Nhật)
  const monday = getMonday(anchorDate);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const fullNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
  const days: AlertDayStat[] = dayLabels.map((lbl, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const dateFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return {
      label: lbl,
      fullLabel: `${fullNames[idx]} (${dateFormatted})`,
      fall: 0,
      heart_alert: 0,
      spo2_alert: 0,
      sos_alert: 0,
      total: 0,
    };
  });

  if (!incidents || incidents.length === 0) {
    const currentMonday = getMonday(new Date());
    return monday.getTime() === currentMonday.getTime() ? DEFAULT_ALERT_STATS_7D : days;
  }

  for (const inc of incidents) {
    const d = inc.created_at ? new Date(inc.created_at) : null;
    if (!d || isNaN(d.getTime())) continue;
    if (d.getTime() >= monday.getTime() && d.getTime() <= sunday.getTime()) {
      const dayOfWeek = d.getDay(); // 0 is CN, 1 is T2
      const dayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const type = (inc.alert_type || '').toUpperCase();
      if (type.includes('FALL')) days[dayIdx].fall++;
      else if (type.includes('HEART') || type.includes('NHIP_TIM')) days[dayIdx].heart_alert++;
      else if (type.includes('SPO2') || type.includes('OXY')) days[dayIdx].spo2_alert++;
      else if (type.includes('SOS')) days[dayIdx].sos_alert++;
      else days[dayIdx].heart_alert++;
      days[dayIdx].total++;
    }
  }

  const hasData = days.some((d) => d.total > 0);
  const currentMonday = getMonday(new Date());
  if (!hasData && monday.getTime() === currentMonday.getTime()) {
    return DEFAULT_ALERT_STATS_7D;
  }
  return days;
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useDoctorAuthStore();
  const doctorName = user?.full_name || 'BS. Trần Văn Minh';

  const {
    patients,
    appointments,
    invites,
    incidents,
    isLoading,
    fetchAllData,
    setPatients,
    setInvites,
  } = useDoctorDataStore();

  const [chartRange, setChartRange] = useState<'7D' | '30D'>('7D');
  const [chartAnchorDate, setChartAnchorDate] = useState<Date>(() => new Date());

  const now = new Date();
  const currentMonday = getMonday(now);
  const selectedMonday = getMonday(chartAnchorDate);
  const selectedSunday = new Date(selectedMonday);
  selectedSunday.setDate(selectedMonday.getDate() + 6);

  const isCurrentWeek = selectedMonday.getTime() >= currentMonday.getTime();
  const isCurrentMonth =
    chartAnchorDate.getFullYear() === now.getFullYear() &&
    chartAnchorDate.getMonth() >= now.getMonth();

  const periodLabel = useMemo(() => {
    if (chartRange === '7D') {
      const startStr = `${String(selectedMonday.getDate()).padStart(2, '0')}/${String(selectedMonday.getMonth() + 1).padStart(2, '0')}`;
      const endStr = `${String(selectedSunday.getDate()).padStart(2, '0')}/${String(selectedSunday.getMonth() + 1).padStart(2, '0')}`;
      return `${startStr} - ${endStr}`;
    }
    return `Tháng ${chartAnchorDate.getMonth() + 1}/${chartAnchorDate.getFullYear()}`;
  }, [chartRange, selectedMonday, selectedSunday, chartAnchorDate]);

  const isNextDisabled = chartRange === '7D' ? isCurrentWeek : isCurrentMonth;
  const isCurrentPeriod = chartRange === '7D' ? isCurrentWeek : isCurrentMonth;

  const handlePrevChart = () => {
    setChartAnchorDate((prev) => {
      const d = new Date(prev);
      if (chartRange === '7D') {
        d.setDate(d.getDate() - 7);
      } else {
        d.setMonth(d.getMonth() - 1);
      }
      return d;
    });
  };

  const handleNextChart = () => {
    if (isNextDisabled) return;
    setChartAnchorDate((prev) => {
      const d = new Date(prev);
      if (chartRange === '7D') {
        d.setDate(d.getDate() + 7);
      } else {
        d.setMonth(d.getMonth() + 1);
      }
      return d;
    });
  };

  const handleResetCurrentChart = () => {
    setChartAnchorDate(new Date());
  };

  const handleMonthSelect = (mStr: string) => {
    const [y, m] = mStr.split('-').map(Number);
    setChartAnchorDate(new Date(y, m - 1, 1));
  };

  const selectedMonthStr = `${chartAnchorDate.getFullYear()}-${String(chartAnchorDate.getMonth() + 1).padStart(2, '0')}`;

  const nextAppointment = useMemo(() => {
    const nowMs = Date.now() - 15 * 60_000;
    const upcomingList = appointments
      .filter((a) => (a.status === 'UPCOMING' || a.status === 'CONFIRMED') && new Date(a.scheduled_at).getTime() >= nowMs)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    return upcomingList[0] || null;
  }, [appointments]);

  const alertStats = useMemo(() => {
    return computeAlertStats(incidents, chartRange, chartAnchorDate);
  }, [incidents, chartRange, chartAnchorDate]);

  // Table search & filter
  const [tableSearch, setTableSearch] = useState('');
  const [tableFilter, setTableFilter] = useState<'ALL' | 'ALERT' | 'STABLE'>('ALL');

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
    setShowDayScheduleModal(true);
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
    const handleProfileUpdate = () => {
      setDoctorAvatar(getDoctorAvatarUri(user?.avatar_url));
    };
    window.addEventListener('doctor-profile-updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);
    return () => {
      window.removeEventListener('doctor-profile-updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, [user]);

  useEffect(() => {
    // Tải trước / revalidate dữ liệu trong nền không chặn UI
    fetchAllData();

    // Lắng nghe WebSocket thông qua kết nối toàn cục sẵn có từ Root Layout
    const unsub = doctorWebSocket.subscribe((data) => {
      if (
        data?.type === 'ALERT_NEW' ||
        data?.type === 'INITIAL_ALERTS' ||
        data?.type === 'DEVICE_STATUS' ||
        data?.type === 'INCIDENT_RESOLVED' ||
        data?.type === 'INCIDENT_ESCALATED' ||
        data?.type === 'vitals_update' ||
        data?.alert_type
      ) {
        fetchAllData(true);
      }

      // Cập nhật sinh hiệu bệnh nhân thay đổi thời gian thực tức thì khi có bản tin
      if (data?.type === 'VITALS_UPDATE' || data?.heart_rate || data?.spo2) {
        const liveHr = data.heart_rate ? Number(data.heart_rate) : undefined;
        const liveSpo2 = data.spo2 ? Number(data.spo2) : undefined;
        const hasTarget = Boolean(data?.patient_id || data?.device_id);
        if ((liveHr || liveSpo2) && hasTarget) {
          const curPatients = useDoctorDataStore.getState().patients;
          setPatients(
            curPatients.map((p) => {
              const matched =
                (data?.patient_id && String(p.id) === String(data.patient_id)) ||
                (data?.device_id && p.device_id === data.device_id);
              return matched
                ? {
                    ...p,
                    is_online: true,
                    heart_rate: liveHr ?? p.heart_rate,
                    spo2: liveSpo2 ?? p.spo2,
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
    (p) => p.health_status === 'WARNING' || p.health_status === 'DANGER'
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
      const isAlert = p.health_status === 'WARNING' || p.health_status === 'DANGER';
      if (tableFilter === 'ALERT') return matchSearch && isAlert;
      if (tableFilter === 'STABLE') return matchSearch && !isAlert;
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
        onNavigateAppointments={() => navigate('/appointments')}
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
            onNavigateAppointments={() => setShowDayScheduleModal(true)}
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

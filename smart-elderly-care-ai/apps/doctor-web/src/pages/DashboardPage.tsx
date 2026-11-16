// src/pages/DashboardPage.tsx
// Trang chủ Bác sĩ gia đình: 4 tầng trực quan (Hero Banner, 4 KPI Cards, Biểu đồ Cảnh báo Y tế Cột chồng + Lịch tháng thu nhỏ, Bảng Theo dõi Bệnh nhân & Cảnh báo Lâm sàng)

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useDoctorAuthStore, getDoctorAvatarUri } from '../store/useDoctorAuthStore';
import { doctorApi, householdApi, authApi, incidentsApi } from '../services/api';
import { doctorWebSocket } from '../services/websocket';
import { removeVietnameseTones } from '../utils/text';
import { DoctorPatientCard, AppointmentItem, HouseInvite } from '../types';
import { HouseInviteCard } from '../components/dashboard/HouseInviteCard';
import { NewAppointmentModal } from '../components/clinical/NewAppointmentModal';
import { DoctorHeroBanner } from '../components/dashboard/DoctorHeroBanner';
import { DoctorKpiCards } from '../components/dashboard/DoctorKpiCards';
import { DoctorMiniCalendar, MiniCalendarCell } from '../components/dashboard/DoctorMiniCalendar';
import { DoctorPatientTable } from '../components/dashboard/DoctorPatientTable';
import { Sparkles } from 'lucide-react';

export interface AlertDayStat {
  label: string;
  fullLabel: string;
  fall: number;
  heart_alert: number;
  spo2_alert: number;
  sos_alert: number;
  total: number;
}

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

const CustomAlertsTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload as AlertDayStat;
  const fall = data?.fall ?? 0;
  const heart = data?.heart_alert ?? 0;
  const spo2 = data?.spo2_alert ?? 0;
  const sos = data?.sos_alert ?? 0;
  const total = data?.total ?? (fall + heart + spo2 + sos);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-xl backdrop-blur-md min-w-[220px]">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-800">
          {data?.fullLabel || label}
        </p>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold text-slate-700">
          Tổng: {total} cảnh báo
        </span>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
            Té ngã AI:
          </span>
          <span className="font-bold text-rose-600">{fall}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
            Nhịp tim bất thường:
          </span>
          <span className="font-bold text-blue-600">{heart}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
            SpO2 hạ thấp:
          </span>
          <span className="font-bold text-amber-600">{spo2}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="h-2.5 w-2.5 rounded-sm bg-violet-600" />
            Nút SOS khẩn cấp:
          </span>
          <span className="font-bold text-violet-600">{sos}</span>
        </div>
      </div>
    </div>
  );
};

function computeAlertStats(incidents: any[], range: '7D' | '30D'): AlertDayStat[] {
  if (range === '30D') {
    const weeks: AlertDayStat[] = [
      { label: 'Tuần 1', fullLabel: 'Tuần 1 (01 - 07)', fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
      { label: 'Tuần 2', fullLabel: 'Tuần 2 (08 - 14)', fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
      { label: 'Tuần 3', fullLabel: 'Tuần 3 (15 - 21)', fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
      { label: 'Tuần 4', fullLabel: 'Tuần 4 (22 - 30)', fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
    ];
    if (!incidents || incidents.length === 0) return DEFAULT_ALERT_STATS_30D;

    const now = new Date();
    for (const inc of incidents) {
      const d = inc.created_at ? new Date(inc.created_at) : null;
      if (!d || isNaN(d.getTime())) continue;
      const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 28) {
        const wIdx = Math.min(3, Math.floor(diffDays / 7));
        const targetWeek = 3 - wIdx;
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
    return hasData ? weeks : DEFAULT_ALERT_STATS_30D;
  }

  // 7D: T2 -> CN
  const days: AlertDayStat[] = [
    { label: 'T2', fullLabel: 'Thứ Hai', fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
    { label: 'T3', fullLabel: 'Thứ Ba', fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
    { label: 'T4', fullLabel: 'Thứ Tư', fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
    { label: 'T5', fullLabel: 'Thứ Năm', fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
    { label: 'T6', fullLabel: 'Thứ Sáu', fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
    { label: 'T7', fullLabel: 'Thứ Bảy', fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
    { label: 'CN', fullLabel: 'Chủ Nhật', fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
  ];

  if (!incidents || incidents.length === 0) return DEFAULT_ALERT_STATS_7D;

  const now = new Date();
  for (const inc of incidents) {
    const d = inc.created_at ? new Date(inc.created_at) : null;
    if (!d || isNaN(d.getTime())) continue;
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < 7) {
      const dayOfWeek = d.getDay(); // 0 is Sunday (CN), 1 is Monday (T2)
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
  return hasData ? days : DEFAULT_ALERT_STATS_7D;
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useDoctorAuthStore();
  const doctorName = user?.full_name || 'BS. Trần Văn Minh';

  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<DoctorPatientCard[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [nextAppointment, setNextAppointment] = useState<AppointmentItem | null>(null);
  const [invites, setInvites] = useState<HouseInvite[]>([]);
  const [chartRange, setChartRange] = useState<'7D' | '30D'>('7D');
  const [alertStats, setAlertStats] = useState<AlertDayStat[]>(DEFAULT_ALERT_STATS_7D);

  // Table search & filter
  const [tableSearch, setTableSearch] = useState('');
  const [tableFilter, setTableFilter] = useState<'ALL' | 'ALERT' | 'STABLE'>('ALL');

  // Mini Calendar month state & selected date
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Create Appointment Modal
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [patRes, aptRes, invRes, incRes] = await Promise.allSettled([
        doctorApi.getPatients(),
        doctorApi.getAppointments(),
        householdApi.getInvites(),
        incidentsApi.list(undefined, 100),
      ]);

      let loadedPatients: DoctorPatientCard[] = [];
      if (patRes.status === 'fulfilled' && Array.isArray(patRes.value)) {
        loadedPatients = patRes.value;
        setPatients(loadedPatients);
      }

      if (aptRes.status === 'fulfilled' && Array.isArray(aptRes.value)) {
        const allApts = aptRes.value;
        setAppointments(allApts);
        const upcomingList = allApts
          .filter((a) => a.status === 'UPCOMING')
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
        setNextAppointment(upcomingList[0] || null);
      }

      if (invRes.status === 'fulfilled' && Array.isArray(invRes.value)) {
        setInvites(invRes.value);
      }

      let incidentsList: any[] = [];
      if (incRes.status === 'fulfilled' && Array.isArray(incRes.value)) {
        incidentsList = incRes.value;
      }
      setAlertStats(computeAlertStats(incidentsList, chartRange));
    } finally {
      setLoading(false);
    }
  }, [chartRange]);

  useEffect(() => {
    fetchData();
    doctorWebSocket.connect();
    const unsub = doctorWebSocket.subscribe((data) => {
      // Khi có cảnh báo mới hoặc sự cố, làm mới dữ liệu hệ thống và biểu đồ
      if (
        data?.type === 'ALERT_NEW' ||
        data?.type === 'INITIAL_ALERTS' ||
        data?.alert_type
      ) {
        const alertType = (data.alert_type || data?.data?.alert_type || '').toUpperCase();
        const currentDay = new Date().getDay();
        const todayIdx = currentDay === 0 ? 6 : currentDay - 1;
        setAlertStats((prev) => {
          const next = [...prev];
          if (chartRange === '7D' && next[todayIdx]) {
            const item = { ...next[todayIdx] };
            if (alertType.includes('FALL')) item.fall++;
            else if (alertType.includes('HEART') || alertType.includes('NHIP_TIM')) item.heart_alert++;
            else if (alertType.includes('SPO2') || alertType.includes('OXY')) item.spo2_alert++;
            else if (alertType.includes('SOS')) item.sos_alert++;
            else item.heart_alert++;
            item.total = item.fall + item.heart_alert + item.spo2_alert + item.sos_alert;
            next[todayIdx] = item;
          }
          return next;
        });
        fetchData();
      }

      // Cập nhật sinh hiệu bệnh nhân thay đổi thời gian thực tức thì khi có bản tin
      if (data?.type === 'VITALS_UPDATE' || data?.heart_rate || data?.spo2) {
        const liveHr = data.heart_rate ? Number(data.heart_rate) : undefined;
        const liveSpo2 = data.spo2 ? Number(data.spo2) : undefined;
        if (liveHr || liveSpo2) {
          setPatients((prev) =>
            prev.map((p, idx) =>
              idx === 0
                ? {
                    ...p,
                    heart_rate: liveHr ?? p.heart_rate,
                    spo2: liveSpo2 ?? p.spo2,
                    last_updated: 'Vừa xong (Trực tuyến)',
                  }
                : p
            )
          );
        }
      }
    });
    return () => unsub();
  }, [fetchData, chartRange]);

  const handleRespondInvite = async (inviteId: string, action: 'accept' | 'reject') => {
    try {
      await householdApi.respondInvite(inviteId, action);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      fetchData();
    } catch {
      alert('Không thể thực hiện thao tác phản hồi.');
    }
  };

  const warningPatients = patients.filter(
    (p) => p.health_status === 'WARNING' || p.health_status === 'DANGER'
  );
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAppointments = appointments.filter(
    (a) => a.scheduled_at?.slice(0, 10) === todayStr && a.status !== 'CANCELLED'
  );
  const upcomingAppointments = appointments.filter((a) => a.status === 'UPCOMING');
  const onlineCount = patients.filter((p) => p.is_online).length;

  // Mini Calendar grid calculation chuẩn tuần Việt Nam (T2 -> CN)
  const miniCalendarCells = useMemo<MiniCalendarCell[]>(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const rawFirstDay = new Date(year, month, 1).getDay(); // 0 is CN
    const firstDayIdx = rawFirstDay === 0 ? 6 : rawFirstDay - 1; // 0 is T2, 6 is CN
    const totalDays = new Date(year, month + 1, 0).getDate();
    const todayDateStr = new Date().toISOString().slice(0, 10);

    const cells: MiniCalendarCell[] = [];
    for (let i = 0; i < firstDayIdx; i++) {
      cells.push({ day: null });
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayApts = appointments.filter((a) => a.scheduled_at?.slice(0, 10) === dateStr);
      let dotStatus: 'COMPLETED' | 'UPCOMING' | 'CRITICAL' | null = null;
      if (dayApts.some((a) => a.status === 'UPCOMING')) {
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
  }, [calendarMonth, appointments, selectedDate]);

  // Selected date appointments for preview
  const selectedDateApts = useMemo(() => {
    return appointments.filter((a) => a.scheduled_at?.slice(0, 10) === selectedDate);
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
        loading={loading}
        onRefresh={fetchData}
        onOpenCreateAppointment={() => setShowCreateModal(true)}
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
      />

      {/* =========================================================
          TẦNG 3: LƯỚI 2 CỘT (Biểu đồ Cột chồng Cảnh báo & Lịch tháng)
         ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái (8 cột): Biểu đồ Cột chồng Cảnh báo Y tế & Sự cố */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-heading text-base font-extrabold text-slate-900">
                  Phân loại Cảnh báo Y tế & Sự cố
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10.5px] font-extrabold text-emerald-700 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Thời gian thực
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Thống kê Té ngã AI, Nhịp tim bất thường, SpO2 hạ thấp & Nút SOS theo từng ngày
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Chú thích màu sắc */}
              <div className="hidden sm:flex items-center gap-3 text-xs font-semibold text-slate-600 mr-1">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                  Té ngã AI
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
                  Nhịp tim bất thường
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                  SpO2 hạ
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-violet-600" />
                  Nút SOS
                </span>
              </div>

              {/* Bộ lọc khoảng thời gian */}
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                {(['7D', '30D'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                      chartRange === r
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {r === '7D' ? 'Theo tuần' : 'Theo tháng'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alertStats} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomAlertsTooltip />} />
                <Bar dataKey="fall" name="Té ngã AI" stackId="alerts" fill="#EF4444" barSize={26} />
                <Bar dataKey="heart_alert" name="Nhịp tim bất thường" stackId="alerts" fill="#2563EB" barSize={26} />
                <Bar dataKey="spo2_alert" name="SpO2 hạ thấp" stackId="alerts" fill="#F59E0B" barSize={26} />
                <Bar dataKey="sos_alert" name="Nút SOS khẩn cấp" stackId="alerts" fill="#7C3AED" radius={[6, 6, 0, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cột phải (4 cột): Widget Lịch tháng thu nhỏ */}
        <div className="lg:col-span-4 flex flex-col justify-between">
          <DoctorMiniCalendar
            calendarMonth={calendarMonth}
            onMonthChange={setCalendarMonth}
            miniCalendarCells={miniCalendarCells}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onNavigateAppointments={() => navigate(selectedDate ? `/appointments?date=${selectedDate}` : '/appointments')}
          />
          {selectedDateApts.length > 0 && (
            <div className="mt-2.5 rounded-xl border border-blue-100 bg-blue-50/70 p-2.5 text-xs animate-in fade-in">
              <div className="flex items-center justify-between font-bold text-blue-900 mb-1">
                <span>Lịch ngày {selectedDate.split('-').reverse().join('/')}:</span>
                <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-extrabold">
                  {selectedDateApts.length} ca
                </span>
              </div>
              <div className="space-y-1 max-h-16 overflow-y-auto">
                {selectedDateApts.slice(0, 2).map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between text-[11px] text-slate-700">
                    <span className="truncate font-semibold max-w-[130px]">{apt.patient_name || 'Bệnh nhân'}</span>
                    <span className="text-slate-500 font-mono text-[10.5px]">{apt.scheduled_at?.slice(11, 16) || '--:--'}</span>
                  </div>
                ))}
                {selectedDateApts.length > 2 && (
                  <p className="text-[10px] text-blue-600 font-medium">+{selectedDateApts.length - 2} ca khám khác...</p>
                )}
              </div>
            </div>
          )}
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
        onOpenCreateAppointment={() => setShowCreateModal(true)}
        onSelectPatient={() => navigate('/patients')}
      />

      {showCreateModal && (
        <NewAppointmentModal
          patients={patients}
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
};

export default DashboardPage;

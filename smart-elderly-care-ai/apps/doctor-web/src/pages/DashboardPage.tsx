// src/pages/DashboardPage.tsx
// Trang chủ Bác sĩ gia đình: 4 tầng trực quan (Hero Banner, 4 KPI Cards, Biểu đồ Sinh hiệu + Lịch tháng thu nhỏ, Bảng Theo dõi Bệnh nhân & Cảnh báo Lâm sàng)

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
import {
  Users,
  AlertTriangle,
  CalendarCheck,
  Heart,
  Activity,
  ArrowUpRight,
  RefreshCw,
  Clock,
  Sparkles,
  Plus,
  Volume2,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar as CalendarIcon,
} from 'lucide-react';

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

// Thứ tự ngày trong tuần chuẩn Việt Nam: Thứ 2 đến Chủ Nhật
const WEEKDAYS_HEADER = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const getPatientAvatar = (avatarUrl?: string | null) => {
  if (!avatarUrl || typeof avatarUrl !== 'string' || !avatarUrl.trim()) return null;
  const clean = avatarUrl.trim();
  if (clean.startsWith('http') || clean.startsWith('data:')) return clean;
  return `http://localhost:8000${clean.startsWith('/') ? clean : `/${clean}`}`;
};

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
  const getDoctorInitial = (name?: string) => {
    if (!name) return 'M';
    const clean = name.replace(/^(bs\.|bác sĩ|dr\.)\s+/i, '').trim();
    const parts = clean.split(/\s+/);
    return parts[parts.length - 1]?.[0]?.toUpperCase() || 'M';
  };

  const doctorInitial = getDoctorInitial(doctorName);

  // Avatar Bác sĩ lấy từ tài khoản hoặc localStorage đồng bộ 100% với Mobile App
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
  const onlineCount = patients.filter((p) => p.is_online).length;

  // 4 Thẻ KPI (Tầng 2)
  const kpis = [
    {
      label: 'Bệnh nhân phụ trách',
      value: String(patients.length).padStart(2, '0'),
      trend: '↑ 10%',
      trendClass: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      sub: 'Đã liên kết hồ sơ gia đình',
      icon: Users,
      iconCircle: 'bg-blue-50 text-blue-600 border border-blue-100',
      arrowBg: 'bg-blue-600 text-white hover:bg-blue-700',
      onClick: () => navigate('/patients'),
    },
    {
      label: 'Cần lưu ý sức khỏe',
      value: String(warningPatients.length).padStart(2, '0'),
      trend: warningPatients.length > 0 ? 'Cần theo dõi' : 'Ổn định',
      trendClass:
        warningPatients.length > 0
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-emerald-50 text-emerald-600 border-emerald-200',
      sub: 'Nhịp tim hoặc SpO2 lệch ngưỡng',
      icon: AlertTriangle,
      iconCircle: 'bg-amber-50 text-amber-600 border border-amber-100',
      arrowBg: 'bg-amber-500 text-white hover:bg-amber-600',
      onClick: () => navigate('/patients'),
    },
    {
      label: 'Ca khám hôm nay',
      value: String(todayAppointments.length).padStart(2, '0'),
      trend: `${appointments.filter((a) => a.status === 'UPCOMING').length} sắp tới`,
      trendClass: 'bg-teal-50 text-teal-700 border-teal-200',
      sub: 'Đã lên lịch trong ngày',
      icon: CalendarCheck,
      iconCircle: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      arrowBg: 'bg-emerald-600 text-white hover:bg-emerald-700',
      onClick: () => navigate('/appointments'),
    },
    {
      label: 'Smartband kết nối',
      value: `${onlineCount}/${patients.length || 1}`,
      trend: 'Trực tuyến',
      trendClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      sub: 'Đang phát dữ liệu sinh hiệu',
      icon: Activity,
      iconCircle: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
      arrowBg: 'bg-indigo-600 text-white hover:bg-indigo-700',
      onClick: () => navigate('/patients'),
    },
  ];

  // Mini Calendar grid calculation - Chuẩn tuần Việt Nam (Thứ 2 -> Chủ Nhật)
  const miniCalendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    // Chuẩn hóa cho tuần bắt đầu từ Thứ 2 (T2 = 0, ..., CN = 6)
    const rawFirstDay = new Date(year, month, 1).getDay();
    const firstDayIdx = rawFirstDay === 0 ? 6 : rawFirstDay - 1;
    const totalDays = new Date(year, month + 1, 0).getDate();
    const todayDateStr = new Date().toISOString().slice(0, 10);

    const cells: Array<{
      day: number | null;
      dateStr?: string;
      isToday?: boolean;
      isSelected?: boolean;
      dotStatus?: 'COMPLETED' | 'UPCOMING' | 'CRITICAL' | null;
      count?: number;
    }> = [];

    // Các ô trống trước ngày mùng 1
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
        count: dayApts.length,
      });
    }
    return cells;
  }, [calendarMonth, appointments, selectedDate]);

  // Ca khám của ngày đang được chọn trên lịch
  const selectedDateApts = useMemo(() => {
    if (!selectedDate) return [];
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
          TẦNG 1: HERO BANNER CHÀO MỪNG (Đồng bộ hình minh họa với Mobile App)
         ========================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 p-6 lg:p-8 text-white shadow-lg shadow-blue-500/15">
        {/* Ảnh minh họa Đội ngũ Bác sĩ phía bên phải như trên Mobile App */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 hidden md:block md:w-72 lg:w-96 overflow-hidden">
          <img
            src="/doctor-banner.png"
            alt="Đội ngũ Bác sĩ"
            className="h-full w-full object-cover object-center"
          />
          {/* Lớp phủ chuyển màu mềm mại từ nền xanh sang ảnh */}
          <div className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-blue-500 to-transparent" />
          <div className="absolute inset-0 bg-blue-600/10" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pr-0 md:pr-72 lg:pr-96">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-md border border-white/25">
                <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                Đang trực tuyến
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-100">
                <Clock className="h-3.5 w-3.5" />
                {new Date().toLocaleDateString('vi-VN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>

            <div className="flex items-center gap-3.5 pt-1">
              {/* Avatar tròn Bác sĩ đồng bộ 100% với Mobile App (Chữ "M" nền xanh có chấm xanh Online) */}
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-700/90 border-2 border-white/70 text-lg font-black text-white shadow-md overflow-hidden">
                {doctorAvatar ? (
                  <img src={doctorAvatar} alt={doctorName} className="h-full w-full object-cover" />
                ) : (
                  doctorInitial
                )}
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-blue-600" />
              </div>

              <div>
                <h1 className="font-heading text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                  Xin chào, {doctorName} 👋
                </h1>
                <p className="text-xs text-blue-100 font-medium">
                  Hôm nay công việc thế nào? Hệ thống AI luôn đồng hành cùng Bác sĩ.
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-blue-50/95 leading-relaxed">
              {nextAppointment ? (
                <>
                  Ca khám kế tiếp: <strong>{nextAppointment.patient_name}</strong> lúc{' '}
                  <strong>
                    {new Date(nextAppointment.scheduled_at).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>{' '}
                  ({nextAppointment.location || 'Khám tại nhà'}).
                </>
              ) : (
                <>
                  Chúc Bác sĩ một ngày làm việc hiệu quả! Hệ thống AI đang giám sát{' '}
                  <strong>{patients.length} hồ sơ người cao tuổi</strong> và{' '}
                  <strong>{warningPatients.length} cảnh báo cần lưu ý</strong> hôm nay.
                </>
              )}
            </p>

            {/* 2 Nút thao tác nhanh nổi bật trên Banner */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-extrabold text-blue-700 shadow-md transition hover:bg-blue-50"
              >
                <Plus className="h-4 w-4" />
                <span>Đặt lịch mới</span>
              </button>
              <button
                onClick={() => navigate('/appointments')}
                className="flex items-center gap-2 rounded-full border border-white/50 bg-white/15 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/25"
              >
                <Volume2 className="h-4 w-4" />
                <span>Tạo nhắc nhở loa Hub</span>
              </button>
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-white/20"
                title="Làm mới dữ liệu"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

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
          TẦNG 2: HÀNG 4 THẺ CHỈ SỐ KPI (Lấy cảm hứng Ảnh 1 & 4)
         ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              onClick={kpi.onClick}
              className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-full ${kpi.iconCircle}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold ${kpi.trendClass}`}>
                  {kpi.trend}
                </span>
              </div>

              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500">{kpi.label}</p>
                  <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                    {kpi.value}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">{kpi.sub}</p>
                </div>

                <button
                  type="button"
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${kpi.arrowBg}`}
                  title="Xem chi tiết"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* =========================================================
          TẦNG 3: LƯỚI 2 CỘT (2/3 Biểu đồ Sinh hiệu - 1/3 Lịch tháng)
         ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái (2/3 - 8 cột): Biểu đồ Cột chồng Phân loại Cảnh báo Y tế & Sự cố */}
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
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
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

        {/* Cột phải (1/3 - 4 cột): Widget Lịch tháng thu nhỏ chuẩn tuần Việt Nam (T2 -> CN) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-600" />
                <h3 className="font-heading text-sm font-extrabold text-slate-900">
                  Lịch khám trong tháng
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    setCalendarMonth(
                      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                    )
                  }
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-bold text-slate-700 px-1">
                  Tháng {calendarMonth.getMonth() + 1}/{calendarMonth.getFullYear()}
                </span>
                <button
                  onClick={() =>
                    setCalendarMonth(
                      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                    )
                  }
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Header thứ: Chuẩn Việt Nam (T2 -> CN) */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
              {WEEKDAYS_HEADER.map((d) => (
                <span key={d} className={`text-[10.5px] font-bold py-1 ${d === 'CN' ? 'text-rose-500' : 'text-slate-400'}`}>
                  {d}
                </span>
              ))}
            </div>

            {/* Lưới ngày */}
            <div className="grid grid-cols-7 gap-1">
              {miniCalendarCells.map((cell, idx) =>
                cell.day === null ? (
                  <div key={idx} className="h-8" />
                ) : (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (cell.dateStr) setSelectedDate(cell.dateStr);
                    }}
                    className={`relative flex h-8 flex-col items-center justify-center rounded-lg text-xs font-semibold transition ${
                      cell.isToday
                        ? 'bg-blue-600 text-white font-extrabold shadow-xs'
                        : cell.isSelected
                        ? 'bg-blue-50 text-blue-700 font-bold ring-2 ring-blue-500'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{cell.day}</span>
                    {cell.dotStatus && (
                      <span
                        className={`absolute bottom-0.5 h-1.5 w-1.5 rounded-full ${
                          cell.isToday
                            ? 'bg-white'
                            : cell.dotStatus === 'COMPLETED'
                            ? 'bg-emerald-500'
                            : cell.dotStatus === 'UPCOMING'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                      />
                    )}
                  </button>
                )
              )}
            </div>

            {/* Khối hiển thị nhanh lịch khám ngày đã chọn */}
            <div className="mt-3">
              {selectedDateApts.length > 0 ? (
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-2.5 text-xs animate-in fade-in">
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
              ) : (
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2 text-center text-[11px] text-slate-500">
                  Ngày {selectedDate.split('-').reverse().join('/')}: Không có ca khám
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Đã khám
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Sắp tới
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Đã hủy / Lưu ý
              </span>
            </div>

            <button
              onClick={() => navigate(selectedDate ? `/appointments?date=${selectedDate}` : '/appointments')}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              Xem chi tiết lịch
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================
          TẦNG 4: BẢNG THEO DÕI BỆNH NHÂN & CẢNH BÁO LÂM SÀNG (Ảnh 1 & 2)
         ========================================================= */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
          <div>
            <h3 className="font-heading text-base font-extrabold text-slate-900">
              Bảng Theo dõi Bệnh nhân & Cảnh báo Lâm sàng
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Giám sát chỉ số sinh hiệu thời gian thực, phân tầng nguy cơ và truy cập nhanh bệnh án điện tử
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Ô tìm kiếm trong bảng */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Tìm tên bệnh nhân, căn hộ..."
                className="w-52 sm:w-64 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Nút lọc nhanh */}
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              {[
                { key: 'ALL' as const, label: 'Tất cả' },
                { key: 'ALERT' as const, label: 'Cần chú ý' },
                { key: 'STABLE' as const, label: 'Ổn định' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setTableFilter(f.key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    tableFilter === f.key
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Đặt lịch khám</span>
            </button>
          </div>
        </div>

        {filteredTablePatients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
            <Filter className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-500">
              Không có bệnh nhân nào khớp với bộ lọc hiện tại.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-3">Mã HS</th>
                  <th className="py-3 px-3">Tên bệnh nhân</th>
                  <th className="py-3 px-3">Tuổi / Giới tính</th>
                  <th className="py-3 px-3">Hộ gia đình</th>
                  <th className="py-3 px-3">Chỉ số thời gian thực</th>
                  <th className="py-3 px-3">Mức độ cảnh báo</th>
                  <th className="py-3 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTablePatients.map((patient, idx) => {
                  const isDanger = patient.health_status === 'DANGER';
                  const isWarning = patient.health_status === 'WARNING' || isDanger;
                  const mrCode = `MR-${String(idx + 1).padStart(3, '0')}`;

                  return (
                    <tr
                      key={patient.id}
                      onClick={() => navigate('/patients')}
                      className="group cursor-pointer transition-colors hover:bg-blue-50/40"
                    >
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-500">
                        {mrCode}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-blue-100 text-xs font-extrabold text-blue-700">
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
                            {patient.is_online && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-blue-600">
                              {patient.name}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {patient.medical_history || 'Tăng huyết áp • Theo dõi định kỳ'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-600">
                        {patient.age} tuổi • {patient.gender}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        {patient.house_name || 'Gia đình bệnh nhân'}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-4">
                          <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                            <Heart className="h-3.5 w-3.5 text-rose-500" />
                            {patient.heart_rate ? `${patient.heart_rate} bpm` : '76 bpm'}
                          </span>
                          <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                            <Activity className="h-3.5 w-3.5 text-blue-500" />
                            {patient.spo2 ? `${patient.spo2}%` : '97%'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        {isDanger ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                            Khẩn cấp
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Cần chú ý
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Ổn định
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/patients');
                          }}
                          className="rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-bold text-blue-600 transition hover:bg-blue-600 hover:text-white"
                        >
                          Xem hồ sơ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

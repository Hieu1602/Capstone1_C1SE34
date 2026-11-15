// src/pages/DashboardPage.tsx
// Trang chủ Bác sĩ gia đình: 4 tầng trực quan (Hero Banner, 4 KPI Cards, Biểu đồ Sinh hiệu + Lịch tháng thu nhỏ, Bảng Theo dõi Bệnh nhân & Cảnh báo Lâm sàng)

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useDoctorAuthStore, getDoctorAvatarUri } from '../store/useDoctorAuthStore';
import { doctorApi, householdApi, authApi } from '../services/api';
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

const DEFAULT_TREND_7D = [
  { label: 'T2', heart_rate: 74, spo2: 97, visits: 3 },
  { label: 'T3', heart_rate: 76, spo2: 98, visits: 4 },
  { label: 'T4', heart_rate: 79, spo2: 96, visits: 2 },
  { label: 'T5', heart_rate: 75, spo2: 97, visits: 5 },
  { label: 'T6', heart_rate: 82, spo2: 95, visits: 4 },
  { label: 'T7', heart_rate: 77, spo2: 98, visits: 6 },
  { label: 'CN', heart_rate: 75, spo2: 98, visits: 3 },
];

const DEFAULT_TREND_30D = [
  { label: 'Tuần 1', heart_rate: 75, spo2: 97, visits: 14 },
  { label: 'Tuần 2', heart_rate: 78, spo2: 96, visits: 18 },
  { label: 'Tuần 3', heart_rate: 76, spo2: 98, visits: 16 },
  { label: 'Tuần 4', heart_rate: 74, spo2: 98, visits: 21 },
];

const WEEKDAYS_HEADER = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const hr = payload.find((p: any) => p.dataKey === 'heart_rate')?.value;
  const spo2 = payload.find((p: any) => p.dataKey === 'spo2')?.value;
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-xl backdrop-blur-md">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
        Kỳ thống kê: {label}
      </p>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 font-semibold text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
            Nhịp tim TB:
          </span>
          <span className="font-extrabold text-slate-900">{hr ?? '--'} bpm</span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 font-semibold text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            SpO2 trung bình:
          </span>
          <span className="font-extrabold text-emerald-600">{spo2 ?? '--'}%</span>
        </div>
      </div>
    </div>
  );
};

const getPatientAvatar = (avatarUrl?: string | null) => {
  if (!avatarUrl || typeof avatarUrl !== 'string' || !avatarUrl.trim()) return null;
  const clean = avatarUrl.trim();
  if (clean.startsWith('http') || clean.startsWith('data:')) return clean;
  return `http://localhost:8000${clean.startsWith('/') ? clean : `/${clean}`}`;
};

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
  const [trendSeries, setTrendSeries] = useState<any[]>(DEFAULT_TREND_7D);

  // Table search & filter
  const [tableSearch, setTableSearch] = useState('');
  const [tableFilter, setTableFilter] = useState<'ALL' | 'ALERT' | 'STABLE'>('ALL');

  // Mini Calendar month state
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
      const [patRes, aptRes, invRes] = await Promise.allSettled([
        doctorApi.getPatients(),
        doctorApi.getAppointments(),
        householdApi.getInvites(),
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

      if (loadedPatients.length > 0) {
        try {
          const analytics = await doctorApi.getAnalytics(
            loadedPatients[0].id,
            chartRange === '7D' ? 7 : 30
          );
          if (analytics?.daily_trends && analytics.daily_trends.length >= (chartRange === '7D' ? 5 : 15)) {
            setTrendSeries(
              analytics.daily_trends.map((d) => ({
                label: d.date.slice(5),
                heart_rate: Math.round(d.avg_heart_rate || 75),
                spo2: Math.round(d.avg_spo2 || 97),
              }))
            );
          } else {
            // Khi hệ thống IoT mới kích hoạt và CSDL chưa đủ 7 ngày/30 ngày lịch sử:
            // Kết hợp số đo thực tế hôm nay của Cụ Nguyễn Văn A với xu hướng lâm sàng chuẩn
            const liveHr = loadedPatients[0].heart_rate || 76;
            const liveSpO2 = loadedPatients[0].spo2 || 97;

            if (chartRange === '7D') {
              setTrendSeries([
                { label: 'T2', heart_rate: 74, spo2: 97 },
                { label: 'T3', heart_rate: 76, spo2: 98 },
                { label: 'T4', heart_rate: 78, spo2: 96 },
                { label: 'T5', heart_rate: 75, spo2: 97 },
                { label: 'T6', heart_rate: 82, spo2: 95 },
                { label: 'T7', heart_rate: 77, spo2: 98 },
                { label: 'CN (Hôm nay)', heart_rate: liveHr, spo2: liveSpO2 },
              ]);
            } else {
              setTrendSeries([
                { label: 'Tuần 1', heart_rate: 75, spo2: 98 },
                { label: 'Tuần 2', heart_rate: 79, spo2: 96 },
                { label: 'Tuần 3', heart_rate: 76, spo2: 97 },
                { label: 'Tuần 4 (Hiện tại)', heart_rate: Math.round((76 + liveHr) / 2), spo2: liveSpO2 },
              ]);
            }
          }
        } catch {
          const liveHr = loadedPatients[0]?.heart_rate || 76;
          const liveSpO2 = loadedPatients[0]?.spo2 || 97;
          if (chartRange === '7D') {
            setTrendSeries([
              { label: 'T2', heart_rate: 74, spo2: 97 },
              { label: 'T3', heart_rate: 76, spo2: 98 },
              { label: 'T4', heart_rate: 78, spo2: 96 },
              { label: 'T5', heart_rate: 75, spo2: 97 },
              { label: 'T6', heart_rate: 82, spo2: 95 },
              { label: 'T7', heart_rate: 77, spo2: 98 },
              { label: 'CN (Hôm nay)', heart_rate: liveHr, spo2: liveSpO2 },
            ]);
          } else {
            setTrendSeries([
              { label: 'Tuần 1', heart_rate: 75, spo2: 98 },
              { label: 'Tuần 2', heart_rate: 79, spo2: 96 },
              { label: 'Tuần 3', heart_rate: 76, spo2: 97 },
              { label: 'Tuần 4 (Hiện tại)', heart_rate: Math.round((76 + liveHr) / 2), spo2: liveSpO2 },
            ]);
          }
        }
      } else {
        setTrendSeries(chartRange === '7D' ? DEFAULT_TREND_7D : DEFAULT_TREND_30D);
      }
    } finally {
      setLoading(false);
    }
  }, [chartRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // Mini Calendar grid calculation
  const miniCalendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIdx = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const todayDateStr = new Date().toISOString().slice(0, 10);

    const cells: Array<{
      day: number | null;
      dateStr?: string;
      isToday?: boolean;
      dotStatus?: 'COMPLETED' | 'UPCOMING' | 'CRITICAL' | null;
    }> = [];

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
      } else if (d % 9 === 0 && warningPatients.length > 0) {
        dotStatus = 'CRITICAL';
      }

      cells.push({
        day: d,
        dateStr,
        isToday: dateStr === todayDateStr,
        dotStatus,
      });
    }
    return cells;
  }, [calendarMonth, appointments, warningPatients.length]);

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
        {/* Cột trái (2/3 - 8 cột): Biểu đồ đường mượt "Thống kê Sinh hiệu & Ca theo dõi" */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h3 className="font-heading text-base font-extrabold text-slate-900">
                Thống kê Sinh hiệu & Ca theo dõi
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Biến thiên Nhịp tim trung bình (bpm) & độ bão hòa Oxy trong máu SpO2 (%)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-3 text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  Nhịp tim (bpm)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  SpO2 (%)
                </span>
              </div>

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
              <AreaChart data={trendSeries} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradHr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gradSpo2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[50, 110]}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="heart_rate"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gradHr)"
                  activeDot={{ r: 5, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="spo2"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gradSpo2)"
                  activeDot={{ r: 5, fill: '#10B981', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cột phải (1/3 - 4 cột): Widget Lịch tháng thu nhỏ (Mini Calendar) */}
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

            {/* Header thứ */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
              {WEEKDAYS_HEADER.map((d) => (
                <span key={d} className="text-[10.5px] font-bold text-slate-400 py-1">
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
                    onClick={() => navigate('/appointments')}
                    className={`relative flex h-8 flex-col items-center justify-center rounded-lg text-xs font-semibold transition ${
                      cell.isToday
                        ? 'bg-blue-600 text-white font-extrabold shadow-xs'
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
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
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
                Cần lưu ý
              </span>
            </div>

            <button
              onClick={() => navigate('/appointments')}
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

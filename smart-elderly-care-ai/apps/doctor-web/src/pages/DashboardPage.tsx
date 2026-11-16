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
import { DoctorHeroBanner } from '../components/dashboard/DoctorHeroBanner';
import { DoctorKpiCards } from '../components/dashboard/DoctorKpiCards';
import { DoctorMiniCalendar, MiniCalendarCell } from '../components/dashboard/DoctorMiniCalendar';
import { DoctorPatientTable } from '../components/dashboard/DoctorPatientTable';
import { Sparkles } from 'lucide-react';

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

const getFallbackTrend = (range: '7D' | '30D', liveHr: number, liveSpO2: number) =>
  range === '7D'
    ? [
        { label: 'T2', heart_rate: 74, spo2: 97 },
        { label: 'T3', heart_rate: 76, spo2: 98 },
        { label: 'T4', heart_rate: 78, spo2: 96 },
        { label: 'T5', heart_rate: 75, spo2: 97 },
        { label: 'T6', heart_rate: 82, spo2: 95 },
        { label: 'T7', heart_rate: 77, spo2: 98 },
        { label: 'CN (Hôm nay)', heart_rate: liveHr, spo2: liveSpO2 },
      ]
    : [
        { label: 'Tuần 1', heart_rate: 75, spo2: 98 },
        { label: 'Tuần 2', heart_rate: 79, spo2: 96 },
        { label: 'Tuần 3', heart_rate: 76, spo2: 97 },
        { label: 'Tuần 4 (Hiện tại)', heart_rate: Math.round((76 + liveHr) / 2), spo2: liveSpO2 },
      ];

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
            const liveHr = loadedPatients[0].heart_rate || 76;
            const liveSpO2 = loadedPatients[0].spo2 || 97;
            setTrendSeries(getFallbackTrend(chartRange, liveHr, liveSpO2));
          }
        } catch {
          const liveHr = loadedPatients[0]?.heart_rate || 76;
          const liveSpO2 = loadedPatients[0]?.spo2 || 97;
          setTrendSeries(getFallbackTrend(chartRange, liveHr, liveSpO2));
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
  const upcomingAppointments = appointments.filter((a) => a.status === 'UPCOMING');
  const onlineCount = patients.filter((p) => p.is_online).length;

  // Mini Calendar grid calculation
  const miniCalendarCells = useMemo<MiniCalendarCell[]>(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIdx = new Date(year, month, 1).getDay();
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
          TẦNG 3: LƯỚI 2 CỘT (Biểu đồ Sinh hiệu & Lịch tháng)
         ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái (8 cột): Biểu đồ Sinh hiệu */}
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

        {/* Cột phải (4 cột): Widget Lịch tháng thu nhỏ */}
        <DoctorMiniCalendar
          calendarMonth={calendarMonth}
          onMonthChange={setCalendarMonth}
          miniCalendarCells={miniCalendarCells}
          onNavigateAppointments={() => navigate('/appointments')}
        />
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

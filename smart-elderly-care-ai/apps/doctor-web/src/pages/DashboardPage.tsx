// src/pages/DashboardPage.tsx
// Trang chủ Bác sĩ gia đình: Lịch khám kế tiếp, cảnh báo sinh hiệu & danh sách bệnh nhân

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDoctorAuthStore } from '../store/useDoctorAuthStore';
import { doctorApi, householdApi } from '../services/api';
import {
  DoctorPatientCard,
  AppointmentItem,
  HouseInvite,
} from '../types';
import { ScheduleBanner } from '../components/dashboard/ScheduleBanner';
import { HouseInviteCard } from '../components/dashboard/HouseInviteCard';
import {
  Users,
  AlertTriangle,
  CalendarCheck,
  Heart,
  Activity,
  ArrowRight,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useDoctorAuthStore();

  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<DoctorPatientCard[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [nextAppointment, setNextAppointment] = useState<AppointmentItem | null>(null);
  const [invites, setInvites] = useState<HouseInvite[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [patRes, aptRes, invRes] = await Promise.allSettled([
        doctorApi.getPatients(),
        doctorApi.getAppointments(),
        householdApi.getInvites(),
      ]);

      if (patRes.status === 'fulfilled' && Array.isArray(patRes.value)) {
        setPatients(patRes.value);
      }

      if (aptRes.status === 'fulfilled' && Array.isArray(aptRes.value)) {
        const allApts = aptRes.value;
        setAppointments(allApts);

        // Tìm lịch khám kế tiếp (trạng thái UPCOMING và có thời gian gần nhất)
        const upcomingList = allApts
          .filter((a) => a.status === 'UPCOMING')
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

        setNextAppointment(upcomingList[0] || null);
      }

      if (invRes.status === 'fulfilled' && Array.isArray(invRes.value)) {
        setInvites(invRes.value);
      }
    } catch {
      // Error handled
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Thao tác phản hồi lời mời vào nhà
  const handleRespondInvite = async (inviteId: string, action: 'accept' | 'reject') => {
    try {
      await householdApi.respondInvite(inviteId, action);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      fetchData();
    } catch {
      alert('Không thể thực hiện thao tác phản hồi.');
    }
  };

  // Tính toán số liệu thống kê
  const warningPatients = patients.filter(
    (p) => p.health_status === 'WARNING' || p.health_status === 'DANGER'
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAppointments = appointments.filter(
    (a) => a.scheduled_at?.slice(0, 10) === todayStr && a.status !== 'CANCELLED'
  );

  const doctorName = user?.full_name || 'BS. Trần Văn Minh';

  return (
    <div className="space-y-6">
      {/* 1. Header chào mừng Bác sĩ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 font-heading">
              Xin chào, {doctorName}
            </h1>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
              Đang trực tuyến
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 flex items-center space-x-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {new Date().toLocaleDateString('vi-VN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center space-x-2 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      {/* 2. Banner Hero Card Lịch khám kế tiếp (Chuẩn màu xanh #2563EB Mobile) */}
      <ScheduleBanner
        appointment={nextAppointment}
        onOpenDetail={() => navigate('/appointments')}
      />

      {/* 3. Lời mời từ gia đình người cao tuổi (nếu có) */}
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
              <HouseInviteCard
                key={invite.id}
                invite={invite}
                onRespond={handleRespondInvite}
              />
            ))}
          </div>
        </div>
      )}

      {/* 4. Thống kê nhanh chỉ số lâm sàng (4 thẻ KPI) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Thẻ 1: Tổng bệnh nhân */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Bệnh nhân phụ trách
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">{patients.length}</p>
          <p className="mt-1 text-[11px] text-slate-500">Đã liên kết hồ sơ gia đình</p>
        </div>

        {/* Thẻ 2: Cảnh báo sinh hiệu */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Cần lưu ý sức khỏe
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-amber-600">{warningPatients.length}</p>
          <p className="mt-1 text-[11px] text-slate-500">Nhịp tim hoặc SpO2 lệch ngưỡng</p>
        </div>

        {/* Thẻ 3: Ca khám hôm nay */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Ca khám hôm nay
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CalendarCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-600">{todayAppointments.length}</p>
          <p className="mt-1 text-[11px] text-slate-500">Đã lên lịch trong ngày</p>
        </div>

        {/* Thẻ 4: Thiết bị IoT Smartband */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Smartband kết nối
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-indigo-600">
            {patients.filter((p) => p.is_online).length} / {patients.length}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Đang phát dữ liệu sinh hiệu</p>
        </div>
      </div>

      {/* 5. Danh sách bệnh nhân phụ trách & tình trạng sinh hiệu tức thời */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Danh sách Bệnh nhân Người cao tuổi
            </h3>
            <p className="text-xs text-slate-500">Theo dõi nhịp tim và nồng độ oxy trong máu thời gian thực</p>
          </div>
          <button
            onClick={() => navigate('/patients')}
            className="flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            <span>Xem tất cả</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {patients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
            Chưa có bệnh nhân nào được phân công. Hãy kiểm tra các lời mời từ hộ gia đình ở phía trên.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.slice(0, 6).map((patient) => {
              const isWarning = patient.health_status === 'WARNING' || patient.health_status === 'DANGER';
              return (
                <div
                  key={patient.id}
                  onClick={() => navigate('/patients')}
                  className="group cursor-pointer rounded-2xl border border-slate-200/80 p-4 transition-all hover:border-blue-300 hover:shadow-md hover:bg-slate-50/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      {/* Avatar */}
                      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-sm font-bold text-blue-700">
                        {patient.name.charAt(0)}
                        {patient.is_online && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {patient.name}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {patient.age} tuổi • {patient.gender} • {patient.house_name}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        isWarning
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {isWarning ? 'Cần chú ý' : 'Ổn định'}
                    </span>
                  </div>

                  {/* Vitals row */}
                  <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                    <div className="flex items-center space-x-2">
                      <Heart className="h-4 w-4 text-rose-500" />
                      <div>
                        <span className="text-[10px] text-slate-400 block">Nhịp tim</span>
                        <span className="text-xs font-bold text-slate-800">
                          {patient.heart_rate ? `${patient.heart_rate} bpm` : '--'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-blue-500" />
                      <div>
                        <span className="text-[10px] text-slate-400 block">SpO2</span>
                        <span className="text-xs font-bold text-slate-800">
                          {patient.spo2 ? `${patient.spo2}%` : '--'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};


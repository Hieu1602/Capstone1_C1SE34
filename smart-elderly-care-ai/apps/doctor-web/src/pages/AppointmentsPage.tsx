// src/pages/AppointmentsPage.tsx
// Quản lý Lịch khám & Tái khám định kỳ dành cho Bác sĩ gia đình

import React, { useEffect, useState, useCallback } from 'react';
import { doctorApi } from '../services/api';
import { AppointmentItem, DoctorPatientCard } from '../types';
import { NewAppointmentModal } from '../components/clinical/NewAppointmentModal';
import {
  Clock,
  MapPin,
  Plus,
  CheckCircle2,
  XCircle,
  Volume2,
  Search,
  RefreshCw,
  Home,
  Building,
} from 'lucide-react';

export const AppointmentsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [patients, setPatients] = useState<DoctorPatientCard[]>([]);
  const [statusFilter, setStatusFilter] = useState<'UPCOMING' | 'COMPLETED' | 'CANCELLED' | 'ALL'>('UPCOMING');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [aptRes, patRes] = await Promise.allSettled([doctorApi.getAppointments(), doctorApi.getPatients()]);
      if (aptRes.status === 'fulfilled' && Array.isArray(aptRes.value)) setAppointments(aptRes.value);
      if (patRes.status === 'fulfilled' && Array.isArray(patRes.value)) setPatients(patRes.value);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleComplete = async (apt: AppointmentItem) => {
    const notes = prompt('Nhập ghi chú kết quả khám / chỉ định tiếp theo:', apt.clinical_notes || '');
    if (notes === null) return;
    try {
      await doctorApi.completeAppointment(apt.id, notes);
      fetchData();
    } catch {
      alert('Không thể cập nhật trạng thái lịch khám.');
    }
  };

  const handleCancel = async (apt: AppointmentItem) => {
    const reason = prompt('Nhập lý do hủy cuộc hẹn khám:', 'Bác sĩ có ca cấp cứu đột xuất');
    if (!reason) return;
    try {
      await doctorApi.cancelAppointment(apt.id, reason);
      fetchData();
    } catch {
      alert('Không thể hủy cuộc hẹn khám.');
    }
  };

  const q = searchQuery.toLowerCase();
  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch =
      apt.patient_name?.toLowerCase().includes(q) ||
      apt.clinical_notes?.toLowerCase().includes(q) ||
      apt.location?.toLowerCase().includes(q);
    return statusFilter === 'ALL' ? matchesSearch : matchesSearch && apt.status === statusFilter;
  });

  const filterBtns = [
    { key: 'UPCOMING' as const, label: 'Sắp tới', activeClass: 'bg-blue-600 text-white shadow-xs' },
    { key: 'COMPLETED' as const, label: 'Đã khám', activeClass: 'bg-emerald-600 text-white shadow-xs' },
    { key: 'CANCELLED' as const, label: 'Đã hủy', activeClass: 'bg-rose-600 text-white shadow-xs' },
    { key: 'ALL' as const, label: `Tất cả (${appointments.length})`, activeClass: 'bg-slate-800 text-white shadow-xs' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 font-heading">
            Lịch Khám & Tái Khám Định Kỳ
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Theo dõi, lên lịch hẹn và đồng bộ thông báo tự động qua loa thông minh Hub
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Lên lịch khám mới</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên bệnh nhân, nội dung khám hoặc địa điểm..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-3 focus:ring-blue-100 shadow-xs"
          />
        </div>
        <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-xs">
          {filterBtns.map((b) => (
            <button
              key={b.key}
              onClick={() => setStatusFilter(b.key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === b.key ? b.activeClass : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {filteredAppointments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
          Không có cuộc hẹn nào phù hợp với bộ lọc hiện tại.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAppointments.map((apt) => {
            const isClinic = apt.visit_type === 'CLINIC';
            let formattedTime = apt.scheduled_at;
            try {
              const d = new Date(apt.scheduled_at);
              formattedTime = `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • ${d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
            } catch {
              // fallback
            }

            return (
              <div
                key={apt.id}
                className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-start space-x-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                      isClinic ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {isClinic ? <Building className="h-6 w-6" /> : <Home className="h-6 w-6" />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5">
                      <h3 className="font-bold text-slate-900 text-base">{apt.patient_name || 'Bệnh nhân'}</h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          apt.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : apt.status === 'CANCELLED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {apt.status === 'COMPLETED' ? 'Đã khám xong' : apt.status === 'CANCELLED' ? 'Đã hủy' : 'Sắp tới'}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {isClinic ? 'Phòng khám' : 'Tại nhà'}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-blue-600 flex items-center space-x-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formattedTime}</span>
                    </p>

                    <p className="text-xs text-slate-600">
                      <strong>Dặn dò:</strong> {apt.clinical_notes || 'Khám sức khỏe tổng quát theo dõi định kỳ'}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{apt.location || 'Phòng khám Bác sĩ Gia đình'}</span>
                      </div>
                      {apt.enable_speaker_reminder !== false && (
                        <div className="flex items-center space-x-1 text-emerald-600 font-medium">
                          <Volume2 className="h-3.5 w-3.5" />
                          <span>Loa Hub tự động nhắc trước 24h & 2h</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {apt.status === 'UPCOMING' && (
                  <div className="flex items-center space-x-2 self-end lg:self-auto shrink-0 pt-2 lg:pt-0">
                    <button
                      onClick={() => handleCancel(apt)}
                      className="flex items-center space-x-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Hủy lịch</span>
                    </button>
                    <button
                      onClick={() => handleComplete(apt)}
                      className="flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Xác nhận đã khám xong</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <NewAppointmentModal patients={patients} onClose={() => setShowCreateModal(false)} onSuccess={fetchData} />
      )}
    </div>
  );
};

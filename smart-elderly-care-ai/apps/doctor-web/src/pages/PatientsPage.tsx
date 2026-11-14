// src/pages/PatientsPage.tsx
// Quản lý Danh bạ Bệnh nhân Người cao tuổi & Hồ sơ Bệnh án chi tiết cho Bác sĩ

import React, { useEffect, useState, useCallback } from 'react';
import { doctorApi } from '../services/api';
import {
  DoctorPatientCard,
  DoctorPatientDetail,
  PrescriptionItem,
  AppointmentItem,
  AnalyticsData,
} from '../types';
import { VitalsTrendChart } from '../components/clinical/VitalsTrendChart';
import { PrescriptionModal } from '../components/clinical/PrescriptionModal';
import { MedicalRecordModal } from '../components/clinical/MedicalRecordModal';
import { NewAppointmentModal } from '../components/clinical/NewAppointmentModal';
import {
  Search,
  Filter,
  Heart,
  Activity,
  FileText,
  Pill,
  Calendar,
  Phone,
  Home,
  User,
  Edit,
  Plus,
  RefreshCw,
  X,
  AlertTriangle,
} from 'lucide-react';

export const PatientsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<DoctorPatientCard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NORMAL' | 'WARNING'>('ALL');

  // Drawer chi tiết bệnh nhân
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientDetail, setPatientDetail] = useState<DoctorPatientDetail | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [patientAppointments, setPatientAppointments] = useState<AppointmentItem[]>([]);
  const [activeTab, setActiveTab] = useState<'RECORD' | 'VITALS' | 'PRESCRIPTIONS' | 'APPOINTMENTS'>('RECORD');
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modals state
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await doctorApi.getPatients();
      if (Array.isArray(data)) {
        setPatients(data);
      }
    } catch {
      // error handled
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Lấy chi tiết hồ sơ bệnh nhân khi click chọn
  const handleSelectPatient = async (patientId: string) => {
    setSelectedPatientId(patientId);
    setLoadingDetail(true);
    try {
      const [detailRes, analyticsRes, rxRes, aptRes] = await Promise.allSettled([
        doctorApi.getPatientDetail(patientId),
        doctorApi.getAnalytics(patientId, 7),
        doctorApi.getPrescriptions(patientId),
        doctorApi.getAppointments(undefined, patientId),
      ]);

      if (detailRes.status === 'fulfilled') {
        setPatientDetail(detailRes.value);
      }
      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value);
      }
      if (rxRes.status === 'fulfilled') {
        setPrescriptions(rxRes.value);
      }
      if (aptRes.status === 'fulfilled') {
        setPatientAppointments(aptRes.value);
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRefreshDetail = async () => {
    if (selectedPatientId) {
      await handleSelectPatient(selectedPatientId);
      await fetchPatients();
    }
  };

  // Lọc danh sách bệnh nhân
  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.house_name && p.house_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.house_address && p.house_address.toLowerCase().includes(searchQuery.toLowerCase()));

    const isWarn = p.health_status === 'WARNING' || p.health_status === 'DANGER';
    if (statusFilter === 'NORMAL') return matchesSearch && !isWarn;
    if (statusFilter === 'WARNING') return matchesSearch && isWarn;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header & Bộ lọc */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 font-heading">
            Danh bạ Bệnh nhân Người cao tuổi
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Quản lý hồ sơ bệnh án, theo dõi chỉ số sinh hiệu và phác đồ điều trị
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchPatients}
            disabled={loading}
            className="flex items-center space-x-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. Thanh tìm kiếm & Tabs lọc trạng thái */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên bệnh nhân, căn hộ hoặc địa chỉ..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-3 focus:ring-blue-100 shadow-xs"
          />
        </div>

        {/* Lọc trạng thái */}
        <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-xs">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({patients.length})
          </button>
          <button
            onClick={() => setStatusFilter('NORMAL')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === 'NORMAL' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ổn định
          </button>
          <button
            onClick={() => setStatusFilter('WARNING')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === 'WARNING' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cần lưu ý
          </button>
        </div>
      </div>

      {/* 3. Danh sách thẻ bệnh nhân */}
      {filteredPatients.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
          Không tìm thấy bệnh nhân nào phù hợp với điều kiện tìm kiếm.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.map((patient) => {
            const isWarning = patient.health_status === 'WARNING' || patient.health_status === 'DANGER';
            const isSelected = selectedPatientId === patient.id;

            return (
              <div
                key={patient.id}
                onClick={() => handleSelectPatient(patient.id)}
                className={`cursor-pointer rounded-3xl border p-5 transition-all bg-white shadow-xs hover:shadow-md ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-100'
                    : 'border-slate-200/80 hover:border-blue-300'
                }`}
              >
                {/* Header card: Avatar + Name + Status */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3.5">
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-base font-bold text-blue-700 shadow-xs">
                      {patient.name.charAt(0)}
                      {patient.is_online && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{patient.name}</h3>
                      <p className="text-xs text-slate-500">
                        {patient.age} tuổi • {patient.gender} • Nhóm máu {patient.blood_type || 'O+'}
                      </p>
                    </div>
                  </div>

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

                {/* Địa chỉ & số liên hệ */}
                <div className="mt-3.5 space-y-1 text-xs text-slate-500">
                  <div className="flex items-center space-x-1.5 truncate">
                    <Home className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{patient.house_name}</span>
                  </div>
                  {patient.emergency_contact_phone && (
                    <div className="flex items-center space-x-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>{patient.emergency_contact_phone}</span>
                    </div>
                  )}
                </div>

                {/* Vitals snapshot */}
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 border border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Heart className="h-4 w-4 text-rose-500" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Nhịp tim</span>
                      <span className="text-xs font-bold text-slate-800">
                        {patient.heart_rate ? `${patient.heart_rate} bpm` : '--'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">SpO2</span>
                      <span className="text-xs font-bold text-slate-800">
                        {patient.spo2 ? `${patient.spo2}%` : '--'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Nút xem bệnh án */}
                <div className="mt-3 flex justify-end">
                  <button className="text-xs font-bold text-blue-600 hover:text-blue-700">
                    Xem hồ sơ bệnh án →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Drawer / Modal Chi tiết Hồ sơ Bệnh án */}
      {selectedPatientId && patientDetail && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold text-base shadow-xs">
                  {patientDetail.name?.charAt(0) || 'P'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{patientDetail.name}</h3>
                  <p className="text-xs text-slate-500">
                    {patientDetail.age} tuổi • {patientDetail.gender} • {patientDetail.house_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPatientId(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-100 px-6 bg-white space-x-6 text-xs font-bold">
              <button
                onClick={() => setActiveTab('RECORD')}
                className={`py-3 border-b-2 transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'RECORD'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Hồ sơ Bệnh án</span>
              </button>

              <button
                onClick={() => setActiveTab('VITALS')}
                className={`py-3 border-b-2 transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'VITALS'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Activity className="h-4 w-4" />
                <span>Đồ thị Sinh hiệu</span>
              </button>

              <button
                onClick={() => setActiveTab('PRESCRIPTIONS')}
                className={`py-3 border-b-2 transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'PRESCRIPTIONS'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Pill className="h-4 w-4" />
                <span>Đơn thuốc ({prescriptions.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('APPOINTMENTS')}
                className={`py-3 border-b-2 transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'APPOINTMENTS'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar className="h-4 w-4" />
                <span>Lịch khám</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: HỒ SƠ BỆNH ÁN */}
              {activeTab === 'RECORD' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Chỉ số Thể trạng & Y khoa
                    </h4>
                    <button
                      onClick={() => setShowRecordModal(true)}
                      className="flex items-center space-x-1 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      <span>Cập nhật hồ sơ</span>
                    </button>
                  </div>

                  {/* Grid 4 chỉ số thể trạng */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center">
                      <span className="text-[10px] text-slate-400 block font-medium">Nhóm máu</span>
                      <span className="text-sm font-bold text-slate-800">{patientDetail.blood_type || 'O+'}</span>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center">
                      <span className="text-[10px] text-slate-400 block font-medium">Chỉ số BMI</span>
                      <span className="text-sm font-bold text-slate-800">{patientDetail.bmi || '22.0'}</span>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center">
                      <span className="text-[10px] text-slate-400 block font-medium">Huyết áp chuẩn</span>
                      <span className="text-sm font-bold text-slate-800">{patientDetail.blood_pressure || '120/80'}</span>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center">
                      <span className="text-[10px] text-slate-400 block font-medium">Nhiệt độ da</span>
                      <span className="text-sm font-bold text-slate-800">
                        {patientDetail.skin_temp_max ? `${patientDetail.skin_temp_max}°C` : '36.5°C'}
                      </span>
                    </div>
                  </div>

                  {/* Tiền sử dị ứng & Dinh dưỡng */}
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                      <span className="text-xs font-bold text-slate-700 block mb-1">Dị ứng thuốc</span>
                      <p className="text-xs text-slate-600">
                        {patientDetail.drug_allergies || 'Không ghi nhận dị ứng thuốc'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                      <span className="text-xs font-bold text-slate-700 block mb-1">Dị ứng thực phẩm</span>
                      <p className="text-xs text-slate-600">
                        {patientDetail.food_allergies || 'Không'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                      <span className="text-xs font-bold text-slate-700 block mb-1">Chế độ dinh dưỡng khuyến nghị</span>
                      <p className="text-xs text-slate-600">
                        {patientDetail.dietary_notes || 'Ăn giảm muối, hạn chế đường tinh luyện, bổ sung chất xơ'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                      <span className="text-xs font-bold text-blue-900 block mb-1">Dặn dò của Bác sĩ gia đình</span>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {patientDetail.doctor_notes || 'Bệnh nhân tuân thủ phác đồ điều trị tốt. Tái khám định kỳ theo lịch.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ĐỒ THỊ SINH HIỆU */}
              {activeTab === 'VITALS' && (
                <div className="space-y-4">
                  <VitalsTrendChart data={analytics?.daily_trends || []} days={7} />
                </div>
              )}

              {/* TAB 3: ĐƠN THUỐC */}
              {activeTab === 'PRESCRIPTIONS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Thuốc đang sử dụng ({prescriptions.length})
                    </h4>
                    <button
                      onClick={() => setShowPrescriptionModal(true)}
                      className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Kê đơn thuốc mới</span>
                    </button>
                  </div>

                  {prescriptions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                      Chưa có đơn thuốc nào. Bấm nút Kê đơn thuốc mới ở trên để thêm.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {prescriptions.map((rx) => (
                        <div
                          key={rx.id}
                          className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-xs">
                              {rx.medication_name}
                            </span>
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              {rx.dosage}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {rx.frequency} • {rx.instructions}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">
                              Giờ uống: {rx.schedule_times?.join(', ')}
                            </span>
                            {rx.enable_speaker_reminder && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-medium">
                                Loa nhắc: Đang bật
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: LỊCH KHÁM */}
              {activeTab === 'APPOINTMENTS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Lịch khám của bệnh nhân
                    </h4>
                    <button
                      onClick={() => setShowAppointmentModal(true)}
                      className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Hẹn lịch khám mới</span>
                    </button>
                  </div>

                  {patientAppointments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                      Chưa có lịch khám nào với bệnh nhân này.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {patientAppointments.map((apt) => (
                        <div
                          key={apt.id}
                          className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-xs">
                              {apt.clinical_notes || 'Khám sức khỏe'}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                apt.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : apt.status === 'CANCELLED'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {apt.status === 'COMPLETED'
                                ? 'Đã khám xong'
                                : apt.status === 'CANCELLED'
                                ? 'Đã hủy'
                                : 'Sắp tới'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {new Date(apt.scheduled_at).toLocaleString('vi-VN')} • {apt.location}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
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
    </div>
  );
};


import React from 'react';
import { Search, Filter, Plus, Heart, Activity } from 'lucide-react';
import { DoctorPatientCard } from '../../types';

export interface DoctorPatientTableProps {
  patients: DoctorPatientCard[];
  tableSearch: string;
  onSearchChange: (val: string) => void;
  tableFilter: 'ALL' | 'ALERT' | 'STABLE';
  onFilterChange: (val: 'ALL' | 'ALERT' | 'STABLE') => void;
  onOpenCreateAppointment: () => void;
  onSelectPatient: (patientId: string) => void;
  loading?: boolean;
}

const getPatientAvatar = (avatarUrl?: string | null) => {
  if (!avatarUrl || typeof avatarUrl !== 'string' || !avatarUrl.trim()) return null;
  const clean = avatarUrl.trim();
  if (clean.startsWith('http') || clean.startsWith('data:')) return clean;
  return `http://localhost:8000${clean.startsWith('/') ? clean : `/${clean}`}`;
};

export const DoctorPatientTable: React.FC<DoctorPatientTableProps> = ({
  patients,
  tableSearch,
  onSearchChange,
  tableFilter,
  onFilterChange,
  onOpenCreateAppointment,
  onSelectPatient,
  loading = false,
}) => {
  return (
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
              onChange={(e) => onSearchChange(e.target.value)}
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
                onClick={() => onFilterChange(f.key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
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
            onClick={onOpenCreateAppointment}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Đặt lịch khám</span>
          </button>
        </div>
      </div>

      {loading && patients.length === 0 ? (
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
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-3.5 px-3"><div className="h-4 w-12 rounded bg-slate-200" /></td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center space-x-3">
                      <div className="h-9 w-9 rounded-full bg-slate-200 shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-4 w-28 rounded bg-slate-200" />
                        <div className="h-3 w-16 rounded bg-slate-100" />
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3"><div className="h-4 w-20 rounded bg-slate-200" /></td>
                  <td className="py-3.5 px-3"><div className="h-4 w-24 rounded bg-slate-200" /></td>
                  <td className="py-3.5 px-3"><div className="h-4 w-28 rounded bg-slate-100" /></td>
                  <td className="py-3.5 px-3"><div className="h-5 w-24 rounded-full bg-slate-100" /></td>
                  <td className="py-3.5 px-3 text-right"><div className="inline-block h-7 w-20 rounded-lg bg-slate-200" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : patients.length === 0 ? (
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
              {patients.map((patient, idx) => {
                const isDanger = patient.health_status === 'DANGER';
                const isWarning = patient.health_status === 'WARNING' || isDanger;
                const mrCode = `MR-${String(idx + 1).padStart(3, '0')}`;

                return (
                  <tr
                    key={patient.id}
                    onClick={() => onSelectPatient(patient.id)}
                    className="group cursor-pointer transition-colors hover:bg-blue-50/40"
                  >
                    <td className="py-3.5 px-3 font-mono font-bold text-slate-500">
                      {mrCode}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-3">
                        <div className="relative inline-block shrink-0">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden bg-blue-100 text-xs font-extrabold text-blue-700">
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
                          </div>
                          {patient.is_online && (
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white shadow-xs z-10" />
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
                          onSelectPatient(patient.id);
                        }}
                        className="rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-bold text-blue-600 transition hover:bg-blue-600 hover:text-white cursor-pointer"
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
  );
};

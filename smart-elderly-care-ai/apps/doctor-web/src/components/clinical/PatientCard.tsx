import React from 'react';
import { Home, Heart, Activity, PhoneCall, ChevronRight } from 'lucide-react';
import { DoctorPatientCard } from '../../types';
import { getPatientAvatar } from '../../utils/patientAvatar';
import { formatGender } from '../../utils/formatters';

export interface PatientCardProps {
  patient: DoctorPatientCard;
  mrCode: string;
  isDanger: boolean;
  isWarning: boolean;
  onSelect: (patientId: string) => void;
  onContactFamily: (patient: DoctorPatientCard) => void;
}

export const PatientCard: React.FC<PatientCardProps> = ({
  patient,
  mrCode,
  isDanger,
  isWarning,
  onSelect,
  onContactFamily,
}) => {
  return (
    <div
      onClick={() => onSelect(patient.id)}
      className="group flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/10 cursor-pointer dark:border-slate-800/80 dark:bg-[#131C31] dark:hover:border-slate-700"
    >
      <div>
        {/* Header thẻ: Avatar & Trạng thái phân tầng lâm sàng */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3.5">
            {/* Avatar Bệnh nhân với Status Dot không bị clip */}
            <div className="relative inline-block shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 to-cyan-500 text-base font-extrabold text-white shadow-2xs">
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
              <span
                className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-[#131C31] shadow-sm z-10 ${
                  patient.is_online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
                title={patient.is_online ? 'Smartband trực tuyến' : 'Chờ tín hiệu'}
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-600 dark:text-slate-300">
                  {mrCode}
                </span>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {patient.name}
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {patient.age} tuổi • {formatGender(patient.gender)} • Nhóm máu {patient.blood_type || 'O+'}
              </p>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
              isDanger
                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60'
                : isWarning
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/60'
                  : patient.is_online
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/60'
                    : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
            }`}
          >
            {isDanger ? 'Khẩn cấp' : isWarning ? 'Cần chú ý' : patient.is_online ? 'Ổn định' : 'Ngoại tuyến'}
          </span>
        </div>

        {/* Thông tin hộ gia đình & thiết bị */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-1.5 truncate">
            <Home className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate font-medium text-slate-700 dark:text-slate-300">{patient.house_name}</span>
          </div>
          <span
            className={`inline-flex items-center space-x-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              patient.is_online
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                patient.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span>{patient.is_online ? 'Trực tuyến' : 'Chờ tín hiệu'}</span>
          </span>
        </div>

        {/* Sinh hiệu gần nhất */}
        <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50/80 p-2.5 border border-slate-100 dark:bg-[#0F172A] dark:border-slate-800/80">
          <div className="flex items-center space-x-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <Heart className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">Nhịp tim</p>
              <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                {patient.is_online && patient.heart_rate != null ? `${patient.heart_rate} bpm` : '-- bpm'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">Nồng độ SpO2</p>
              <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                {patient.is_online && patient.spo2 != null ? `${patient.spo2}%` : '--%'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer thẻ: Nút liên hệ khẩn cấp nổi bật & Xem chi tiết */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onContactFamily(patient);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-2xs transition-all duration-200 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white hover:shadow-xs active:scale-[0.98] cursor-pointer dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white"
          title="Xem thông tin và gọi cho gia đình bệnh nhân"
        >
          <PhoneCall className="h-3.5 w-3.5 shrink-0" />
          <span>Liên hệ gia đình</span>
        </button>
        <div className="inline-flex items-center space-x-1 text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
          <span>Xem hồ sơ bệnh án</span>
          <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Home, PhoneCall, Printer, X, Watch } from 'lucide-react';
import { DoctorPatientDetail, DoctorPatientCard } from '../../types';
import { getPatientAvatar } from '../../utils/patientAvatar';
import { formatGender } from '../../utils/formatters';

interface PatientDrawerHeaderProps {
  patientDetail: DoctorPatientDetail;
  selectedPatientCard?: DoctorPatientCard;
  selectedMrCode: string;
  activeAvatar: string | null;
  activeBloodType: string;
  activeEmergencyPhone: string;
  isSelectedDanger: boolean;
  isSelectedWarning: boolean;
  onClose: () => void;
}

const CLINICAL_STATUS_CONFIG = {
  danger: {
    label: 'Khẩn cấp',
    className:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60',
  },
  warning: {
    label: 'Cần chú ý',
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/60',
  },
  stable: {
    label: 'Ổn định',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/60',
  },
  offline: {
    label: 'Ngoại tuyến',
    className:
      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
} as const;

const HEADER_ACTION_BTN_CLASS =
  'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700';

export const PatientDrawerHeader: React.FC<PatientDrawerHeaderProps> = ({
  patientDetail,
  selectedPatientCard,
  selectedMrCode,
  activeAvatar,
  activeBloodType,
  activeEmergencyPhone,
  isSelectedDanger,
  isSelectedWarning,
  onClose,
}) => {
  const isOnline = Boolean(selectedPatientCard?.is_online ?? patientDetail.is_online);
  const statusKey = isSelectedDanger ? 'danger' : isSelectedWarning ? 'warning' : isOnline ? 'stable' : 'offline';
  const clinicalStatus = CLINICAL_STATUS_CONFIG[statusKey];

  const handleCallFamily = () => {
    if (activeEmergencyPhone) {
      window.open(`tel:${activeEmergencyPhone}`);
    } else {
      alert('Chưa có số điện thoại liên hệ khẩn cấp của bệnh nhân.');
    }
  };

  return (
    <div className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#131C31] px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        {/* Thông tin định danh & Avatar Bệnh nhân */}
        <div className="flex items-start space-x-3.5 min-w-0">
          {/* Avatar tròn với Status Dot không bị clip */}
          <div className="relative inline-block shrink-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 to-cyan-500 text-lg font-extrabold text-white shadow-md ring-2 ring-white dark:ring-[#131C31]">
              {activeAvatar ? (
                <img
                  src={getPatientAvatar(activeAvatar)!}
                  alt={patientDetail.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                patientDetail.name?.charAt(0) || 'P'
              )}
            </div>
            <span
              className={`absolute bottom-0 right-0 h-4 w-4 rounded-full ring-2 ring-white dark:ring-[#131C31] shadow-sm z-10 ${isOnline ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              title={isOnline ? 'Smartband đang kết nối' : 'Chờ tín hiệu Smartband'}
            />
          </div>

          <div className="min-w-0">
            {/* Hàng nhãn mã bệnh nhân & trạng thái lâm sàng */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="rounded-md bg-blue-50 border border-blue-200/80 px-2 py-0.5 text-[10.5px] font-mono font-extrabold text-blue-700 dark:bg-blue-950/40 dark:border-blue-900/60 dark:text-blue-300">
                {selectedMrCode}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${clinicalStatus.className}`}>
                {clinicalStatus.label}
              </span>
              <span
                className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${isOnline
                    ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                    : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }`}
              >
                <Watch className="h-3 w-3" />
                <span>{isOnline ? 'Smartband Online' : 'Chờ tín hiệu'}</span>
              </span>
            </div>

            <h3 className="font-heading font-extrabold text-slate-900 dark:text-white text-lg leading-tight truncate">
              {patientDetail.name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
              {patientDetail.age || selectedPatientCard?.age} tuổi • {formatGender(patientDetail.gender || selectedPatientCard?.gender)} • Nhóm máu{' '}
              <span className="font-bold text-slate-800 dark:text-white">{activeBloodType}</span>
            </p>
            <div className="mt-1 flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
              <Home className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                {patientDetail.house_name || selectedPatientCard?.house_name || 'Nhà riêng'}
              </span>
              {selectedPatientCard?.house_address && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="truncate text-slate-500 dark:text-slate-400 text-[11px]">
                    {selectedPatientCard.house_address}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Nút tác vụ nhanh: Gọi người nhà, In hồ sơ, Đóng */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCallFamily}
            className={HEADER_ACTION_BTN_CLASS}
            title={`Gọi người nhà: ${activeEmergencyPhone || 'Chưa cập nhật'}`}
          >
            <PhoneCall className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Gọi người nhà</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className={HEADER_ACTION_BTN_CLASS}
            title="In tóm tắt bệnh án"
          >
            <Printer className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
            <span className="hidden sm:inline">In hồ sơ</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200/80 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors ml-1 cursor-pointer"
            title="Đóng hồ sơ"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

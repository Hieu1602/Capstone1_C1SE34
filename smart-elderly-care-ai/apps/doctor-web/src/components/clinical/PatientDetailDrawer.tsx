import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Edit } from 'lucide-react';
import {
  DoctorPatientDetail,
  DoctorPatientCard,
  PrescriptionItem,
  AppointmentItem,
  AnalyticsData,
} from '../../types';
import { PatientDrawerHeader } from './PatientDrawerHeader';
import { PatientDrawerOverviewTab } from './PatientDrawerOverviewTab';
import {
  DrawerTabKey,
  PatientDrawerTabBar,
  PatientDrawerVitalsTab,
  PatientDrawerPrescriptionsTab,
  PatientDrawerAppointmentsTab,
} from './PatientDrawerTabs';

export type { DrawerTabKey };

export interface PatientDetailDrawerProps {
  patientDetail: DoctorPatientDetail;
  selectedPatientCard?: DoctorPatientCard;
  selectedMrCode: string;
  prescriptions: PrescriptionItem[];
  patientAppointments: AppointmentItem[];
  analytics: AnalyticsData | null;
  isLoadingDetail?: boolean;
  isLoadingAnalytics?: boolean;
  isLoadingPrescriptions?: boolean;
  isLoadingAppointments?: boolean;
  vitalFilter?: any;
  onVitalFilterChange?: (next: any) => void;
  onTabChange?: (tab: DrawerTabKey) => void;
  onClose: () => void;
  onOpenRecordModal: () => void;
  onOpenPrescriptionModal: () => void;
  onOpenAppointmentModal: () => void;
  onThresholdsSaved?: () => void;
}

export const PatientDetailDrawer: React.FC<PatientDetailDrawerProps> = ({
  patientDetail,
  selectedPatientCard,
  selectedMrCode,
  prescriptions,
  patientAppointments,
  analytics,
  isLoadingDetail: _isLoadingDetail = false,
  isLoadingAnalytics = false,
  isLoadingPrescriptions = false,
  isLoadingAppointments = false,
  vitalFilter,
  onVitalFilterChange,
  onTabChange,
  onClose,
  onOpenRecordModal,
  onOpenPrescriptionModal,
  onOpenAppointmentModal,
  onThresholdsSaved,
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTabKey>('RECORD');

  const activeBloodType =
    patientDetail.blood_type || selectedPatientCard?.blood_type || 'O+';
  const activeAvatar =
    patientDetail.avatar_url || selectedPatientCard?.avatar_url || null;
  const activeBmi = patientDetail.bmi ? patientDetail.bmi.toFixed(1) : '—';
  const activeEmergencyPhone = selectedPatientCard?.emergency_contact_phone || '';

  const backendHealthStatus = patientDetail.health_status || selectedPatientCard?.health_status;
  const isSelectedDanger = backendHealthStatus
    ? backendHealthStatus === 'DANGER'
    : Boolean(
        selectedPatientCard?.is_online &&
          ((selectedPatientCard?.heart_rate &&
            (selectedPatientCard.heart_rate > 120 || selectedPatientCard.heart_rate < 50)) ||
            (selectedPatientCard?.spo2 && selectedPatientCard.spo2 < 90))
      );

  const isSelectedWarning = backendHealthStatus
    ? backendHealthStatus === 'WARNING'
    : Boolean(
        !isSelectedDanger &&
          selectedPatientCard?.is_online &&
          ((selectedPatientCard?.heart_rate &&
            (selectedPatientCard.heart_rate > 100 || selectedPatientCard.heart_rate < 55)) ||
            (selectedPatientCard?.spo2 && selectedPatientCard.spo2 < 95))
      );

  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  const handleSelectTab = (tab: DrawerTabKey) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return createPortal(
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] !mt-0 flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative z-[101] flex h-full w-full max-w-2xl flex-col bg-white dark:bg-[#131C31] dark:border-l dark:border-slate-800/80 shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
        {/* 1. Rich Clinical Header */}
        <PatientDrawerHeader
          patientDetail={patientDetail}
          selectedPatientCard={selectedPatientCard}
          selectedMrCode={selectedMrCode}
          activeAvatar={activeAvatar}
          activeBloodType={activeBloodType}
          activeEmergencyPhone={activeEmergencyPhone}
          isSelectedDanger={isSelectedDanger}
          isSelectedWarning={isSelectedWarning}
          onClose={onClose}
        />

        {/* 2. Modern Segmented Tab Bar */}
        <PatientDrawerTabBar
          activeTab={activeTab}
          prescriptionsCount={prescriptions.length}
          appointmentsCount={patientAppointments.length}
          onSelectTab={handleSelectTab}
        />

        {/* 3. Thân Drawer Cuộn Mượt (Scrollable Body) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'RECORD' && (
            <PatientDrawerOverviewTab
              patientDetail={patientDetail}
              activeBloodType={activeBloodType}
              activeBmi={activeBmi}
              onOpenRecordModal={onOpenRecordModal}
            />
          )}

          {activeTab === 'VITALS' && (
            <PatientDrawerVitalsTab
              patientId={patientDetail.id}
              initialHrHigh={patientDetail.hr_threshold_high}
              initialHrLow={patientDetail.hr_threshold_low}
              initialSpo2Low={patientDetail.spo2_threshold_low}
              onThresholdsSaved={onThresholdsSaved}
              analytics={analytics}
              isLoading={isLoadingAnalytics}
              vitalFilter={vitalFilter}
              onVitalFilterChange={onVitalFilterChange}
            />
          )}

          {activeTab === 'PRESCRIPTIONS' && (
            <PatientDrawerPrescriptionsTab
              prescriptions={prescriptions}
              isLoading={isLoadingPrescriptions}
              onOpenPrescriptionModal={onOpenPrescriptionModal}
            />
          )}

          {activeTab === 'APPOINTMENTS' && (
            <PatientDrawerAppointmentsTab
              appointments={patientAppointments}
              isLoading={isLoadingAppointments}
              onOpenAppointmentModal={onOpenAppointmentModal}
            />
          )}
        </div>

        {/* 6. Sticky Footer Action Bar */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 bg-white/95 dark:bg-[#131C31]/95 px-6 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">Hồ sơ điện tử (EHR)</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="text-[11px] font-medium text-slate-400">{selectedMrCode}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={onOpenRecordModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition cursor-pointer"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Cập nhật hồ sơ</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

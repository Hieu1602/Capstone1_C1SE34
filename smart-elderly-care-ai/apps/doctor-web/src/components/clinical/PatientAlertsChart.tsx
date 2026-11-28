// Biểu đồ phân loại cảnh báo y tế của 1 bệnh nhân (tab Đồ thị Sinh hiệu trong hồ sơ chi tiết).
// Dùng chung component & logic lọc với Dashboard để số liệu hai nơi luôn khớp.
import React, { useMemo } from 'react';
import { DoctorAlertsAreaChart } from '../dashboard/DoctorAlertsAreaChart';
import { useDoctorDataStore } from '../../store/useDoctorDataStore';
import { filterIncidentsByPatient } from '../../utils/incidentFilter';
import { computeAlertStats, useAlertChartPeriod } from '../../utils/alertStats';

export const PatientAlertsChart: React.FC<{ patientId: string }> = ({ patientId }) => {
  const { clinicalIncidents, patients } = useDoctorDataStore();
  const period = useAlertChartPeriod();
  const patient = patients.find((p) => p.id === patientId);

  const data = useMemo(
    () =>
      patient
        ? computeAlertStats(filterIncidentsByPatient(clinicalIncidents, patient), period.chartRange, period.chartAnchorDate)
        : computeAlertStats([], period.chartRange, period.chartAnchorDate),
    [clinicalIncidents, patient, period.chartRange, period.chartAnchorDate],
  );

  return (
    <DoctorAlertsAreaChart
      data={data}
      range={period.chartRange}
      onRangeChange={period.setChartRange}
      periodLabel={period.periodLabel}
      onPrev={period.handlePrevChart}
      onNext={period.handleNextChart}
      isNextDisabled={period.isNextDisabled}
      onResetCurrent={period.handleResetCurrentChart}
      isCurrentPeriod={period.isCurrentPeriod}
      selectedMonthStr={period.selectedMonthStr}
      onMonthSelect={period.handleMonthSelect}
      footnote="Té ngã AI tính theo camera của nhà bệnh nhân (dùng chung nếu nhà có nhiều người)."
    />
  );
};

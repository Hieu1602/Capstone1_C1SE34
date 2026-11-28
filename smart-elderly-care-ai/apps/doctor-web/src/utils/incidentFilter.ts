import type { Incident } from '../types';

/**
 * Lọc cảnh báo của 1 bệnh nhân.
 * - Thiết bị gắn bệnh nhân (vòng tay: nhịp tim, SpO2, SOS) -> khớp elderly_id.
 * - Thiết bị cấp nhà không gắn ai (camera té ngã) -> khớp house_id, tính chung cho mọi người trong nhà.
 */
export function filterIncidentsByPatient(
  incidents: Incident[],
  patient: { id: string; house_id?: string | null } | null | undefined,
): Incident[] {
  if (!patient) return incidents;
  return incidents.filter((inc) =>
    inc.elderly_id
      ? inc.elderly_id === patient.id
      : !!patient.house_id && inc.house_id === patient.house_id,
  );
}

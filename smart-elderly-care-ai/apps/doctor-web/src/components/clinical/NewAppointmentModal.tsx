// src/components/clinical/NewAppointmentModal.tsx
// Modal Tạo Lịch Khám & Tái Khám Mới cho Bác sĩ gia đình

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AppointmentItem, DoctorPatientCard } from '../../types';
import { doctorApi } from '../../services/api';
import { useDoctorDataStore } from '../../store/useDoctorDataStore';
import { Calendar, X, AlertCircle, Loader2, Volume2 } from 'lucide-react';

interface NewAppointmentModalProps {
  patients: DoctorPatientCard[];
  initialPatientId?: string;
  initialAppointment?: AppointmentItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

const inputCls = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white dark:border-slate-700/60 dark:bg-[#0F172A] dark:text-slate-100 dark:placeholder-slate-500';

const toLocalDatetimeInput = (iso?: string, isCreatePrefill = false): string => {
  const d = iso ? new Date(iso) : new Date();
  if (!iso || isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 1);
    fallback.setHours(9, 0, 0, 0);
    return toLocalDatetimeInput(fallback.toISOString(), false);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (isCreatePrefill) {
    // Tự động chọn khung giờ trống đầu tiên trong ngày nếu 09:00 đã có lịch UPCOMING
    const existing = useDoctorDataStore
      .getState()
      .appointments.filter((a) => {
        if (a.status !== 'UPCOMING' && a.status !== 'CONFIRMED') return false;
        const ad = new Date(a.scheduled_at);
        return (
          !isNaN(ad.getTime()) &&
          `${ad.getFullYear()}-${pad(ad.getMonth() + 1)}-${pad(ad.getDate())}` === ymd
        );
      })
      .map((a) => {
        const start = new Date(a.scheduled_at).getTime();
        const dur = (a.duration_minutes || 30) * 60_000;
        return [start, start + dur] as const;
      });

    const candidate = new Date(d);
    for (let step = 0; step < 24; step++) {
      const cStart = candidate.getTime();
      const cEnd = cStart + 30 * 60_000;
      const overlaps = existing.some(([s, e]) => s < cEnd && e > cStart);
      if (!overlaps) break;
      candidate.setMinutes(candidate.getMinutes() + 30);
    }
    return `${candidate.getFullYear()}-${pad(candidate.getMonth() + 1)}-${pad(candidate.getDate())}T${pad(candidate.getHours())}:${pad(candidate.getMinutes())}`;
  }

  return `${ymd}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const NewAppointmentModal: React.FC<NewAppointmentModalProps> = ({
  patients,
  initialPatientId,
  initialAppointment,
  onClose,
  onSuccess,
}) => {
  const isReschedule = Boolean(initialAppointment?.id);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [patientId, setPatientId] = useState(
    initialAppointment?.patient_id || initialPatientId || patients[0]?.id || ''
  );
  useEffect(() => {
    if (!patientId && patients.length > 0) {
      setPatientId(initialAppointment?.patient_id || initialPatientId || patients[0].id);
    }
  }, [patients, patientId, initialAppointment, initialPatientId]);

  const [visitType, setVisitType] = useState<'CLINIC' | 'HOME_VISIT' | 'TELEHEALTH'>(
    initialAppointment?.visit_type === 'HOME_VISIT' || initialAppointment?.visit_type === 'HOME'
      ? 'HOME_VISIT'
      : initialAppointment?.visit_type === 'TELEHEALTH'
        ? 'TELEHEALTH'
        : 'CLINIC'
  );
  const [scheduledAt, setScheduledAt] = useState(() =>
    toLocalDatetimeInput(initialAppointment?.scheduled_at, !isReschedule && Boolean(initialAppointment?.scheduled_at))
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(
    initialAppointment?.duration_minutes || 30
  );
  const [location, setLocation] = useState(
    initialAppointment?.location || 'Phòng khám Bác sĩ Gia đình'
  );
  const [clinicalNotes, setClinicalNotes] = useState(
    initialAppointment?.clinical_notes ?? 'Khám định kỳ & đánh giá đáp ứng phác đồ thuốc'
  );
  const [enableSpeaker, setEnableSpeaker] = useState(
    initialAppointment ? initialAppointment.enable_speaker_reminder !== false : true
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      setErrorMsg('Vui lòng chọn bệnh nhân.');
      return;
    }

    const parsedDt = new Date(scheduledAt);
    if (isNaN(parsedDt.getTime())) {
      setErrorMsg('Thời gian hẹn không hợp lệ.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const p = patients.find((item) => item.id === patientId);
      const store = useDoctorDataStore.getState();
      if (isReschedule && initialAppointment?.id) {
        const updated = await doctorApi.updateAppointment(initialAppointment.id, {
          visit_type: visitType,
          scheduled_at: parsedDt.toISOString(),
          duration_minutes: durationMinutes,
          location: location.trim(),
          clinical_notes: clinicalNotes.trim(),
          enable_speaker_reminder: enableSpeaker,
        });
        store.setAppointments(
          store.appointments
            .map((a) => (a.id === updated.id ? { ...a, ...updated, patient_name: p?.name || a.patient_name } : a))
            .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
        );
      } else {
        const created = await doctorApi.createAppointment({
          patient_id: patientId,
          patient_name: p?.name,
          house_id: p?.house_id || undefined,
          visit_type: visitType,
          scheduled_at: parsedDt.toISOString(),
          duration_minutes: durationMinutes,
          location: location.trim(),
          clinical_notes: clinicalNotes.trim(),
          enable_speaker_reminder: enableSpeaker,
        });
        store.setAppointments(
          [...store.appointments.filter((a) => a.id !== created.id), { ...created, patient_name: p?.name || created.patient_name }].sort(
            (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
          )
        );
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail ||
          (isReschedule
            ? 'Không thể dời lịch hẹn. Vui lòng kiểm tra lại.'
            : 'Không thể tạo lịch hẹn. Vui lòng kiểm tra lại.')
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] !mt-0 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative z-[101] flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl bg-white dark:bg-[#131C31] shadow-2xl border border-slate-100 dark:border-slate-800/80 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 px-6 py-4 bg-slate-50/50 dark:bg-[#131C31]">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isReschedule ? 'Dời Lịch / Cập Nhật Lịch Hẹn' : 'Lên Lịch Khám Mới'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isReschedule
                  ? 'Điều chỉnh thời gian, địa điểm và tự động đồng bộ lại nhắc nhở qua loa'
                  : 'Thiết lập cuộc hẹn và hẹn giờ nhắc nhở qua loa'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center space-x-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:border-rose-900 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Chọn bệnh nhân phụ trách *</label>
            <select
              value={patientId}
              disabled={isReschedule}
              onChange={(e) => {
                const selId = e.target.value;
                setPatientId(selId);
                const p = patients.find((item) => item.id === selId);
                if (visitType === 'HOME_VISIT' && p?.house_address) setLocation(p.house_address);
              }}
              className={`${inputCls} ${isReschedule ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id} className="dark:bg-[#0F172A] dark:text-slate-100">
                  {p.name} ({p.age} tuổi) — {p.house_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Hình thức thăm khám *</label>
              <select
                value={visitType}
                onChange={(e) => {
                  const vt = e.target.value as 'CLINIC' | 'HOME_VISIT' | 'TELEHEALTH';
                  setVisitType(vt);
                  if (vt === 'CLINIC') {
                    setLocation('Phòng khám Bác sĩ Gia đình');
                  } else if (vt === 'TELEHEALTH') {
                    setLocation('Tư vấn trực tuyến (Telehealth)');
                  } else {
                    const p = patients.find((item) => item.id === patientId);
                    setLocation(p?.house_address || p?.house_name || 'Tại nhà riêng bệnh nhân');
                  }
                }}
                className={inputCls}
              >
                <option value="CLINIC" className="dark:bg-[#0F172A] dark:text-slate-100">Khám tại Phòng khám</option>
                <option value="HOME_VISIT" className="dark:bg-[#0F172A] dark:text-slate-100">Thăm khám Tại nhà</option>
                <option value="TELEHEALTH" className="dark:bg-[#0F172A] dark:text-slate-100">Tư vấn Từ xa (Telehealth)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Thời gian hẹn *</label>
              <div className="flex gap-2">
                <input type="datetime-local" required value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={inputCls} />
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  aria-label="Thời lượng khám"
                  className="w-24 shrink-0 rounded-xl border border-slate-200 px-2 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white dark:border-slate-700/60 dark:bg-[#0F172A] dark:text-slate-100"
                >
                  <option value={15}>15 phút</option>
                  <option value={30}>30 phút</option>
                  <option value={45}>45 phút</option>
                  <option value={60}>60 phút</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Địa điểm khám *</label>
            <input type="text" required value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Dặn dò & Ghi chú y tế</label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="VD: Nhịn ăn sáng nếu xét nghiệm đường huyết, mang theo sổ theo dõi..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-blue-500 focus:outline-hidden bg-white dark:border-slate-700/60 dark:bg-[#0F172A] dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>

          <div className="flex items-start space-x-2.5 rounded-2xl border border-blue-100 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/30 p-3.5">
            <Volume2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSpeaker}
                  onChange={(e) => setEnableSpeaker(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>Tự động phát loa nhắc người cao tuổi trước 24h & 2h</span>
              </label>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Hub Orange Pi sẽ phát loa giọng nói tiếng Việt tại nhà để nhắc cụ và gia đình chuẩn bị đón tiếp bác sĩ.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isReschedule ? 'Lưu thay đổi lịch hẹn' : 'Tạo lịch hẹn & Gửi thông báo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

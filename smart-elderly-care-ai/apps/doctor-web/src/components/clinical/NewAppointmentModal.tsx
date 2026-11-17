// src/components/clinical/NewAppointmentModal.tsx
// Modal Tạo Lịch Khám & Tái Khám Mới cho Bác sĩ gia đình

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DoctorPatientCard } from '../../types';
import { doctorApi } from '../../services/api';
import { Calendar, X, AlertCircle, Loader2, Volume2 } from 'lucide-react';

interface NewAppointmentModalProps {
  patients: DoctorPatientCard[];
  initialPatientId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const inputCls = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white';

export const NewAppointmentModal: React.FC<NewAppointmentModalProps> = ({
  patients,
  initialPatientId,
  onClose,
  onSuccess,
}) => {
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [patientId, setPatientId] = useState(initialPatientId || patients[0]?.id || '');
  const [visitType, setVisitType] = useState<'CLINIC' | 'HOME_VISIT'>('CLINIC');
  const [scheduledAt, setScheduledAt] = useState(() => {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    tmr.setHours(9, 0, 0, 0);
    return tmr.toISOString().slice(0, 16);
  });
  const [location, setLocation] = useState('Phòng khám Bác sĩ Gia đình');
  const [clinicalNotes, setClinicalNotes] = useState('Khám định kỳ & đánh giá đáp ứng phác đồ thuốc');
  const [enableSpeaker, setEnableSpeaker] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      setErrorMsg('Vui lòng chọn bệnh nhân.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const p = patients.find((item) => item.id === patientId);
      await doctorApi.createAppointment({
        patient_id: patientId,
        patient_name: p?.name,
        house_id: p?.house_id || undefined,
        visit_type: visitType,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: 30,
        location: location.trim(),
        clinical_notes: clinicalNotes.trim(),
        enable_speaker_reminder: enableSpeaker,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Không thể tạo lịch hẹn. Vui lòng kiểm tra lại.');
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
      <div className="relative z-[101] flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Lên Lịch Khám Mới</h3>
              <p className="text-xs text-slate-500">Thiết lập cuộc hẹn và hẹn giờ nhắc nhở qua loa</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center space-x-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Chọn bệnh nhân phụ trách *</label>
            <select
              value={patientId}
              onChange={(e) => {
                const selId = e.target.value;
                setPatientId(selId);
                const p = patients.find((item) => item.id === selId);
                if (visitType === 'HOME_VISIT' && p?.house_address) setLocation(p.house_address);
              }}
              className={inputCls}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.age} tuổi) — {p.house_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hình thức thăm khám *</label>
              <select
                value={visitType}
                onChange={(e) => {
                  const vt = e.target.value as 'CLINIC' | 'HOME_VISIT';
                  setVisitType(vt);
                  if (vt === 'CLINIC') {
                    setLocation('Phòng khám Bác sĩ Gia đình');
                  } else {
                    const p = patients.find((item) => item.id === patientId);
                    setLocation(p?.house_address || p?.house_name || 'Tại nhà riêng bệnh nhân');
                  }
                }}
                className={inputCls}
              >
                <option value="CLINIC">Khám tại Phòng khám</option>
                <option value="HOME_VISIT">Thăm khám Tại nhà</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Thời gian hẹn *</label>
              <input type="datetime-local" required value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Địa điểm khám *</label>
            <input type="text" required value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Dặn dò & Ghi chú y tế</label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="VD: Nhịn ăn sáng nếu xét nghiệm đường huyết, mang theo sổ theo dõi..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
            />
          </div>

          <div className="flex items-start space-x-2.5 rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5">
            <Volume2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSpeaker}
                  onChange={(e) => setEnableSpeaker(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>Tự động phát loa nhắc người cao tuổi trước 24h & 2h</span>
              </label>
              <p className="mt-1 text-[11px] text-slate-500">
                Hub Orange Pi sẽ phát loa giọng nói tiếng Việt tại nhà để nhắc cụ và gia đình chuẩn bị đón tiếp bác sĩ.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Tạo lịch hẹn & Gửi thông báo</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

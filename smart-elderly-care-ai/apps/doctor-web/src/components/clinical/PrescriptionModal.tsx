// src/components/clinical/PrescriptionModal.tsx
// Modal Quản lý Đơn thuốc & Cấu hình Loa thông minh nhắc nhở (đồng bộ 100% với Mobile App)

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PrescriptionItem } from '../../types';
import { doctorApi } from '../../services/api';
import { getTodayYMD, parseYMD, formatYMD } from '../../utils/dateFilter';
import {
  Pill,
  Plus,
  Trash2,
  Volume2,
  X,
  Clock,
  AlertCircle,
  Loader2,
  Sun,
  CloudSun,
  Sunset,
  Moon,
  AlarmClock,
  Calendar,
} from 'lucide-react';

interface PrescriptionModalProps {
  patientId: string;
  patientName: string;
  prescriptions: PrescriptionItem[];
  onClose: () => void;
  onRefresh: () => void;
}

interface MedicationDraft {
  id: string;
  medication_name: string;
  quantity: string;
  dosage: string;
  frequency: string;
  schedule_times: string[];
  instructions: string;
}

const PRESET_TIMES = [
  { time: '08:00', label: 'Sáng 08:00', Icon: Sun },
  { time: '12:00', label: 'Trưa 12:00', Icon: CloudSun },
  { time: '17:30', label: 'Chiều 17:30', Icon: Sunset },
  { time: '20:00', label: 'Tối 20:00', Icon: Moon },
] as const;

const createEmptyMed = (): MedicationDraft => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  medication_name: '',
  quantity: '30 viên',
  dosage: '1 viên/lần',
  frequency: 'Hàng ngày',
  schedule_times: ['08:00'],
  instructions: 'Uống sau ăn 15 phút',
});

const addDays = (baseDateStr: string, days: number): string => {
  try {
    const d = parseYMD(baseDateStr);
    d.setDate(d.getDate() + days);
    return formatYMD(d);
  } catch {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return formatYMD(d);
  }
};

const inputCls =
  'w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white dark:border-slate-700/60 dark:bg-[#0F172A] dark:text-slate-100 dark:placeholder-slate-500';

export const PrescriptionModal: React.FC<PrescriptionModalProps> = ({
  patientId,
  patientName,
  prescriptions,
  onClose,
  onRefresh,
}) => {
  const [showAddForm, setShowAddForm] = useState(prescriptions.length === 0);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Đồng bộ các trường giống Mobile App (Kê Đơn Thuốc Mới)
  const [diagnosis, setDiagnosis] = useState('Đơn thuốc điều trị');
  const [generalNotes, setGeneralNotes] = useState('');
  const [startDate, setStartDate] = useState(() => getTodayYMD());
  const [endDate, setEndDate] = useState(() => addDays(getTodayYMD(), 7));
  const [medications, setMedications] = useState<MedicationDraft[]>(() => [createEmptyMed()]);
  const [enableSpeaker, setEnableSpeaker] = useState(true);
  const [customTimeTargetId, setCustomTimeTargetId] = useState<string | null>(null);
  const [customTimeInput, setCustomTimeInput] = useState('');

  const handleSetDuration = (days: number) => {
    const base = startDate || getTodayYMD();
    setEndDate(addDays(base, days));
  };

  const updateMed = (id: string, patch: Partial<MedicationDraft>) => {
    setMedications((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const toggleMedTime = (id: string, time: string) => {
    setMedications((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const exists = m.schedule_times.includes(time);
        const nextTimes = exists
          ? m.schedule_times.filter((t) => t !== time)
          : [...m.schedule_times, time].sort();
        return { ...m, schedule_times: nextTimes };
      })
    );
  };

  const handleAddCustomTime = (id: string) => {
    const clean = customTimeInput.trim();
    if (!/^\d{1,2}:\d{2}$/.test(clean)) {
      setErrorMsg('Giờ uống thuốc không hợp lệ. Vui lòng nhập theo định dạng HH:mm (VD: 09:30).');
      return;
    }
    const [h, m] = clean.split(':').map(Number);
    if (h > 23 || m > 59) {
      setErrorMsg('Giờ phải từ 00:00 đến 23:59.');
      return;
    }
    const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setMedications((prev) =>
      prev.map((item) =>
        item.id === id && !item.schedule_times.includes(formatted)
          ? { ...item, schedule_times: [...item.schedule_times, formatted].sort() }
          : item
      )
    );
    setErrorMsg(null);
    setCustomTimeInput('');
    setCustomTimeTargetId(null);
  };

  const handleAddPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (startDate && endDate && endDate < startDate) {
      setErrorMsg('Ngày kết thúc đợt thuốc phải lớn hơn hoặc bằng ngày bắt đầu.');
      return;
    }

    const invalid = medications.find(
      (m) => !m.medication_name.trim() || !m.quantity.trim() || !m.dosage.trim()
    );
    if (invalid) {
      setErrorMsg('Vui lòng nhập đầy đủ Tên thuốc, Số lượng và Liều dùng cho tất cả thuốc.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await doctorApi.createBatchPrescriptions(patientId, {
        diagnosis: diagnosis.trim() || 'Đơn thuốc điều trị',
        general_notes: generalNotes.trim() || undefined,
        enable_speaker_reminder: enableSpeaker,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        medications: medications.map((m) => ({
          medication_name: m.medication_name.trim(),
          quantity: m.quantity.trim(),
          dosage: m.dosage.trim(),
          frequency: m.frequency.trim() || 'Hàng ngày',
          schedule_times: m.schedule_times.length > 0 ? m.schedule_times : ['08:00'],
          instructions: m.instructions.trim() || 'Theo chỉ định của Bác sĩ',
        })),
      });

      const freshToday = getTodayYMD();
      setDiagnosis('Đơn thuốc điều trị');
      setGeneralNotes('');
      setStartDate(freshToday);
      setEndDate(addDays(freshToday, 7));
      setMedications([createEmptyMed()]);
      setShowAddForm(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Không thể lưu đơn thuốc. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rxId: string) => {
    if (!confirm('Bác sĩ có chắc muốn ngừng đơn thuốc này không?')) return;
    try {
      await doctorApi.deletePrescription(patientId, rxId);
      onRefresh();
    } catch {
      alert('Không thể xóa đơn thuốc.');
    }
  };

  const handleToggleReminder = async (rxId: string) => {
    try {
      await doctorApi.togglePrescriptionReminder(patientId, rxId);
      onRefresh();
    } catch {
      alert('Không thể đổi trạng thái nhắc loa.');
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
      <div className="relative z-[101] flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white dark:bg-[#131C31] shadow-2xl border border-slate-100 dark:border-slate-800/80 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 px-6 py-4 bg-slate-50/50 dark:bg-[#131C31]">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Pill className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Phác đồ Đơn thuốc Điều trị</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bệnh nhân: <span className="font-semibold text-slate-700 dark:text-slate-200">{patientName}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="flex items-center space-x-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:border-rose-900 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-start space-x-3 rounded-2xl border border-blue-100 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/30 p-4">
            <Volume2 className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="text-blue-900 dark:text-blue-300">Tự động phát loa Hub tiếng Việt:</strong> Mọi thuốc được bật nhắc nhở sẽ tự động được đồng bộ xuống loa thông minh Orange Pi tại nhà bệnh nhân để đọc to tên thuốc và liều dùng vào đúng giờ hẹn.
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Thuốc đang sử dụng ({prescriptions.length})
              </h4>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Kê thêm thuốc</span>
                </button>
              )}
            </div>

            {prescriptions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/80 p-8 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-[#0F172A]/50">
                Chưa có đơn thuốc nào được ghi nhận cho bệnh nhân này.
              </div>
            ) : (
              <div className="space-y-2.5">
                {prescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white dark:bg-[#0F172A] dark:border-slate-800/80 p-3.5 shadow-xs transition-colors hover:border-blue-200 dark:hover:border-slate-700"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{rx.medication_name}</span>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{rx.dosage}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{rx.frequency} • {rx.instructions || 'Theo chỉ định của Bác sĩ'}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>Giờ uống: {rx.schedule_times?.join(', ') || 'Chưa đặt'}</span>
                        </div>
                        {(rx.start_date || rx.end_date) && (
                          <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 font-medium">
                            <Calendar className="h-3 w-3" />
                            <span>
                              Đợt dùng: {rx.start_date || '...'} → {rx.end_date || '...'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleToggleReminder(rx.id)}
                        className={`flex items-center space-x-1 rounded-xl px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                          rx.enable_speaker_reminder ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                        title="Bật/Tắt phát loa Hub"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        <span>{rx.enable_speaker_reminder ? 'Nhắc loa: Bật' : 'Nhắc loa: Tắt'}</span>
                      </button>
                      <button
                        onClick={() => handleDelete(rx.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        title="Ngừng đơn thuốc này"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showAddForm && (
            <form
              onSubmit={handleAddPrescription}
              className="rounded-2xl border border-blue-200/90 bg-slate-50/70 dark:border-blue-900/60 dark:bg-[#0F172A]/80 p-5 space-y-4 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <h5 className="text-sm font-bold text-slate-900 dark:text-white">Kê Đơn Thuốc Mới</h5>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  Hủy
                </button>
              </div>

              {/* Chẩn đoán & Lời dặn dò chung */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Chẩn đoán / Tên đợt khám
                  </label>
                  <input
                    type="text"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="Đơn thuốc điều trị"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Lời dặn dò chung của Bác sĩ
                  </label>
                  <input
                    type="text"
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    placeholder="VD: Ăn nhạt, uống nhiều nước, tập thể dục nhẹ..."
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Thời gian đợt điều trị (Ngày bắt đầu & Ngày kết thúc) */}
              <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#131C31] p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span>Thời gian đợt dùng thuốc</span>
                  </div>
                  {/* Nút chọn nhanh thời hạn */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 mr-1 hidden sm:inline">Thời hạn nhanh:</span>
                    {[
                      { label: '+7 ngày', days: 7 },
                      { label: '+14 ngày', days: 14 },
                      { label: '+30 ngày', days: 30 },
                    ].map((pill) => (
                      <button
                        key={pill.days}
                        type="button"
                        onClick={() => handleSetDuration(pill.days)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300 transition-colors cursor-pointer"
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Ngày bắt đầu (*)
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Ngày kết thúc (*)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* Danh mục thuốc kê đơn */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Danh mục thuốc kê đơn ({medications.length})
                  </span>
                </div>

                {medications.map((med, idx) => (
                  <div
                    key={med.id}
                    className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#131C31] p-4 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center rounded-lg bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                        Thuốc #{idx + 1}
                      </span>
                      {medications.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setMedications((prev) => prev.filter((item) => item.id !== med.id))}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Xóa thuốc</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Tên thuốc (*)
                        </label>
                        <input
                          type="text"
                          required
                          value={med.medication_name}
                          onChange={(e) => updateMed(med.id, { medication_name: e.target.value })}
                          placeholder="VD: Amlodipine 5mg"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Số lượng (*)
                        </label>
                        <input
                          type="text"
                          required
                          value={med.quantity}
                          onChange={(e) => updateMed(med.id, { quantity: e.target.value })}
                          placeholder="VD: 30 viên"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Liều dùng (*)
                        </label>
                        <input
                          type="text"
                          required
                          value={med.dosage}
                          onChange={(e) => updateMed(med.id, { dosage: e.target.value })}
                          placeholder="VD: 1 viên/lần"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Tần suất
                        </label>
                        <input
                          type="text"
                          value={med.frequency}
                          onChange={(e) => updateMed(med.id, { frequency: e.target.value })}
                          placeholder="VD: Hàng ngày"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    {/* Giờ uống thuốc bằng nút chọn nhanh giống Mobile */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Giờ uống thuốc
                        </label>
                        <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400">
                          Đã chọn {med.schedule_times.length} cữ
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {PRESET_TIMES.map(({ time, label, Icon }) => {
                          const active = med.schedule_times.includes(time);
                          return (
                            <button
                              key={time}
                              type="button"
                              onClick={() => toggleMedTime(med.id, time)}
                              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                                active
                                  ? 'border-sky-600 bg-sky-600 text-white shadow-xs'
                                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              <span>{label}</span>
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => {
                            setCustomTimeTargetId(customTimeTargetId === med.id ? null : med.id);
                            setCustomTimeInput('');
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-dashed border-sky-400 bg-sky-50/50 px-3 py-1.5 text-xs font-bold text-sky-600 hover:bg-sky-50 dark:bg-sky-950/30 dark:text-sky-400 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Giờ khác</span>
                        </button>
                      </div>

                      {customTimeTargetId === med.id && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={customTimeInput}
                            onChange={(e) => setCustomTimeInput(e.target.value)}
                            placeholder="HH:mm (VD: 14:30)"
                            className="w-40 rounded-xl border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-[#0F172A] dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddCustomTime(med.id)}
                            className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 cursor-pointer"
                          >
                            Thêm
                          </button>
                        </div>
                      )}

                      {med.schedule_times.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {med.schedule_times.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300"
                            >
                              <AlarmClock className="h-3.5 w-3.5" />
                              <span>{t}</span>
                              <button
                                type="button"
                                onClick={() => toggleMedTime(med.id, t)}
                                className="rounded-full text-rose-500 hover:text-rose-600 cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Dặn dò cách uống
                      </label>
                      <input
                        type="text"
                        value={med.instructions}
                        onChange={(e) => updateMed(med.id, { instructions: e.target.value })}
                        placeholder="VD: Uống sau ăn 15 phút"
                        className={inputCls}
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setMedications((prev) => [...prev, createEmptyMed()])}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-sky-500 bg-white dark:bg-[#131C31] py-2.5 text-xs font-bold text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/30 transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Thêm loại thuốc vào đơn</span>
                </button>
              </div>

              {/* Toggle Nhắc nhở qua Loa Hub AI */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#131C31] px-4 py-3">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Nhắc nhở qua Loa Hub AI</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Tự động phát lời nhắc uống thuốc cho bệnh nhân
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableSpeaker((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    enableSpeaker ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                      enableSpeaker ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Lưu Đơn Thuốc ({medications.length} loại)</span>
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800/80 px-6 py-3.5 bg-slate-50/50 dark:bg-[#131C31] flex justify-end">
          <button onClick={onClose} className="rounded-xl bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer">
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

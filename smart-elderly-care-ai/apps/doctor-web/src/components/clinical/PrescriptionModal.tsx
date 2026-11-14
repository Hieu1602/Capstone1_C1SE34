// src/components/clinical/PrescriptionModal.tsx
// Modal Quản lý Đơn thuốc & Cấu hình Loa thông minh nhắc nhở

import React, { useState } from 'react';
import { PrescriptionItem } from '../../types';
import { doctorApi } from '../../services/api';
import { Pill, Plus, Trash2, Volume2, X, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface PrescriptionModalProps {
  patientId: string;
  patientName: string;
  prescriptions: PrescriptionItem[];
  onClose: () => void;
  onRefresh: () => void;
}

export const PrescriptionModal: React.FC<PrescriptionModalProps> = ({
  patientId,
  patientName,
  prescriptions,
  onClose,
  onRefresh,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('2 lần/ngày');
  const [scheduleTimes, setScheduleTimes] = useState('08:00, 18:00');
  const [instructions, setInstructions] = useState('Uống sau bữa ăn với nước ấm');
  const [enableSpeaker, setEnableSpeaker] = useState(true);

  const handleAddPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim() || !dosage.trim()) {
      setErrorMsg('Vui lòng nhập tên thuốc và liều lượng.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const timesArray = scheduleTimes
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await doctorApi.createPrescription(patientId, {
        medication_name: medName.trim(),
        dosage: dosage.trim(),
        frequency: frequency.trim(),
        schedule_times: timesArray.length > 0 ? timesArray : ['08:00', '18:00'],
        instructions: instructions.trim(),
        enable_speaker_reminder: enableSpeaker,
      });

      // Reset form
      setMedName('');
      setDosage('');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Pill className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Phác đồ Đơn thuốc Điều trị</h3>
              <p className="text-xs text-slate-500">Bệnh nhân: <span className="font-semibold text-slate-700">{patientName}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="flex items-center space-x-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Banner Loa thông minh */}
          <div className="flex items-start space-x-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <Volume2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <strong className="text-blue-900">Tự động phát loa Hub tiếng Việt:</strong> Mọi thuốc được bật nhắc nhở sẽ tự động được đồng bộ xuống loa thông minh Orange Pi tại nhà bệnh nhân để đọc to tên thuốc và liều dùng vào đúng giờ hẹn.
            </div>
          </div>

          {/* Danh sách đơn thuốc hiện tại */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Thuốc đang sử dụng ({prescriptions.length})
              </h4>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Kê thêm thuốc</span>
                </button>
              )}
            </div>

            {prescriptions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                Chưa có đơn thuốc nào được ghi nhận cho bệnh nhân này.
              </div>
            ) : (
              <div className="space-y-2.5">
                {prescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition-colors hover:border-blue-200"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {rx.medication_name}
                        </span>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          {rx.dosage}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {rx.frequency} • {rx.instructions || 'Theo chỉ định của Bác sĩ'}
                      </p>
                      <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        <span>Giờ uống: {rx.schedule_times?.join(', ') || 'Chưa đặt'}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {/* Nút bật/tắt nhắc nhở loa */}
                      <button
                        onClick={() => handleToggleReminder(rx.id)}
                        className={`flex items-center space-x-1 rounded-xl px-2.5 py-1 text-xs font-medium transition-colors ${
                          rx.enable_speaker_reminder
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                        title="Bật/Tắt phát loa Hub"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        <span>{rx.enable_speaker_reminder ? 'Nhắc loa: Bật' : 'Nhắc loa: Tắt'}</span>
                      </button>

                      {/* Nút ngừng thuốc */}
                      <button
                        onClick={() => handleDelete(rx.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
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

          {/* Form kê thuốc mới */}
          {showAddForm && (
            <form onSubmit={handleAddPrescription} className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                <h5 className="text-xs font-bold text-blue-900">Kê toa thuốc mới</h5>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Hủy
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tên thuốc *</label>
                  <input
                    type="text"
                    required
                    value={medName}
                    onChange={(e) => setMedName(e.target.value)}
                    placeholder="VD: Amlodipine, Metformin..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Liều lượng *</label>
                  <input
                    type="text"
                    required
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="VD: 1 viên 5mg"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tần suất uống</label>
                  <input
                    type="text"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    placeholder="VD: 2 lần/ngày"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Giờ phát loa nhắc (cách nhau dấu phẩy)</label>
                  <input
                    type="text"
                    value={scheduleTimes}
                    onChange={(e) => setScheduleTimes(e.target.value)}
                    placeholder="VD: 08:00, 18:00"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Hướng dẫn dặn dò người cao tuổi</label>
                <input
                  type="text"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="VD: Uống sau bữa ăn với nước ấm, không nhai..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="speakerCheckbox"
                  checked={enableSpeaker}
                  onChange={(e) => setEnableSpeaker(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <label htmlFor="speakerCheckbox" className="text-xs text-slate-700 cursor-pointer">
                  Bật tính năng nhắc nhở giọng nói tự động qua loa thông minh Orange Pi
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Lưu & Đồng bộ đơn thuốc</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 px-6 py-3.5 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};


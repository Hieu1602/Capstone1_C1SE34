// src/components/clinical/MedicalRecordModal.tsx
// Modal Cập nhật Hồ sơ Bệnh án, Thể trạng, Dị ứng & Dặn dò y khoa

import React, { useState } from 'react';
import { DoctorPatientDetail } from '../../types';
import { doctorApi } from '../../services/api';
import { FileText, X, AlertCircle, Loader2, Save } from 'lucide-react';

interface MedicalRecordModalProps {
  patient: DoctorPatientDetail;
  onClose: () => void;
  onRefresh: () => void;
}

export const MedicalRecordModal: React.FC<MedicalRecordModalProps> = ({
  patient,
  onClose,
  onRefresh,
}) => {
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [bloodType, setBloodType] = useState(patient.blood_type || 'O+');
  const [bmi, setBmi] = useState(patient.bmi ? String(patient.bmi) : '22.0');
  const [bloodPressure, setBloodPressure] = useState(patient.blood_pressure || '120/80');
  const [drugAllergies, setDrugAllergies] = useState(patient.drug_allergies || 'Không ghi nhận');
  const [foodAllergies, setFoodAllergies] = useState(patient.food_allergies || 'Không');
  const [dietaryNotes, setDietaryNotes] = useState(patient.dietary_notes || 'Ăn giảm muối, hạn chế đường tinh luyện');
  const [doctorNotes, setDoctorNotes] = useState(patient.doctor_notes || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      await doctorApi.updateMedicalRecord(patient.id, {
        blood_type: bloodType,
        bmi: parseFloat(bmi) || undefined,
        blood_pressure: bloodPressure,
        drug_allergies: drugAllergies,
        food_allergies: foodAllergies,
        dietary_notes: dietaryNotes,
        doctor_notes: doctorNotes,
      });

      onRefresh();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Không thể cập nhật hồ sơ bệnh án.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Cập nhật Hồ Sơ Bệnh Án</h3>
              <p className="text-xs text-slate-500">Bệnh nhân: <span className="font-semibold text-slate-700">{patient.name}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center space-x-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nhóm máu</label>
              <select
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Chỉ số BMI</label>
              <input
                type="number"
                step="0.1"
                value={bmi}
                onChange={(e) => setBmi(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Huyết áp chuẩn (mmHg)</label>
              <input
                type="text"
                value={bloodPressure}
                onChange={(e) => setBloodPressure(e.target.value)}
                placeholder="120/80"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dị ứng thuốc</label>
              <input
                type="text"
                value={drugAllergies}
                onChange={(e) => setDrugAllergies(e.target.value)}
                placeholder="VD: Dị ứng Penicillin, Aspirin..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dị ứng thực phẩm</label>
              <input
                type="text"
                value={foodAllergies}
                onChange={(e) => setFoodAllergies(e.target.value)}
                placeholder="VD: Hải sản, đậu phộng..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Chế độ dinh dưỡng khuyến nghị</label>
            <input
              type="text"
              value={dietaryNotes}
              onChange={(e) => setDietaryNotes(e.target.value)}
              placeholder="VD: Giảm tinh bột, tăng cường rau xanh và bổ sung nước đều đặn"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Dặn dò & Ghi chú Bác sĩ phụ trách</label>
            <textarea
              rows={3}
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value)}
              placeholder="Ghi chú lâm sàng, phác đồ theo dõi tuần, dặn dò người nhà..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-blue-500 focus:outline-hidden bg-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Lưu hồ sơ bệnh án</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


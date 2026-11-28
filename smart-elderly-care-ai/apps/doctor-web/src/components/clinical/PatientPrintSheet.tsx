// Phiếu tóm tắt hồ sơ bệnh án dành riêng cho bản in.
// Ẩn trên màn hình; khi in, CSS @media print (index.css) chỉ hiện #patient-print-root và ẩn toàn bộ giao diện.
import React from 'react';
import { createPortal } from 'react-dom';
import { DoctorPatientDetail, PrescriptionItem, AppointmentItem } from '../../types';
import { useDoctorAuthStore } from '../../store/useDoctorAuthStore';

interface PatientPrintSheetProps {
  patientDetail: DoctorPatientDetail;
  mrCode: string;
  bloodType: string;
  bmi: string;
  emergencyPhone?: string;
  prescriptions: PrescriptionItem[];
  appointments: AppointmentItem[];
}

const EMPTY = 'Chưa ghi nhận';

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
};

const fmtDateTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? '—'
    : `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN')}`;
};

const VISIT_TYPE_LABEL: Record<string, string> = {
  CLINIC: 'Tại phòng khám',
  HOME: 'Tại nhà',
  HOME_VISIT: 'Tại nhà',
  TELEHEALTH: 'Khám từ xa',
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mt-4 break-inside-avoid">
    <h2 className="mb-1.5 border-b border-black pb-0.5 text-[11pt] font-bold uppercase">{title}</h2>
    {children}
  </section>
);

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex gap-2 py-0.5">
    <span className="w-40 shrink-0 text-gray-700">{label}:</span>
    <span className="font-medium">{value || EMPTY}</span>
  </div>
);

export const PatientPrintSheet: React.FC<PatientPrintSheetProps> = ({
  patientDetail: p,
  mrCode,
  bloodType,
  bmi,
  emergencyPhone,
  prescriptions,
  appointments,
}) => {
  const doctor = useDoctorAuthStore((s) => s.user);
  const now = new Date();
  const upcoming = appointments
    .filter((a) => (a.status === 'UPCOMING' || a.status === 'CONFIRMED') && new Date(a.scheduled_at) >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 5);
  const address = [p.house_name, p.house_address].filter(Boolean).join(' – ');
  const cell = 'border border-gray-500 px-1.5 py-1 align-top';

  return createPortal(
    <div id="patient-print-root" className="hidden print:block bg-white text-black text-[10pt] leading-snug font-sans">
      {/* Tiêu đề phiếu */}
      <header className="flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <div className="text-[9pt] font-bold uppercase">Smart Elderly Care AI</div>
          <div className="text-[9pt]">{doctor?.workplace || 'Cổng Y tế Bác sĩ Gia đình'}</div>
        </div>
        <div className="text-right text-[9pt]">
          <div>
            Mã hồ sơ: <b>{mrCode}</b>
          </div>
          <div>Ngày in: {fmtDateTime(now.toISOString())}</div>
        </div>
      </header>
      <h1 className="mt-3 text-center text-[15pt] font-bold uppercase">Phiếu tóm tắt hồ sơ bệnh án</h1>

      <Section title="I. Thông tin hành chính">
        <div className="grid grid-cols-2 gap-x-6">
          <Row label="Họ và tên" value={<span className="uppercase">{p.name}</span>} />
          <Row label="Tuổi / Giới tính" value={[p.age ? `${p.age} tuổi` : '', p.gender].filter(Boolean).join(' – ')} />
          <Row label="Nhóm máu" value={bloodType} />
          <Row label="Chỉ số BMI" value={bmi !== '—' ? bmi : ''} />
          <Row label="SĐT người nhà" value={emergencyPhone} />
        </div>
        <Row label="Địa chỉ" value={address} />
      </Section>

      <Section title="II. Sinh hiệu gần nhất & ngưỡng cảnh báo">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className={`${cell} text-left`}>Chỉ số</th>
              <th className={`${cell} text-left`}>Giá trị gần nhất</th>
              <th className={`${cell} text-left`}>Ngưỡng cảnh báo cá nhân</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={cell}>Nhịp tim</td>
              <td className={cell}>{p.heart_rate ? `${p.heart_rate} bpm` : '—'}</td>
              <td className={cell}>
                {p.hr_threshold_low ?? 50} – {p.hr_threshold_high ?? 120} bpm
              </td>
            </tr>
            <tr>
              <td className={cell}>SpO₂</td>
              <td className={cell}>{p.spo2 ? `${p.spo2}%` : '—'}</td>
              <td className={cell}>Tối thiểu {p.spo2_threshold_low ?? 90}%</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="III. Bệnh lý & tiền sử">
        {p.conditions && p.conditions.length > 0 ? (
          <ul className="list-disc pl-5">
            {p.conditions.map((c) => (
              <li key={c.id}>
                <b>{c.name}</b>
                {c.note ? ` – ${c.note}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p>{EMPTY}</p>
        )}
      </Section>

      <Section title="IV. Dị ứng & dinh dưỡng">
        <Row label="Dị ứng thuốc" value={p.drug_allergies?.trim() && <b>{p.drug_allergies}</b>} />
        <Row label="Dị ứng thực phẩm" value={p.food_allergies?.trim()} />
        <Row label="Chế độ dinh dưỡng" value={p.dietary_notes?.trim()} />
      </Section>

      <Section title={`V. Đơn thuốc đang điều trị (${prescriptions.length})`}>
        {prescriptions.length > 0 ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className={`${cell} w-6`}>#</th>
                <th className={`${cell} text-left`}>Tên thuốc</th>
                <th className={`${cell} text-left`}>Liều / Tần suất</th>
                <th className={`${cell} text-left`}>Giờ uống</th>
                <th className={`${cell} text-left`}>Hướng dẫn</th>
                <th className={`${cell} text-left`}>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.map((rx, i) => (
                <tr key={rx.id} className="break-inside-avoid">
                  <td className={`${cell} text-center`}>{i + 1}</td>
                  <td className={cell}>
                    <b>{rx.medication_name}</b>
                    {rx.diagnosis && <div className="text-[9pt] text-gray-700">Chẩn đoán: {rx.diagnosis}</div>}
                  </td>
                  <td className={cell}>
                    {rx.dosage}
                    {rx.frequency ? ` – ${rx.frequency}` : ''}
                  </td>
                  <td className={cell}>{(rx.schedule_times || []).join(', ') || '—'}</td>
                  <td className={cell}>{rx.instructions || '—'}</td>
                  <td className={cell}>
                    {fmtDate(rx.start_date)} → {fmtDate(rx.end_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Không có đơn thuốc đang điều trị.</p>
        )}
      </Section>

      <Section title="VI. Lịch khám sắp tới">
        {upcoming.length > 0 ? (
          <ul className="list-disc pl-5">
            {upcoming.map((a) => (
              <li key={a.id}>
                <b>{fmtDateTime(a.scheduled_at)}</b>
                {' – '}
                {a.exam_type || 'Khám định kỳ'}
                {a.visit_type ? ` (${VISIT_TYPE_LABEL[a.visit_type] || a.visit_type})` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p>Không có lịch khám sắp tới.</p>
        )}
      </Section>

      <Section title="VII. Dặn dò của bác sĩ">
        <p className="whitespace-pre-line">{p.doctor_notes?.trim() || EMPTY}</p>
      </Section>

      {/* Chữ ký */}
      <div className="mt-8 flex justify-end break-inside-avoid">
        <div className="w-64 text-center">
          <div className="italic">Ngày {now.getDate()} tháng {now.getMonth() + 1} năm {now.getFullYear()}</div>
          <div className="mt-1 font-bold uppercase">Bác sĩ phụ trách</div>
          <div className="text-[9pt] italic">(Ký và ghi rõ họ tên)</div>
          <div className="mt-14 font-bold">{doctor?.full_name || ''}</div>
          {doctor?.cchn_number && <div className="text-[9pt]">CCHN: {doctor.cchn_number}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
};

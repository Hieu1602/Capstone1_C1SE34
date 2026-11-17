import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, X } from 'lucide-react';

export const COMPLIANCE_SECTIONS = [
  {
    title: '1. Tiêu chuẩn Dữ liệu Y tế Quốc tế & Bảo mật Đa lớp',
    desc: 'Hệ thống Smart Elderly Care AI tuân thủ nghiêm ngặt các quy chuẩn truyền nhận và lưu trữ bệnh án điện tử quốc tế. Dữ liệu chỉ số sinh hiệu, đơn thuốc điều trị và tiền sử bệnh lý của người cao tuổi đều được mã hóa đầu cuối bảo mật tuyệt đối bằng thuật toán chuẩn AES-256.',
  },
  {
    title: '2. Cam kết Bảo mật Thông tin Bệnh nhân của Bác sĩ',
    desc: 'Bác sĩ gia đình có nghĩa vụ bảo mật toàn diện thông tin cá nhân, hồ sơ bệnh án và hình ảnh giám sát của người cao tuổi. Mọi hành vi sao chép, chụp màn hình hoặc chia sẻ dữ liệu y tế ra bên ngoài khi chưa có sự đồng ý của gia đình đều vi phạm Luật Khám bệnh, chữa bệnh.',
  },
  {
    title: '3. Nhật ký Kiểm toán & Giám sát Truy cập An toàn',
    desc: 'Mọi thao tác tra cứu hồ sơ, kê đơn thuốc, cập nhật chỉ số sức khỏe của Bác sĩ đều được hệ thống ghi nhận lịch sử kiểm toán tự động, phục vụ công tác thanh tra chuyên môn y tế và đối soát định kỳ.',
  },
];

export interface DoctorComplianceModalProps {
  onClose: () => void;
}

export const DoctorComplianceModal: React.FC<DoctorComplianceModalProps> = ({ onClose }) => {
  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] !mt-0 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="relative z-[101] w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-extrabold text-slate-900">Chính sách bảo mật dữ liệu</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 max-h-80 overflow-y-auto mb-5">
          {COMPLIANCE_SECTIONS.map((item) => (
            <div key={item.title}>
              <p className="text-xs font-bold text-slate-900 mb-1">{item.title}</p>
              <p className="text-xs leading-relaxed text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
        >
          Đã hiểu & Đồng ý
        </button>
      </div>
    </div>,
    document.body
  );
};

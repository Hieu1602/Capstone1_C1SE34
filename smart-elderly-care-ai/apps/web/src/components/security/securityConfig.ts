import { SecurityAuditLog, SecurityPolicy } from '../../types';

export const INITIAL_POLICIES: SecurityPolicy[] = [
  {
    id: 'pol-1',
    name: 'Xác thực đa yếu tố (2FA / OTP & WebAuthn)',
    description: 'Bắt buộc xác thực TOTP/WebAuthn khi đăng nhập tài khoản Bác sĩ và Quản trị viên.',
    category: 'authentication',
    enabled: true,
    is_immutable: true,
  },
  {
    id: 'pol-2',
    name: 'Mật khẩu độ phức tạp cao',
    description: 'Yêu cầu mật khẩu tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.',
    category: 'authentication',
    enabled: true,
  },
  {
    id: 'pol-3',
    name: 'Thời gian hết hạn phiên làm việc (JWT Access Token)',
    description: 'Tự động thu hồi phiên làm việc sau thời gian không hoạt động để bảo vệ dữ liệu y tế.',
    category: 'session',
    enabled: true,
    value: '24 giờ',
  },
  {
    id: 'pol-4',
    name: 'Khóa tài khoản sau 5 lần đăng nhập sai',
    description: 'Tự động tạm khóa tài khoản trong 15 phút nếu phát hiện tấn công Brute-force.',
    category: 'access_control',
    enabled: true,
    value: '5 lần',
  },
  {
    id: 'pol-5',
    name: 'Mã hóa dữ liệu nhạy cảm (At-Rest & In-Transit)',
    description: 'Toàn bộ sinh hiệu, hình ảnh khuôn mặt được mã hóa bằng AES-256 và TLS 1.3.',
    category: 'data_protection',
    enabled: true,
    is_immutable: true,
  },
  {
    id: 'pol-6',
    name: 'Giới hạn IP Whitelist cho cổng Admin',
    description: 'Chỉ cho phép truy cập trang quản trị từ các dải IP nội bộ hoặc VPN y tế đã xác thực.',
    category: 'access_control',
    enabled: false,
    value: '192.168.1.0/24',
  },
];

export const RBAC_ROWS = [
  { name: 'Quản lý tài khoản, thêm/sửa/khóa user', permissions: [true, false, false, false] },
  { name: 'Cấu hình bảo mật hệ thống & xem Audit Logs', permissions: [true, false, false, false] },
  { name: 'Vận hành hạ tầng Redis, EMQX, CSDL', permissions: [true, false, false, false] },
  { name: 'Xem hồ sơ sức khỏe & lịch sử sinh hiệu', permissions: [true, true, true, true] },
  { name: 'Điều chỉnh ngưỡng y tế (SpO2, Nhịp tim, Huyết áp)', permissions: [true, true, false, true] },
  { name: 'Xem trực tiếp camera AI & đàm thoại 2 chiều', permissions: [true, true, true, true] },
  { name: 'Khởi động lại thiết bị IoT từ xa qua MQTT', permissions: [true, false, false, true] },
];

export const ROLE_COLORS = [
  'text-sky-600 dark:text-[#FF6B35]',
  'text-emerald-600 dark:text-emerald-400',
  'text-indigo-600 dark:text-indigo-400',
  'text-amber-600 dark:text-amber-400',
];

export const SEVERITY_BADGE_STYLES: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
  high: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  medium: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  low: 'bg-slate-100 text-slate-800 dark:bg-[#202329] dark:text-[#A1A7B1]',
};

export const isDoctorAuditLog = (log: SecurityAuditLog): boolean => {
  const user = log.user.toLowerCase();
  const details = log.details.toLowerCase();
  return user.includes('doctor') || user.includes('bác sĩ') || details.includes('bác sĩ');
};

export const isAdminAuditLog = (log: SecurityAuditLog): boolean => {
  return log.user.toLowerCase().includes('admin') || log.details.toLowerCase().includes('admin');
};

export const isFailedAuditLog = (log: SecurityAuditLog): boolean => {
  const ev = log.event.toLowerCase();
  if (ev.includes('thu hồi')) return false;
  return ev.includes('thất bại') || ev.includes('tự động khóa') || ev.includes('từ chối') || ev.includes('sai mật khẩu');
};

export const isRevokeAuditLog = (log: SecurityAuditLog): boolean => {
  const ev = log.event.toLowerCase();
  return ev.includes('thu hồi');
};

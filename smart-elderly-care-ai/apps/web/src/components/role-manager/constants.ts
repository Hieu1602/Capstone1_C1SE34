import {
  ShieldCheck,
  Video,
  Activity,
  Bell,
  Smartphone,
  Users,
  Stethoscope,
} from 'lucide-react';
import { PermissionCategory, SystemRole, RoleColorSwatch } from './types';

// Bảng danh mục quyền hạn chi tiết trong hệ thống SECA
export const SECA_PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'general',
    title: 'Quyền Tổng Quát Hệ Thống',
    icon: ShieldCheck,
    color: 'text-purple-400',
    permissions: [
      {
        id: 'system.config',
        name: 'Cấu hình tham số hệ thống & AI',
        description: 'Cho phép thay đổi độ nhạy model AI phát hiện té ngã, ngưỡng cảnh báo và tham số hạ tầng máy chủ.',
      },
      {
        id: 'system.audit',
        name: 'Xem nhật ký kiểm toán (Audit Logs)',
        description: 'Cho phép tra cứu lịch sử truy cập, lịch sử đăng nhập và tất cả thao tác quản trị bảo mật.',
      },
      {
        id: 'system.roles',
        name: 'Quản lý vai trò & Phân quyền',
        description: 'Cho phép tạo, sửa đổi và cấp phát ma trận quyền hạn cho các vai trò trong hệ thống.',
      },
      {
        id: 'system.backup',
        name: 'Sao lưu & Phục hồi cơ sở dữ liệu',
        description: 'Cho phép kích hoạt snapshot CSDL PostgreSQL và sao lưu cấu hình bảo mật hệ thống.',
      },
    ],
  },
  {
    id: 'camera',
    title: 'Quyền Camera AI & Thị Giác Máy Tính',
    icon: Video,
    color: 'text-sky-400',
    permissions: [
      {
        id: 'camera.view',
        name: 'Xem luồng Camera trực tiếp & Tua lại',
        description: 'Cho phép xem trực tiếp luồng WebRTC/RTSP từ các camera AI lắp đặt trong căn hộ của người cao tuổi.',
      },
      {
        id: 'camera.talk',
        name: 'Đàm thoại 2 chiều qua micro/loa camera',
        description: 'Cho phép bật micro và truyền giọng nói tức thì qua loa tích hợp trên camera để trò chuyện.',
      },
      {
        id: 'camera.privacy',
        name: 'Bật / Tắt chế độ riêng tư (Privacy Mask)',
        description: 'Cho phép tạm thời che hình ảnh camera hoặc ngắt stream khi gia đình cần không gian riêng tư.',
      },
      {
        id: 'camera.history',
        name: 'Xem & Xuất video sự cố té ngã',
        description: 'Cho phép xem lại và tải đoạn video 30 giây được cắt tự động khi AI nhận diện sự cố té ngã.',
      },
      {
        id: 'camera.zones',
        name: 'Cấu hình vùng an toàn & Vùng nguy hiểm',
        description: 'Cho phép vẽ ranh giới ảo trên khung hình camera để phát hiện khi cụ đi vào khu vực trơn trượt.',
      },
    ],
  },
  {
    id: 'vitals',
    title: 'Quyền Sinh Hiệu & Hồ Sơ Sức Khỏe',
    icon: Activity,
    color: 'text-rose-400',
    permissions: [
      {
        id: 'vitals.view',
        name: 'Xem chỉ số sinh hiệu thời gian thực',
        description: 'Cho phép theo dõi nhịp tim (BPM), nồng độ oxy trong máu (SpO2), huyết áp và thân nhiệt thời gian thực.',
      },
      {
        id: 'vitals.trends',
        name: 'Xem đồ thị xu hướng & Thống kê 7 ngày',
        description: 'Cho phép phân tích biểu đồ biến thiên chỉ số sinh lý trong 12 giờ, 24 giờ và 7 ngày qua.',
      },
      {
        id: 'vitals.thresholds',
        name: 'Cấu hình ngưỡng cảnh báo y tế',
        description: 'Cho phép điều chỉnh khoảng giới hạn an toàn của nhịp tim và SpO2 theo từng thể trạng người cao tuổi.',
      },
      {
        id: 'vitals.export',
        name: 'Xuất báo cáo y bạ tổng hợp PDF & Excel',
        description: 'Cho phép kết xuất hồ sơ theo dõi sức khỏe định kỳ phục vụ tái khám và chẩn đoán y khoa.',
      },
    ],
  },
  {
    id: 'emergency',
    title: 'Quyền Cảnh Báo Khẩn Cấp (SOS)',
    icon: Bell,
    color: 'text-amber-400',
    permissions: [
      {
        id: 'emergency.push',
        name: 'Nhận thông báo Push khi có sự cố khẩn cấp',
        description: 'Nhận âm thanh báo động ưu tiên cao nhất trên điện thoại khi phát hiện ngã hoặc tiếng la hét khẩn cấp.',
      },
      {
        id: 'emergency.snooze',
        name: 'Tạm dừng chuông hú báo động (Snooze)',
        description: 'Cho phép tạm tắt chuông báo động trong nhà (15 phút - 2 giờ) khi phát hiện báo động giả.',
      },
      {
        id: 'emergency.sos115',
        name: 'Kích hoạt gọi khẩn cấp SOS 115 & Cứu hộ',
        description: 'Cho phép kích hoạt hệ thống tự động quay số tới tổng đài cấp cứu 115 và gửi tọa độ GPS căn nhà.',
      },
      {
        id: 'emergency.ack',
        name: 'Xác nhận đã xử lý sự cố (Acknowledge)',
        description: 'Đánh dấu sự cố đã được người thân hoặc bác sĩ tiếp cận xử lý thành công trên hệ sinh thái.',
      },
    ],
  },
  {
    id: 'devices',
    title: 'Quyền Thiết Bị IoT & Căn Nhà',
    icon: Smartphone,
    color: 'text-indigo-400',
    permissions: [
      {
        id: 'devices.pair',
        name: 'Thêm, quét & Ghép nối thiết bị IoT',
        description: 'Cho phép quét Bluetooth/Zigbee để ghép nối Hub trung tâm, Vòng đeo tay BLE và Cảm biến mở cửa.',
      },
      {
        id: 'devices.mode',
        name: 'Đổi chế độ an ninh căn nhà',
        description: 'Cho phép chuyển đổi giữa các cấu hình an ninh: Ở nhà, Đi vắng, Ban đêm hoặc Tạm tắt giám sát.',
      },
      {
        id: 'devices.restart',
        name: 'Khởi động lại thiết bị từ xa qua MQTT',
        description: 'Gửi gói tin điều khiển khởi động lại phần cứng Hub hoặc Camera khi phát hiện giật lag.',
      },
    ],
  },
  {
    id: 'members',
    title: 'Quyền Gia Đình & Quản Trị Thành Viên',
    icon: Users,
    color: 'text-emerald-400',
    permissions: [
      {
        id: 'members.invite',
        name: 'Mời thành viên mới tham gia vào căn nhà',
        description: 'Cho phép sinh mã QR và link chia sẻ để mời con cháu hoặc người chăm sóc tham gia vào gia đình.',
      },
      {
        id: 'members.permissions',
        name: 'Phân bổ & Điều chỉnh quyền thành viên',
        description: 'Cho phép Chủ nhà cấp hoặc hạn chế các tính năng cụ thể đối với từng người thân trong nhà.',
      },
      {
        id: 'members.remove',
        name: 'Xóa thành viên khỏi căn nhà',
        description: 'Gỡ bỏ quyền truy cập dữ liệu và camera của một tài khoản khỏi không gian gia đình.',
      },
    ],
  },
  {
    id: 'medical',
    title: 'Quyền Y Tế & Kê Đơn Thuốc',
    icon: Stethoscope,
    color: 'text-teal-400',
    permissions: [
      {
        id: 'medical.prescribe',
        name: 'Kê đơn thuốc & Tạo lời nhắc uống thuốc',
        description: 'Thiết lập thời gian biểu uống thuốc hàng ngày để hệ thống tự động phát lời nhắc qua loa thông minh.',
      },
      {
        id: 'medical.records',
        name: 'Tạo & Cập nhật bệnh án điện tử chuyên khoa',
        description: 'Ghi nhận hồ sơ bệnh án, tiền sử dị ứng thuốc và chẩn đoán điều trị của Bác sĩ chuyên khoa.',
      },
    ],
  },
];

// Danh sách vai trò mặc định chuẩn của hệ thống SECA
export const DEFAULT_SYSTEM_ROLES: SystemRole[] = [
  {
    id: 'role-admin',
    name: 'Quản trị viên (Admin)',
    color: '#a855f7', // Tím mộng mơ
    is_system: true,
    target_role: 'admin',
    description: 'Toàn quyền cấu hình hệ thống, quản lý an ninh mạng và hạ tầng máy chủ IoT/AI SECA.',
    hoist: true,
    permissions: SECA_PERMISSION_CATEGORIES.flatMap((c) => c.permissions.map((p) => p.id)),
  },
  {
    id: 'role-doctor',
    name: 'Bác sĩ chuyên khoa (Doctor)',
    color: '#0ea5e9', // Xanh Sky Blue y tế
    is_system: true,
    target_role: 'doctor',
    description: 'Bác sĩ gia đình theo dõi sinh hiệu SpO2/ECG chuyên sâu, điều chỉnh ngưỡng y tế và kê đơn thuốc.',
    hoist: true,
    permissions: [
      'vitals.view',
      'vitals.trends',
      'vitals.thresholds',
      'vitals.export',
      'emergency.push',
      'emergency.ack',
      'medical.prescribe',
      'medical.records',
    ],
  },
  {
    id: 'role-owner',
    name: 'Chủ nhà (Owner)',
    color: '#f59e0b', // Vàng hổ phách
    is_system: true,
    target_role: 'user',
    description: 'Chủ hộ gia đình, toàn quyền quản trị căn nhà, camera AI, thiết bị IoT và mời thành viên.',
    hoist: true,
    permissions: [
      'camera.view',
      'camera.talk',
      'camera.privacy',
      'camera.history',
      'camera.zones',
      'vitals.view',
      'vitals.trends',
      'vitals.export',
      'emergency.push',
      'emergency.snooze',
      'emergency.sos115',
      'emergency.ack',
      'devices.pair',
      'devices.mode',
      'devices.restart',
      'members.invite',
      'members.permissions',
      'members.remove',
    ],
  },
  {
    id: 'role-member',
    name: 'Thành viên gia đình (Member)',
    color: '#3b82f6', // Xanh lam
    is_system: true,
    target_role: 'caregiver',
    description: 'Thành viên gia đình theo dõi sức khỏe người cao tuổi, xem camera phòng chung và nhận cảnh báo SOS.',
    hoist: false,
    permissions: [
      'camera.view',
      'camera.talk',
      'vitals.view',
      'vitals.trends',
      'emergency.push',
      'emergency.ack',
    ],
  },
  {
    id: 'role-elderly',
    name: 'Người cao tuổi (Elderly)',
    color: '#10b981', // Xanh lục Emerald
    is_system: true,
    target_role: 'elderly',
    description: 'Người được giám sát sức khỏe, tự động đo sinh hiệu qua Vòng đeo tay BLE và nhận lời nhắc uống thuốc.',
    hoist: false,
    permissions: ['emergency.sos115'],
  },
];

// Bảng màu Preset Swatches
export const ROLE_COLOR_SWATCHES: RoleColorSwatch[] = [
  { name: 'Xanh SECA', hex: '#0ea5e9' },
  { name: 'Tím đậm', hex: '#5865F2' },
  { name: 'Xanh lục', hex: '#22c55e' },
  { name: 'Vàng rực', hex: '#eab308' },
  { name: 'Hổ phách', hex: '#f59e0b' },
  { name: 'Đỏ cam', hex: '#ef4444' },
  { name: 'Hồng sen', hex: '#ec4899' },
  { name: 'Tím mộng mơ', hex: '#a855f7' },
  { name: 'Xanh chàm', hex: '#6366f1' },
  { name: 'Xanh ngọc', hex: '#06b6d4' },
  { name: 'Xám khói', hex: '#94a3b8' },
  { name: 'Xám đậm', hex: '#475569' },
];


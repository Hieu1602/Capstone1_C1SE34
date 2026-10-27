import React from 'react';
import {
  Shield,
  Stethoscope,
  Home,
  Users,
  Heart,
  Video,
  Activity,
  Bell,
  Smartphone,
} from 'lucide-react';
import { PermissionRule } from '../../types';

// Cấu hình vai trò người dùng (Tách bạch Chủ nhà và Thành viên)
export const ROLE_CONFIG: Record<
  string,
  {
    label: string;
    shortLabel: string;
    badgeStyle: string;
    icon: React.ElementType;
    description: string;
  }
> = {
  admin: {
    label: 'Quản trị viên (Admin)',
    shortLabel: 'Quản trị',
    badgeStyle:
      'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30',
    icon: Shield,
    description: 'Toàn quyền cấu hình hệ thống, an ninh mạng và hạ tầng máy chủ',
  },
  doctor: {
    label: 'Bác sĩ chuyên khoa',
    shortLabel: 'Bác sĩ',
    badgeStyle:
      'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30',
    icon: Stethoscope,
    description: 'Theo dõi sinh hiệu SpO2/ECG, điều chỉnh ngưỡng y tế và kê đơn thuốc',
  },
  user: {
    label: 'Chủ nhà (Owner)',
    shortLabel: 'Chủ nhà',
    badgeStyle:
      'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
    icon: Home,
    description: 'Chủ hộ gia đình, toàn quyền quản trị căn nhà, camera AI, thiết bị và thành viên',
  },
  owner: {
    label: 'Chủ nhà (Owner)',
    shortLabel: 'Chủ nhà',
    badgeStyle:
      'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
    icon: Home,
    description: 'Chủ hộ gia đình, toàn quyền quản trị căn nhà, camera AI, thiết bị và thành viên',
  },
  caregiver: {
    label: 'Thành viên (Member)',
    shortLabel: 'Thành viên',
    badgeStyle:
      'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
    icon: Users,
    description: 'Thành viên gia đình, theo dõi sức khỏe người cao tuổi và nhận thông báo khẩn cấp',
  },
  member: {
    label: 'Thành viên (Member)',
    shortLabel: 'Thành viên',
    badgeStyle:
      'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
    icon: Users,
    description: 'Thành viên gia đình, theo dõi sức khỏe người cao tuổi và nhận thông báo khẩn cấp',
  },
  elderly: {
    label: 'Người cao tuổi',
    shortLabel: 'Người cao tuổi',
    badgeStyle:
      'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
    icon: Heart,
    description: 'Đối tượng được chăm sóc, giám sát sinh hiệu liên tục & cảnh báo té ngã',
  },
};

// Danh sách các vai trò chuẩn hiển thị khi tạo hoặc cập nhật tài khoản (tránh bị lặp)
export const SELECTABLE_ROLES: string[] = ['admin', 'doctor', 'owner', 'member', 'elderly'];

// Danh mục toàn bộ các quyền hạn chi tiết trong hệ thống SECA
export const PERMISSION_GROUPS = [
  {
    moduleKey: 'camera',
    title: 'Camera AI & Giám sát hình ảnh',
    icon: Video,
    color: 'text-sky-600 dark:text-sky-400',
    items: [
      { id: 'camera.view', label: 'Xem luồng Camera trực tiếp & Tua lại' },
      { id: 'camera.talk', label: 'Đàm thoại 2 chiều qua micro/loa camera' },
      { id: 'camera.privacy', label: 'Bật / Tắt chế độ riêng tư (che camera)' },
      { id: 'camera.history', label: 'Xem và xuất video lưu trữ sự cố té ngã' },
    ],
  },
  {
    moduleKey: 'vitals',
    title: 'Sinh hiệu & Hồ sơ sức khỏe',
    icon: Activity,
    color: 'text-rose-600 dark:text-rose-400',
    items: [
      { id: 'vitals.view', label: 'Xem nhịp tim, SpO2 & Huyết áp thời gian thực' },
      { id: 'vitals.trends', label: 'Xem đồ thị xu hướng sức khỏe 12h & 7 ngày' },
      { id: 'vitals.thresholds', label: 'Cấu hình ngưỡng cảnh báo y tế (SpO2, Nhịp tim)' },
      { id: 'vitals.export', label: 'Xuất báo cáo y bạ tổng hợp PDF & Excel' },
    ],
  },
  {
    moduleKey: 'emergency',
    title: 'Cảnh báo & Khẩn cấp (SOS)',
    icon: Bell,
    color: 'text-amber-600 dark:text-amber-400',
    items: [
      { id: 'emergency.push', label: 'Nhận Push notification khi có té ngã/la hét' },
      { id: 'emergency.snooze', label: 'Tạm dừng chuông hú báo động (Snooze 15p - 2h)' },
      { id: 'emergency.sos115', label: 'Kích hoạt gọi khẩn cấp SOS 115' },
      { id: 'emergency.ack', label: 'Xác nhận đã xử lý sự cố (Acknowledge)' },
    ],
  },
  {
    moduleKey: 'devices',
    title: 'Thiết bị IoT & Căn nhà',
    icon: Smartphone,
    color: 'text-indigo-600 dark:text-indigo-400',
    items: [
      { id: 'devices.pair', label: 'Thêm, quét & ghép nối thiết bị (Hub, Camera, Vòng tay)' },
      { id: 'devices.mode', label: 'Đổi chế độ bảo vệ nhà (Ở nhà, Xa nhà, Tắt báo động)' },
      { id: 'devices.restart', label: 'Khởi động lại thiết bị từ xa qua MQTT' },
    ],
  },
  {
    moduleKey: 'members',
    title: 'Gia đình & Quản trị thành viên',
    icon: Users,
    color: 'text-emerald-600 dark:text-emerald-400',
    items: [
      { id: 'members.invite', label: 'Mời thành viên mới tham gia vào căn nhà' },
      { id: 'members.permissions', label: 'Phân bổ và sửa quyền truy cập cho thành viên' },
      { id: 'members.remove', label: 'Xóa thành viên khỏi căn nhà' },
    ],
  },
  {
    moduleKey: 'medical',
    title: 'Y tế & Đơn thuốc',
    icon: Stethoscope,
    color: 'text-teal-600 dark:text-teal-400',
    items: [
      { id: 'medical.prescribe', label: 'Kê đơn thuốc & tạo lời nhắc phát loa tự động' },
      { id: 'medical.records', label: 'Tạo và cập nhật bệnh án điện tử chuyên khoa' },
    ],
  },
];

// Danh sách các Rule phân quyền mẫu chuẩn ban đầu
export const INITIAL_PERMISSION_RULES: PermissionRule[] = [
  {
    id: 'rule-owner',
    name: 'Rule Quản trị toàn diện dành cho Chủ nhà (Owner Policy)',
    description: 'Chủ hộ gia đình có toàn quyền quản trị nhà, camera, thiết bị IoT, mời thành viên và xử lý cảnh báo SOS.',
    target_role: 'user',
    module: 'all',
    permissions: [
      'camera.view',
      'camera.talk',
      'camera.privacy',
      'camera.history',
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
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'rule-member',
    name: 'Rule Giám sát người thân dành cho Thành viên (Member Policy)',
    description: 'Thành viên gia đình theo dõi sức khỏe, xem camera phòng chung và nhận cảnh báo khẩn cấp (không có quyền xóa thiết bị hay đổi chế độ an ninh nhạy cảm).',
    target_role: 'caregiver',
    module: 'all',
    permissions: [
      'camera.view',
      'camera.talk',
      'vitals.view',
      'vitals.trends',
      'emergency.push',
      'emergency.ack',
    ],
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'rule-doctor',
    name: 'Rule Chuyên môn Y khoa dành cho Bác sĩ (Doctor Policy)',
    description: 'Bác sĩ gia đình theo dõi dữ liệu y bạ, sinh hiệu ECG/SpO2 chuyên sâu, kê đơn thuốc và can thiệp cấp cứu từ xa.',
    target_role: 'doctor',
    module: 'medical',
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
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'rule-elderly',
    name: 'Rule Bảo vệ Người cao tuổi (Elderly Policy)',
    description: 'Tự động đo sinh hiệu qua Vòng đeo tay BLE, nhận thông báo nhắc uống thuốc qua loa thông minh và gửi SOS khẩn cấp.',
    target_role: 'elderly',
    module: 'emergency',
    permissions: ['emergency.sos115'],
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'rule-admin',
    name: 'Rule Quản trị viên cấp cao (Root Admin Superuser Policy)',
    description: 'Toàn quyền cấu hình phân hệ người dùng, thiết lập quy tắc bảo mật, giám sát hạ tầng MQTT/Redis/PostgreSQL.',
    target_role: 'admin',
    module: 'all',
    permissions: PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.id)),
    is_active: true,
    updated_at: new Date().toISOString(),
  },
];


import React from 'react';
import {
  Info,
  Wrench,
  ShieldAlert,
  HeartHandshake,
  Sparkles,
  Users,
  Stethoscope,
  Radio,
  CheckCircle2,
  Clock,
  FileEdit,
  RotateCcw,
} from 'lucide-react';
import { NotificationType, TargetAudience, NotificationStatus } from '../../types';

export const TYPE_CONFIG: Record<
  NotificationType,
  {
    label: string;
    icon: React.ElementType;
    badgeStyle: string;
    description: string;
  }
> = {
  info: {
    label: 'Thông tin chung',
    icon: Info,
    badgeStyle: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20',
    description: 'Thông báo tin tức chung và hướng dẫn sử dụng',
  },
  system_maintenance: {
    label: 'Bảo trì hệ thống',
    icon: Wrench,
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
    description: 'Cảnh báo lịch bảo trì máy chủ, backup định kỳ',
  },
  emergency: {
    label: 'Khẩn cấp / Cảnh báo',
    icon: ShieldAlert,
    badgeStyle: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20',
    description: 'Cảnh báo thời tiết cực đoan, sự cố nghiêm trọng',
  },
  health_tip: {
    label: 'Lời khuyên sức khỏe',
    icon: HeartHandshake,
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    description: 'Khuyến cáo y tế, chế độ vận động & dinh dưỡng',
  },
  feature_update: {
    label: 'Cập nhật tính năng',
    icon: Sparkles,
    badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20',
    description: 'Ra mắt tính năng AI mới hoặc nâng cấp giao diện',
  },
};

export const AUDIENCE_CONFIG: Record<
  TargetAudience,
  {
    label: string;
    icon: React.ElementType;
    badgeStyle: string;
  }
> = {
  all: {
    label: 'Tất cả người dùng',
    icon: Users,
    badgeStyle: 'bg-slate-100 text-slate-700 dark:bg-[#202329] dark:text-[#A1A7B1]',
  },
  caregivers: {
    label: 'Gia đình & Người chăm sóc',
    icon: HeartHandshake,
    badgeStyle: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  },
  doctors: {
    label: 'Bác sĩ chuyên khoa',
    icon: Stethoscope,
    badgeStyle: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300',
  },
  elderly: {
    label: 'Người cao tuổi',
    icon: Radio,
    badgeStyle: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  },
};

export const STATUS_CONFIG: Record<
  NotificationStatus,
  {
    label: string;
    icon: React.ElementType;
    badgeStyle: string;
  }
> = {
  published: {
    label: 'Đã phát hành',
    icon: CheckCircle2,
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  },
  scheduled: {
    label: 'Đã lên lịch',
    icon: Clock,
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  },
  draft: {
    label: 'Bản nháp',
    icon: FileEdit,
    badgeStyle: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#202329] dark:text-[#A1A7B1] dark:border-[#454A53]',
  },
  revoked: {
    label: 'Đã thu hồi',
    icon: RotateCcw,
    badgeStyle: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
  },
};


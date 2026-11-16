// src/components/layout/DoctorSidebar.tsx
// Menu bên trái dành riêng cho Bác sĩ gia đình (4 mục chuẩn: Trang chủ, Lịch khám và tái khám, Danh sách bệnh nhân, Cài đặt)

import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, CalendarDays, Users, Bell, Settings, Activity } from 'lucide-react';

export const DoctorSidebar: React.FC = () => {
  const navItems = [
    {
      to: '/',
      label: 'Trang chủ',
      icon: Home,
      description: 'Ca khám hôm nay & cảnh báo',
    },
    {
      to: '/appointments',
      label: 'Lịch khám',
      icon: CalendarDays,
      description: 'Lên lịch & nhắc nhở qua loa',
    },
    {
      to: '/patients',
      label: 'Danh sách bệnh nhân',
      icon: Users,
      description: 'Hồ sơ bệnh án & sinh hiệu',
    },
    {
      to: '/notifications',
      label: 'Thông báo',
      icon: Bell,
      description: 'Cảnh báo y tế & sự cố khẩn cấp',
    },
    {
      to: '/settings',
      label: 'Cài đặt',
      icon: Settings,
      description: 'Hồ sơ bác sĩ & bảo mật hệ thống',
    },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200/80 bg-white dark:bg-slate-900 h-full flex flex-col justify-between p-4 overflow-y-auto select-none z-20">
      <div className="space-y-6">
        {/* Nhãn phân loại */}
        <div>
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Nghiệp vụ lâm sàng
          </p>

          <nav className="mt-2.5 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `group flex items-start space-x-3 rounded-2xl px-3.5 py-3 text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-blue-200 shadow-lg'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-semibold">{item.label}</p>
                        <p
                          className={`truncate text-[10px] font-normal ${
                            isActive ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {item.description}
                        </p>
                      </div>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Thẻ trạng thái kết nối Hub & Thiết bị đeo Smartband */}
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/90 to-white p-4 shadow-sm">
          <div className="flex items-center space-x-2 text-blue-700">
            <Activity className="h-4 w-4 animate-pulse" />
            <span className="text-xs font-bold">Giám sát IoT thời gian thực</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
            Đồng bộ dữ liệu sinh hiệu nhịp tim & SpO2 tức thời từ vòng đeo tay người cao tuổi.
          </p>
          <div className="mt-2.5 flex items-center space-x-1.5 text-[10.5px] font-semibold text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Kênh giám sát trực tuyến 24/7</span>
          </div>
        </div>
      </div>

      {/* Footer nhỏ dưới cùng */}
      <div className="border-t border-slate-100 pt-3 text-center">
        <p className="text-[10px] font-medium text-slate-400">SmartCare AI Doctor Portal v2.4.0</p>
        <p className="text-[10px] text-slate-400">Bảo mật tiêu chuẩn Y tế</p>
      </div>
    </aside>
  );
};

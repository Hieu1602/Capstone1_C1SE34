// src/components/layout/DoctorSidebar.tsx
// Menu bên trái dành riêng cho Bác sĩ gia đình

import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarDays, Activity } from 'lucide-react';

export const DoctorSidebar: React.FC = () => {
  const navItems = [
    {
      to: '/',
      label: 'Tổng quan khám bệnh',
      icon: LayoutDashboard,
      description: 'Ca khám hôm nay & cảnh báo',
    },
    {
      to: '/patients',
      label: 'Danh bạ bệnh nhân',
      icon: Users,
      description: 'Hồ sơ bệnh án & sinh hiệu',
    },
    {
      to: '/appointments',
      label: 'Lịch khám & Tái khám',
      icon: CalendarDays,
      description: 'Lên lịch & nhắc nhở qua loa',
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-200/80 bg-white min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4">
      <div className="space-y-6">
        {/* Nhãn phân loại */}
        <div>
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Nghiệp vụ lâm sàng
          </p>

          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `group flex items-start space-x-3 rounded-2xl px-3.5 py-3 text-xs font-semibold transition-all duration-150 ${isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'
                          }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-semibold">{item.label}</p>
                        <p
                          className={`truncate text-[10px] font-normal ${isActive ? 'text-blue-100' : 'text-slate-400'
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
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-white p-3.5 shadow-xs">
          <div className="flex items-center space-x-2 text-blue-700">
            <Activity className="h-4 w-4 animate-pulse" />
            <span className="text-xs font-bold">Giám sát IoT thời gian thực</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-600">
            Đồng bộ dữ liệu sinh hiệu nhịp tim & SpO2 tức thời từ vòng đeo tay người cao tuổi.
          </p>
          <div className="mt-2 flex items-center space-x-1.5 text-[10px] font-medium text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Kênh dữ liệu WebSocket đang mở</span>
          </div>
        </div>
      </div>

      {/* Footer nhỏ dưới cùng */}
      <div className="border-t border-slate-100 pt-3 text-center">
        <p className="text-[10px] text-slate-400">
          SmartCare AI Doctor Portal v1.0.0
        </p>
        <p className="text-[10px] text-slate-400">
          Bảo mật tiêu chuẩn
        </p>
      </div>
    </aside>
  );
};

// src/components/layout/DoctorLayout.tsx
// Bố cục tổng thể trang Bác sĩ: Navbar + Sidebar + Vùng nội dung

import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { DoctorNavbar } from './DoctorNavbar';
import { DoctorSidebar } from './DoctorSidebar';
import { doctorWebSocket } from '../../services/websocket';
import { AlertCircle, X } from 'lucide-react';

export const DoctorLayout: React.FC = () => {
  const [realtimeAlert, setRealtimeAlert] = useState<{
    id?: string;
    message?: string;
    time?: string;
    type?: string;
  } | null>(null);

  useEffect(() => {
    doctorWebSocket.connect();
    const unsubscribe = doctorWebSocket.subscribe((event) => {
      if (event && (event.type === 'ALERT_NEW' || event.message || event.heart_rate || event.spo2)) {
        setRealtimeAlert({
          message: event.message || `Cảnh báo sinh hiệu bất thường từ bệnh nhân!`,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          type: event.type || 'warning',
        });
      }
    });

    return () => {
      unsubscribe();
      doctorWebSocket.disconnect();
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-slate-800">
      {/* Top Navbar */}
      <DoctorNavbar />

      {/* Main Body */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <DoctorSidebar />

        {/* Content Area */}
        <main className="flex-1 min-w-0 p-6 lg:p-8 overflow-y-auto">
          {/* Banner thông báo thời gian thực nếu có sự cố */}
          {realtimeAlert && (
            <div className="mb-6 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/90 p-4 shadow-sm backdrop-blur-sm animate-in fade-in duration-200">
              <div className="flex items-center space-x-3">
                <div className="rounded-xl bg-rose-500 p-2 text-white shadow-xs">
                  <AlertCircle className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                    CẢNH BÁO LÂM SÀNG THỜI GIAN THỰC ({realtimeAlert.time})
                  </p>
                  <p className="text-xs font-semibold text-rose-950">
                    {realtimeAlert.message}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRealtimeAlert(null)}
                className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-100 hover:text-rose-700 transition-colors"
                title="Đóng thông báo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <Outlet />
        </main>
      </div>
    </div>
  );
};


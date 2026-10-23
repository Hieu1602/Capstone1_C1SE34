// src/components/layout/MainLayout.tsx
// Dual Theme Support: Light Mode (Enterprise Source of Truth) · Dark Mode (Black Metallic + Orange)

import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { adminWebSocket } from '../../services/websocket';
import { AlertTriangle, X } from 'lucide-react';

export const MainLayout: React.FC = () => {
  const [latestAlert, setLatestAlert] = useState<{
    id?: string;
    message?: string;
    time?: string;
  } | null>(null);

  useEffect(() => {
    adminWebSocket.connect();
    const unsubscribe = adminWebSocket.subscribe((event) => {
      if (event.type === 'ALERT_NEW' || event.message) {
        setLatestAlert({
          message: event.message || 'Phát hiện sự cố bất thường từ thiết bị Edge Hub!',
          time: new Date().toLocaleTimeString(),
        });
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F5F6F8] dark:bg-[#12151C] text-[#191B20] dark:text-[#F1F3F7] font-sans selection:bg-[#F05A24]/20 selection:text-[#F05A24] transition-colors duration-200">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F5F6F8] dark:bg-[#12151C] relative min-h-screen transition-colors duration-200 overflow-x-hidden">
        <Navbar />

        {/* Real-time Alert Toast Banner */}
        {latestAlert && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 dark:bg-[#202329] dark:border-[#454A53] text-amber-900 dark:text-[#FBBF24] flex items-center justify-between shadow-sm dark:shadow-[inset_0_1px_0_rgba(119,127,139,0.2),0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur-md animate-slide-up relative z-10">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/40 shadow-xs">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#F05A24]">
                  CẢNH BÁO THỜI GIAN THỰC ({latestAlert.time})
                </p>
                <p className="text-xs font-semibold text-[#191B20] dark:text-[#F5F6F8]">
                  {latestAlert.message}
                </p>
              </div>
            </div>
            <button
              onClick={() => setLatestAlert(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content Outlet */}
        <main className="flex-1 overflow-y-auto p-6 relative z-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

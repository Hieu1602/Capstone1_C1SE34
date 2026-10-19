// src/components/layout/MainLayout.tsx
// Theme: Sky Blue & White · Full Light & Dark Mode Dual Support

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
    <div className="flex min-h-screen bg-[#F2EBE0] dark:bg-[#0B1714] text-slate-900 dark:text-slate-100 font-sans selection:bg-[#D96C3B]/20 selection:text-[#C25828] transition-colors duration-200">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F2EBE0] dark:bg-[#0B1714] relative min-h-screen transition-colors duration-200 overflow-x-hidden">
        
        {/* Imperial Palace Panorama Hero Watermark (Top Right) */}
        <div 
          className="absolute top-14 right-0 w-80 md:w-[520px] h-36 opacity-30 dark:opacity-15 pointer-events-none select-none bg-contain bg-no-repeat bg-right-top z-0"
          style={{ backgroundImage: `url('/assets/heritage/png/palace-panorama.png')` }}
          aria-hidden="true"
        />

        <Navbar />

        {/* Real-time Alert Toast Banner */}
        {latestAlert && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-700/50 text-amber-900 dark:text-amber-200 flex items-center justify-between shadow-lg shadow-amber-500/5 backdrop-blur-md animate-slide-up relative z-10">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-[#D96C3B]/10 dark:bg-[#D96C3B]/20 text-[#D96C3B] dark:text-[#E67A47] border border-[#D96C3B]/20">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#D96C3B] dark:text-[#E67A47]">
                  CẢNH BÁO THỜI GIAN THỰC ({latestAlert.time})
                </p>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">{latestAlert.message}</p>
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

        <main className="flex-1 overflow-y-auto relative z-10 flex flex-col justify-between">
          <div className="p-6 flex-1">
            <Outlet />
          </div>
          
          {/* Imperial Lotus Wave Footer Banner - Full Detail & 100% Screen Width */}
          <div className="relative w-full overflow-hidden pointer-events-none select-none mt-6 leading-none">
            <img
              src="/assets/heritage/png/lotus-wave-footer.png?v=3"
              alt=""
              className="w-full h-auto min-w-full block select-none pointer-events-none opacity-90 dark:opacity-60"
            />
          </div>
        </main>
      </div>
    </div>
  );
};

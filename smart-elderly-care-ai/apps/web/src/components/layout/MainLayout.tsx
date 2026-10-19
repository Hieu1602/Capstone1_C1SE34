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
    <div className="flex min-h-screen bg-[#f0f7ff] dark:bg-[#0b132b] text-slate-800 dark:text-slate-100 font-sans selection:bg-sky-500/20 selection:text-sky-600 transition-colors duration-200">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f0f7ff] dark:bg-[#0b132b] relative min-h-screen transition-colors duration-200">
        <Navbar />

        {/* Real-time Alert Toast Banner */}
        {latestAlert && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 dark:bg-rose-500/15 dark:border-rose-500/40 text-rose-700 dark:text-rose-200 flex items-center justify-between shadow-lg shadow-rose-500/10 backdrop-blur-md animate-slide-up">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono font-bold tracking-wider text-rose-600 dark:text-rose-300">
                  CẢNH BÁO THỜI GIAN THỰC ({latestAlert.time})
                </p>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">{latestAlert.message}</p>
              </div>
            </div>
            <button
              onClick={() => setLatestAlert(null)}
              className="p-1.5 rounded-lg text-rose-500 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
              title="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

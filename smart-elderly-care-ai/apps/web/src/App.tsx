// src/App.tsx
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { SecurityManagementPage } from './pages/SecurityManagementPage';
import { SystemMonitoringPage } from './pages/SystemMonitoringPage';

import { AIMaintenancePage } from './pages/AIMaintenancePage';
import { InfrastructurePage } from './pages/InfrastructurePage';
import { NotificationManagementPage } from './pages/NotificationManagementPage';
import { LoginPage } from './pages/LoginPage';
import { useAuthStore } from './store/useAuthStore';
import { useThemeStore } from './store/useThemeStore';

// Protected Route Component - Chi Admin moi duoc phep truy cap
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated || !user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  const { isDark } = useThemeStore();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    // Author: DuongVanHieu - Kích hoạt cờ tương thích React Router v7 để chuẩn hóa chuyển cảnh trạng thái và splat route
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Admin Subsystem Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="security" element={<SecurityManagementPage />} />
          <Route path="monitoring" element={<SystemMonitoringPage />} />
          <Route path="notifications" element={<NotificationManagementPage />} />


          <Route path="ai-maintenance" element={<AIMaintenancePage />} />
          <Route path="infrastructure" element={<InfrastructurePage />} />
        </Route>

        {/* Catch-all Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;


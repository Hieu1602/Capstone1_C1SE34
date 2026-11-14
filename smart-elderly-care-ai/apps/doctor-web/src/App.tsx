// src/App.tsx
// Cấu hình Routing & Bảo vệ phân quyền cho Doctor Web Portal

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DoctorLayout } from './components/layout/DoctorLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PatientsPage } from './pages/PatientsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { useDoctorAuthStore } from './store/useDoctorAuthStore';

// Protected Route Component: Chỉ cho phép tài khoản vai trò Bác Sĩ truy cập
const DoctorProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useDoctorAuthStore();

  if (!isAuthenticated || !user || user.role !== 'doctor') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Route công khai: Đăng nhập Bác sĩ */}
        <Route path="/login" element={<LoginPage />} />

        {/* Các Route được bảo vệ trong Cổng Y Tế Bác sĩ */}
        <Route
          path="/"
          element={
            <DoctorProtectedRoute>
              <DoctorLayout />
            </DoctorProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
        </Route>

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;


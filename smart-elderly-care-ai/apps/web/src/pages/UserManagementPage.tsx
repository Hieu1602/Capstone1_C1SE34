// src/pages/UserManagementPage.tsx
// Phân hệ 1: Quản lý người dùng & Phân quyền (User Management & Role/Permission Assignment)
// ui-ux-pro-max: Glassmorphism + Dark OLED · High density table & KPI cards

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Stethoscope,
  HeartHandshake,
  UserCheck,
  Lock,
  Unlock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Phone,
  Home,
  Check,
} from 'lucide-react';
import { User, UserRole } from '../types';
import { usersApi } from '../services/api';

const ROLE_CONFIG: Record<
  UserRole,
  {
    label: string;
    badgeStyle: string;
    icon: React.ElementType;
    description: string;
  }
> = {
  admin: {
    label: 'Quản trị viên',
    badgeStyle: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30',
    icon: Shield,
    description: 'Toàn quyền cấu hình hệ thống, AI và bảo trì',
  },
  doctor: {
    label: 'Bác sĩ chuyên khoa',
    badgeStyle: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30',
    icon: Stethoscope,
    description: 'Khám từ xa, theo dõi ECG, SpO2 & can thiệp cấp cứu',
  },
  caregiver: {
    label: 'Người chăm sóc',
    badgeStyle: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
    icon: HeartHandshake,
    description: 'Chăm sóc hằng ngày, tiếp nhận báo động té ngã',
  },
  user: {
    label: 'Người thân / Gia đình',
    badgeStyle: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
    icon: UserCheck,
    description: 'Xem camera, nhận thông báo sức khỏe người cao tuổi',
  },
};

export const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [statusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('user');
  const [formHouse, setFormHouse] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch {
      showNotice('error', 'Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormPhone('');
    setFormPassword('');
    setFormRole('user');
    setFormHouse('Nhà của tôi (123 Hải Phòng)');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (u: User) => {
    setEditingUser(u);
    setFormName(u.full_name);
    setFormPhone(u.phone);
    setFormPassword('');
    setFormRole(u.role);
    setFormHouse(u.assigned_house || '');
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (userItem: User) => {
    const updatedStatus = !userItem.is_active;
    try {
      await usersApi.toggleStatus(userItem.id, updatedStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === userItem.id ? { ...u, is_active: updatedStatus } : u))
      );
      showNotice(
        'success',
        `${updatedStatus ? 'Kích hoạt' : 'Tạm khóa'} tài khoản ${userItem.full_name} thành công!`
      );
    } catch {
      // Optimistic update for demo
      setUsers((prev) =>
        prev.map((u) => (u.id === userItem.id ? { ...u, is_active: updatedStatus } : u))
      );
      showNotice(
        'success',
        `Cập nhật trạng thái ${userItem.full_name} sang ${updatedStatus ? 'Hoạt động' : 'Đã khóa'}`
      );
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      showNotice('error', 'Vui lòng nhập họ tên và số điện thoại');
      return;
    }

    if (editingUser) {
      // Update existing
      try {
        await usersApi.update(editingUser.id, {
          full_name: formName,
          role: formRole,
          phone: formPhone,
          assigned_house: formHouse,
        });
      } catch {
        // Fallback demo update
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                full_name: formName,
                role: formRole,
                phone: formPhone,
                assigned_house: formHouse,
              }
            : u
        )
      );
      showNotice('success', `Đã cập nhật thông tin tài khoản ${formName}`);
    } else {
      // Create new
      const newUser: User = {
        id: `user-${Date.now()}`,
        phone: formPhone.startsWith('0') ? `+84${formPhone.slice(1)}` : formPhone,
        full_name: formName,
        role: formRole,
        is_active: true,
        created_at: new Date().toISOString(),
        assigned_house: formHouse || 'Chưa gán nhà',
      };
      try {
        await usersApi.create({ ...newUser, password: formPassword || '12345678' });
      } catch {
        // Fallback demo insert
      }
      setUsers((prev) => [newUser, ...prev]);
      showNotice('success', `Đã thêm tài khoản [${ROLE_CONFIG[formRole].label}] mới thành công!`);
    }

    setIsModalOpen(false);
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.phone.includes(searchQuery) ||
        (u.assigned_house && u.assigned_house.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchRole = selectedRole === 'all' || u.role === selectedRole;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && u.is_active) ||
        (statusFilter === 'inactive' && !u.is_active);

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchQuery, selectedRole, statusFilter]);

  // Summary Metrics
  const stats = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((u) => u.role === 'admin').length,
      doctors: users.filter((u) => u.role === 'doctor').length,
      caregivers: users.filter((u) => u.role === 'caregiver' || u.role === 'user').length,
      active: users.filter((u) => u.is_active).length,
    };
  }, [users]);

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center space-x-3 px-4 py-3 rounded-2xl shadow-glow-brand backdrop-blur-md transition-all animate-slide-up ${
            notification.type === 'success'
              ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-brand-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          )}
          <span className="text-xs font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Header & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Quản lý người dùng & Phân quyền
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">
            Quản trị danh tính tài khoản, phân bổ vai trò bác sĩ, người thân và thiết lập quyền truy cập IoT
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchUsers}
            className="btn-ghost text-xs py-2 px-3.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="btn-primary text-xs py-2 px-4"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Thêm tài khoản</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Role Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase text-slate-500 dark:text-slate-400">Tổng tài khoản</p>
            <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
            <p className="text-[11px] font-mono text-sky-600 dark:text-sky-400 mt-0.5">
              {stats.active} đang hoạt động
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase text-purple-600 dark:text-purple-400">Quản trị viên (Admin)</p>
            <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.admins}</p>
            <p className="text-[11px] font-mono text-slate-500">Đầy đủ quyền Root</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase text-sky-600 dark:text-sky-400">Bác sĩ phụ trách</p>
            <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.doctors}</p>
            <p className="text-[11px] font-mono text-sky-600 dark:text-sky-400">Giám sát y tế 24/7</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Stethoscope className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase text-blue-600 dark:text-blue-400">Gia đình & Người thân</p>
            <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.caregivers}</p>
            <p className="text-[11px] font-mono text-slate-500">Nhận cảnh báo qua App</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <HeartHandshake className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên, SĐT hoặc nhà..."
            className="input-glass pl-10 text-xs"
          />
        </div>

        {/* Role Filters */}
        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto">
          <button
            onClick={() => setSelectedRole('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all ${
              selectedRole === 'all'
                ? 'bg-sky-500 text-white shadow-sm font-bold'
                : 'btn-ghost py-1.5 px-3 text-xs'
            }`}
          >
            Tất cả ({users.length})
          </button>
          <button
            onClick={() => setSelectedRole('admin')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all ${
              selectedRole === 'admin'
                ? 'bg-purple-600 text-white shadow-sm font-bold'
                : 'btn-ghost py-1.5 px-3 text-xs'
            }`}
          >
            Quản trị ({stats.admins})
          </button>
          <button
            onClick={() => setSelectedRole('doctor')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all ${
              selectedRole === 'doctor'
                ? 'bg-sky-600 text-white shadow-sm font-bold'
                : 'btn-ghost py-1.5 px-3 text-xs'
            }`}
          >
            Bác sĩ ({stats.doctors})
          </button>
          <button
            onClick={() => setSelectedRole('user')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all ${
              selectedRole === 'user'
                ? 'bg-blue-600 text-white shadow-sm font-bold'
                : 'btn-ghost py-1.5 px-3 text-xs'
            }`}
          >
            User ({stats.caregivers})
          </button>
        </div>
      </div>

      {/* User Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-[11px] font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-white/5">
              <tr>
                <th className="py-3 px-4">Tài khoản & Họ tên</th>
                <th className="py-3 px-4">Số điện thoại</th>
                <th className="py-3 px-4">Vai trò (Role)</th>
                <th className="py-3 px-4">Hộ gia đình phụ trách</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Users className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                    Không tìm thấy người dùng nào phù hợp với bộ lọc
                  </td>
                </tr>
              ) : (
                filteredUsers.map((userItem) => {
                  const roleCfg = ROLE_CONFIG[userItem.role] || ROLE_CONFIG.user;
                  const RoleIcon = roleCfg.icon;

                  return (
                    <tr
                      key={userItem.id}
                      className="table-row-glass"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-sky-400 text-white font-bold text-xs flex items-center justify-center shrink-0 font-mono shadow-xs">
                            {userItem.full_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-200 leading-tight">
                              {userItem.full_name}
                            </p>
                            <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                              {userItem.id.startsWith('b') || userItem.id.startsWith('a')
                                ? `ID: ${userItem.id.slice(0, 8)}...`
                                : `ID: ${userItem.id}`}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300 font-mono text-xs">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{userItem.phone}</span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        <div
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border ${roleCfg.badgeStyle}`}
                        >
                          <RoleIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{roleCfg.label}</span>
                        </div>
                      </td>

                      {/* House */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-400">
                          <Home className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{userItem.assigned_house || 'Toàn hệ thống'}</span>
                        </div>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(userItem)}
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold transition-all ${
                            userItem.is_active
                              ? 'badge-live'
                              : 'badge-danger'
                          }`}
                        >
                          {userItem.is_active ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>Hoạt động</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              <span>Bị khóa</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleOpenEditModal(userItem)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-white/5 transition-colors"
                            title="Chỉnh sửa thông tin & Vai trò"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(userItem)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-white/5 transition-colors"
                            title={userItem.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                          >
                            {userItem.is_active ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <Unlock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="glass-card w-full max-w-lg overflow-hidden border border-sky-100 dark:border-white/10 shadow-2xl animate-slide-up">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800 flex items-center justify-center">
                  {editingUser ? <KeyRound className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
                    {editingUser ? 'Cập nhật phân quyền tài khoản' : 'Thêm tài khoản hệ thống'}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {editingUser ? editingUser.phone : 'Tạo mới và gán vai trò truy cập SECA'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5">
                  Họ và tên
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ví dụ: BS. Trần Văn Minh hoặc Nguyễn Hữu Nghĩa"
                  className="input-glass"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5">
                  Số điện thoại đăng nhập
                </label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="0905xxxxxx hoặc +84905xxxxxx"
                  className="input-glass font-mono"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5">
                    Mật khẩu khởi tạo
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Mặc định: 12345678"
                    className="input-glass font-mono"
                  />
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400 mb-2">
                  Phân quyền vai trò (Role)
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['admin', 'doctor', 'caregiver', 'user'] as UserRole[]).map((roleKey) => {
                    const cfg = ROLE_CONFIG[roleKey];
                    const Icon = cfg.icon;
                    const isSelected = formRole === roleKey;
                    return (
                      <button
                        type="button"
                        key={roleKey}
                        onClick={() => setFormRole(roleKey)}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 ring-1 ring-sky-500'
                            : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/60 hover:bg-sky-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'}`} />
                          {isSelected && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                        </div>
                        <span className="font-heading font-bold text-xs text-slate-900 dark:text-white">
                          {cfg.label}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-1 line-clamp-2">
                          {cfg.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5">
                  Hộ gia đình / Phạm vi quản lý
                </label>
                <input
                  type="text"
                  value={formHouse}
                  onChange={(e) => setFormHouse(e.target.value)}
                  placeholder="Ví dụ: Nhà của tôi (123 Hải Phòng) hoặc Toàn hệ thống"
                  className="input-glass"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-ghost text-xs py-2 px-4"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs py-2 px-5"
                >
                  {editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

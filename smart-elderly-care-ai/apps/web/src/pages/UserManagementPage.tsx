// src/pages/UserManagementPage.tsx
// Phân hệ 1: Quản lý người dùng & Phân quyền (User Management & Role/Permission Rules)
// Thiết kế: Chia rõ Chủ nhà (Owner) & Thành viên (Member); Bổ sung Tạo & Chỉnh sửa Rule về quyền.
// Theme: Glassmorphism + Dual Light/Dark OLED Support · High density table & KPI cards

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  RefreshCw,
  Plus,
  Sliders,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { User, UserRole, PermissionRule } from '../types';
import { usersApi } from '../services/api';
import { RoleManager } from '../components/RoleManager';
import {
  ROLE_CONFIG,
  INITIAL_PERMISSION_RULES,
  UserStatsCards,
  UserFilterBar,
  UserTable,
  CreateEditUserModal,
  CreateEditRuleModal,
  UserPermissionModal,
} from '../components/user-management';

export const UserManagementPage: React.FC = () => {
  // Quản lý tab chính: Danh sách tài khoản vs Quy tắc phân quyền (Rules)
  const [activeMainTab, setActiveMainTab] = useState<'accounts' | 'rules'>('accounts');

  // Danh sách người dùng
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  // Quản lý danh sách Rules phân quyền
  const [rules, setRules] = useState<PermissionRule[]>(() => {
    try {
      const saved = localStorage.getItem('seca_permission_rules');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_PERMISSION_RULES;
  });

  // Lưu rules vào localStorage khi có thay đổi
  useEffect(() => {
    try {
      localStorage.setItem('seca_permission_rules', JSON.stringify(rules));
    } catch {
      // ignore
    }
  }, [rules]);

  // Modal State cho User
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form User State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('owner');
  const [formHouse, setFormHouse] = useState('');

  // Modal State cho Rule (Tạo / Sửa Rule về quyền)
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<PermissionRule | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [ruleTargetRole, setRuleTargetRole] = useState<UserRole | 'all'>('user');
  const [ruleModule, setRuleModule] = useState<string>('all');
  const [rulePermissions, setRulePermissions] = useState<string[]>([]);
  const [ruleIsActive, setRuleIsActive] = useState<boolean>(true);

  // Modal State kiểm tra quyền người dùng cụ thể
  const [userPermissionModal, setUserPermissionModal] = useState<User | null>(null);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  // Fetch users từ backend
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch {
      showNotice('error', 'Lỗi khi kết nối máy chủ tải danh sách tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Lọc người dùng
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.phone.includes(searchQuery) ||
        (u.assigned_house && u.assigned_house.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesRole = true;
      if (selectedRole !== 'all') {
        if (selectedRole === 'owner') {
          matchesRole = u.role === 'user' || (u.role as string) === 'owner';
        } else if (selectedRole === 'member') {
          matchesRole = u.role === 'caregiver' || (u.role as string) === 'member';
        } else {
          matchesRole = u.role === selectedRole;
        }
      }

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, selectedRole]);

  // Thống kê KPIs
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.is_active).length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const doctors = users.filter((u) => u.role === 'doctor').length;
    const owners = users.filter((u) => u.role === 'user' || (u.role as string) === 'owner').length;
    const members = users.filter((u) => u.role === 'caregiver' || (u.role as string) === 'member').length;
    const elderly = users.filter((u) => u.role === 'elderly').length;

    return { total, active, admins, doctors, owners, members, elderly };
  }, [users]);

  // Handlers cho User
  const handleOpenCreateUserModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormPhone('');
    setFormPassword('');
    setFormRole('owner');
    setFormHouse('');
    setIsModalOpen(true);
  };

  const handleOpenEditUserModal = (userItem: User) => {
    setEditingUser(userItem);
    setFormName(userItem.full_name);
    setFormPhone(userItem.phone);
    setFormPassword('');
    setFormRole(userItem.role);
    setFormHouse(userItem.assigned_house || '');
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser && (!formPassword || formPassword.length < 8)) {
      showNotice('error', 'Mật khẩu khởi tạo phải có tối thiểu 8 ký tự theo chính sách an ninh.');
      return;
    }
    const cleanPhone = formPhone.trim();
    if (!/^(0|\+84)[3|5|7|8|9][0-9]{8}$/.test(cleanPhone) && !/^\+?[0-9]{9,15}$/.test(cleanPhone)) {
      showNotice('error', 'Định dạng số điện thoại không hợp lệ.');
      return;
    }

    try {
      if (editingUser) {
        const updated = await usersApi.update(editingUser.id, {
          full_name: formName.trim(),
          phone: cleanPhone,
          role: formRole,
          assigned_house: formHouse.trim(),
        });
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        showNotice('success', `Đã cập nhật thông tin tài khoản [${formName}]`);
      } else {
        const created = await usersApi.create({
          full_name: formName.trim(),
          phone: cleanPhone,
          password: formPassword,
          role: formRole,
          assigned_house: formHouse.trim(),
        });
        setUsers((prev) => [created, ...prev]);
        showNotice('success', `Đã tạo tài khoản thành công cho [${formName}]`);
      }
      setIsModalOpen(false);
    } catch {
      showNotice('error', 'Thao tác không thành công. Vui lòng kiểm tra lại số điện thoại.');
    }
  };

  const handleToggleUserStatus = async (userItem: User) => {
    if (userItem.role === 'admin') {
      showNotice('error', 'Không thể khóa tài khoản Quản trị viên hệ thống.');
      return;
    }
    const newStatus = !userItem.is_active;
    try {
      await usersApi.update(userItem.id, { is_active: newStatus });
      setUsers((prev) =>
        prev.map((u) => (u.id === userItem.id ? { ...u, is_active: newStatus } : u))
      );
      showNotice(
        'success',
        `Đã ${newStatus ? 'kích hoạt lại' : 'khóa tạm thời'} tài khoản [${userItem.full_name}]`
      );
    } catch {
      showNotice('error', 'Lỗi khi cập nhật trạng thái hoạt động.');
    }
  };

  const handleDeleteUser = async (userItem: User) => {
    if (userItem.role === 'admin') {
      showNotice('error', 'Không thể xóa tài khoản Quản trị viên cấp cao!');
      return;
    }
    if (confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản "${userItem.full_name}"?`)) {
      try {
        await usersApi.delete(userItem.id);
        setUsers((prev) => prev.filter((u) => u.id !== userItem.id));
        showNotice('success', `Đã xóa tài khoản [${userItem.full_name}]`);
      } catch {
        showNotice('error', 'Không thể xóa tài khoản này.');
      }
    }
  };

  // Handlers cho Rule
  const handleOpenCreateRuleModal = () => {
    setEditingRule(null);
    setRuleName('');
    setRuleDescription('');
    setRuleTargetRole('user');
    setRuleModule('all');
    setRulePermissions([
      'camera.view',
      'camera.talk',
      'vitals.view',
      'emergency.push',
      'emergency.ack',
    ]);
    setRuleIsActive(true);
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) {
      showNotice('error', 'Vui lòng nhập tên Rule phân quyền');
      return;
    }

    if (editingRule) {
      setRules((prev) =>
        prev.map((r) =>
          r.id === editingRule.id
            ? {
                ...r,
                name: ruleName.trim(),
                description: ruleDescription.trim(),
                target_role: ruleTargetRole,
                module: ruleModule as any,
                permissions: rulePermissions,
                is_active: ruleIsActive,
                updated_at: new Date().toISOString(),
              }
            : r
        )
      );
      showNotice('success', `Đã cập nhật quy tắc phân quyền [${ruleName}]`);
    } else {
      const newRule: PermissionRule = {
        id: `rule-${Date.now()}`,
        name: ruleName.trim(),
        description: ruleDescription.trim(),
        target_role: ruleTargetRole,
        module: ruleModule as any,
        permissions: rulePermissions,
        is_active: ruleIsActive,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setRules((prev) => [newRule, ...prev]);
      showNotice('success', `Đã tạo mới quy tắc phân quyền [${ruleName}]`);
    }
    setIsRuleModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-2xl border border-slate-700 dark:border-slate-200 animate-slide-left">
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Phân hệ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF723B] via-[#F05A24] to-[#C73C0A] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(240,90,36,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] border border-white/20 shrink-0">
            <Users className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-[#191B20] dark:text-[#F5F6F8]">
              Quản lý Người Dùng & Phân Quyền
            </h1>
            <p className="text-xs text-[#737780] dark:text-[#A1A7B1] mt-0.5">
              Điều phối tài khoản, phân định vai trò Bác sĩ, Người thân và thiết lập ma trận Rule quyền hạn
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="btn-secondary"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          {activeMainTab === 'accounts' ? (
            <button
              onClick={handleOpenCreateUserModal}
              className="btn-primary"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>Thêm tài khoản</span>
            </button>
          ) : (
            <button
              onClick={handleOpenCreateRuleModal}
              className="btn-primary"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Tạo Rule quyền mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-[#E7E9ED] dark:border-[#454A53] pb-1">
        <button
          onClick={() => setActiveMainTab('accounts')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
            activeMainTab === 'accounts'
              ? 'bg-[#FFF0E8] dark:bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/30 shadow-2xs'
              : 'text-[#737780] dark:text-[#A1A7B1] hover:text-[#191B20] dark:hover:text-[#F5F6F8]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Danh sách tài khoản ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveMainTab('rules')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
            activeMainTab === 'rules'
              ? 'bg-[#FFF0E8] dark:bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/30 shadow-2xs'
              : 'text-[#737780] dark:text-[#A1A7B1] hover:text-[#191B20] dark:hover:text-[#F5F6F8]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Vai trò & Phân quyền ({rules.length} Policies)</span>
        </button>
      </div>

      {/* TAB 1: DANH SÁCH TÀI KHOẢN */}
      {activeMainTab === 'accounts' && (
        <div className="space-y-4 animate-fade-in">
          {/* KPI Summary Cards */}
          <UserStatsCards stats={stats} />

          {/* Search & Filter Bar */}
          <UserFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedRole={selectedRole}
            onRoleChange={setSelectedRole}
            totalUsers={users.length}
            stats={stats}
          />

          {/* User Data Table */}
          <UserTable
            users={filteredUsers}
            onInspectPermissions={(u) => setUserPermissionModal(u)}
            onEditUser={handleOpenEditUserModal}
            onToggleStatus={handleToggleUserStatus}
            onDeleteUser={handleDeleteUser}
          />
        </div>
      )}

      {/* TAB 2: VAI TRÒ & PHÂN QUYỀN (ROLE MANAGER UI) */}
      {activeMainTab === 'rules' && (
        <div className="space-y-4 animate-fade-in">
          <RoleManager
            users={users}
            onBackToAccounts={() => setActiveMainTab('accounts')}
            onNotice={showNotice}
          />
        </div>
      )}

      {/* MODAL 1: THÊM / SỬA TÀI KHOẢN */}
      <CreateEditUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingUser={editingUser}
        formName={formName}
        setFormName={setFormName}
        formPhone={formPhone}
        setFormPhone={setFormPhone}
        formPassword={formPassword}
        setFormPassword={setFormPassword}
        formRole={formRole}
        setFormRole={setFormRole}
        formHouse={formHouse}
        setFormHouse={setFormHouse}
        onSubmit={handleSaveUser}
      />

      {/* MODAL 2: TẠO / CHỈNH SỬA RULE VỀ QUYỀN */}
      <CreateEditRuleModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        editingRule={editingRule}
        ruleName={ruleName}
        setRuleName={setRuleName}
        ruleDescription={ruleDescription}
        setRuleDescription={setRuleDescription}
        ruleTargetRole={ruleTargetRole}
        setRuleTargetRole={setRuleTargetRole}
        ruleModule={ruleModule}
        setRuleModule={setRuleModule}
        rulePermissions={rulePermissions}
        setRulePermissions={setRulePermissions}
        ruleIsActive={ruleIsActive}
        setRuleIsActive={setRuleIsActive}
        onSubmit={handleSaveRule}
      />

      {/* MODAL 3: XEM & KIỂM TRA QUYỀN RIÊNG CHO MỘT NGƯỜI DÙNG */}
      <UserPermissionModal
        user={userPermissionModal}
        rules={rules}
        onClose={() => setUserPermissionModal(null)}
        onNavigateToRulesTab={() => setActiveMainTab('rules')}
      />
    </div>
  );
};

export default UserManagementPage;

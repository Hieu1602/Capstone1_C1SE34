// src/pages/UserManagementPage.tsx
// Phân hệ 1: Quản lý người dùng & Phân quyền (User Management & Role/Permission Rules)
// Thiết kế: Chia rõ Chủ nhà (Owner) & Thành viên (Member); Bổ sung Tạo & Chỉnh sửa Rule về quyền.
// Nghiệp vụ Admin: Tra cứu, Khóa/Mở khóa có lý do, Phiên đăng nhập & Thiết bị, Quản trị tài khoản ngủ đông.

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  RefreshCw,
  Plus,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Moon,
  Smartphone,
  ShieldAlert,
  LogOut,
  Trash2,
  Lock,
  Unlock,
  Clock,
  Eye,
  AlertTriangle,
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
  ConfirmActionModal,
} from '../components/user-management';

export const UserManagementPage: React.FC = () => {
  // Quản lý tab chính: Danh sách tài khoản vs Quy tắc phân quyền vs Tài khoản ngủ đông
  const [activeMainTab, setActiveMainTab] = useState<'accounts' | 'rules' | 'dormant'>('accounts');

  // Danh sách người dùng & bộ lọc
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDormancy, setSelectedDormancy] = useState<string>('all');

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

  // Modal State cho Rule
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

  // Modal State Khóa / Mở khóa thủ công có lý do (Nghiệp vụ 2)
  const [statusModalUser, setStatusModalUser] = useState<User | null>(null);
  const [statusReason, setStatusReason] = useState<string>('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState<boolean>(false);

  // Modal State Phiên đăng nhập & Thiết bị (Nghiệp vụ 5)
  const [terminalsUser, setTerminalsUser] = useState<User | null>(null);
  const [terminalsList, setTerminalsList] = useState<any[]>([]);
  const [loadingTerminals, setLoadingTerminals] = useState<boolean>(false);

  // Modal State Xóa người dùng có lý do
  const [deleteModalUser, setDeleteModalUser] = useState<User | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [isSubmittingDelete, setIsSubmittingDelete] = useState<boolean>(false);

  // Tab Ngủ đông State (Nghiệp vụ 3)
  const [dormantLevel, setDormantLevel] = useState<'3m' | '6m' | '1y'>('3m');
  const [dormantData, setDormantData] = useState<{ level: string; threshold_days: number; count: number; items: User[] } | null>(null);
  const [loadingDormant, setLoadingDormant] = useState<boolean>(false);
  const [dormantBatchAction, setDormantBatchAction] = useState<'remind' | 'lock' | 'delete' | null>(null);
  const [dormantBatchReason, setDormantBatchReason] = useState<string>('');
  const [dormantConfirmStep, setDormantConfirmStep] = useState<1 | 2>(1);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState<boolean>(false);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  // Fetch users từ backend
  const fetchUsers = async (forceRefresh: boolean = false) => {
    setLoading(true);
    try {
      const data = await usersApi.list(forceRefresh);
      const userList = Array.isArray(data) ? data : ((data as any)?.items || []);
      setUsers(userList);
    } catch (err) {
      console.error('[UserManagement] fetchUsers error:', err);
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
        (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
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

      let matchesStatus = true;
      if (selectedStatus !== 'all') {
        const uStatus = u.status || (u.is_active ? 'active' : 'locked_admin');
        matchesStatus = uStatus === selectedStatus;
      }

      let matchesDormancy = true;
      if (selectedDormancy !== 'all') {
        matchesDormancy = u.dormancy_level === selectedDormancy;
      }

      return matchesSearch && matchesRole && matchesStatus && matchesDormancy;
    });
  }, [users, searchQuery, selectedRole, selectedStatus, selectedDormancy]);

  // Thống kê KPIs
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => (u.status ? u.status === 'active' : u.is_active)).length;
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
    if (editingUser && formPassword && formPassword.length < 8) {
      showNotice('error', 'Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }
    const cleanPhone = formPhone.trim();
    if (!/^(0|\+84)[3|5|7|8|9][0-9]{8}$/.test(cleanPhone) && !/^\+?[0-9]{9,15}$/.test(cleanPhone)) {
      showNotice('error', 'Định dạng số điện thoại không hợp lệ.');
      return;
    }

    try {
      if (editingUser) {
        const updatePayload: any = {
          full_name: formName.trim(),
          phone: cleanPhone,
          role: formRole,
          assigned_house: formHouse.trim(),
        };
        if (formPassword && formPassword.trim()) {
          updatePayload.password = formPassword.trim();
        }
        const updated = await usersApi.update(editingUser.id, updatePayload);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        showNotice(
          'success',
          `Đã cập nhật thông tin tài khoản [${formName}]${formPassword ? ' (kèm đổi mật khẩu thành công)' : ''}`
        );
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

  // Khóa / Mở khóa người dùng có lý do
  const handleOpenStatusModal = (userItem: User) => {
    if (userItem.role === 'admin') {
      showNotice('error', 'Ràng buộc: Không thể khóa tài khoản Quản trị viên hệ thống.');
      return;
    }
    setStatusModalUser(userItem);
    setStatusReason('');
  };

  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalUser) return;
    if (!statusReason.trim()) {
      showNotice('error', 'Bắt buộc nhập lý do khi thay đổi trạng thái khóa/mở khóa.');
      return;
    }

    const currentStatus = statusModalUser.status || (statusModalUser.is_active ? 'active' : 'locked_admin');
    const targetStatus = currentStatus === 'active' ? 'locked_admin' : 'active';

    setIsSubmittingStatus(true);
    try {
      const updated = await usersApi.updateStatus(statusModalUser.id, targetStatus, statusReason.trim());
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      showNotice(
        'success',
        `Đã ${targetStatus === 'active' ? 'mở khóa' : 'khóa'} tài khoản [${statusModalUser.full_name}] thành công.`
      );
      setStatusModalUser(null);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Lỗi khi cập nhật trạng thái tài khoản.';
      showNotice('error', msg);
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Xem phiên đăng nhập & Thiết bị (Terminals)
  const handleOpenTerminals = async (userItem: User) => {
    setTerminalsUser(userItem);
    setLoadingTerminals(true);
    try {
      const list = await usersApi.getTerminals(userItem.id);
      setTerminalsList(list);
    } catch {
      showNotice('error', 'Lỗi khi tải danh sách thiết bị đầu cuối.');
    } finally {
      setLoadingTerminals(false);
    }
  };

  const handleRevokeTerminal = async (terminalId: string) => {
    if (!terminalsUser) return;
    try {
      await usersApi.revokeTerminal(terminalsUser.id, terminalId);
      setTerminalsList((prev) => prev.filter((t) => t.id !== terminalId));
      showNotice('success', 'Đã thu hồi quyền truy cập của thiết bị này.');
    } catch {
      showNotice('error', 'Lỗi khi thu hồi thiết bị.');
    }
  };

  const handleLogoutAllTerminals = async () => {
    if (!terminalsUser) return;
    try {
      await usersApi.logoutAll(terminalsUser.id);
      setTerminalsList([]);
      showNotice('success', `Đã đăng xuất toàn bộ thiết bị của [${terminalsUser.full_name}] và gửi cảnh báo an ninh.`);
    } catch {
      showNotice('error', 'Lỗi khi đăng xuất toàn bộ thiết bị.');
    }
  };

  // Xóa tài khoản có kiểm tra ràng buộc & lý do
  const handleOpenDeleteModal = (userItem: User) => {
    if (userItem.role === 'admin') {
      showNotice('error', 'Ràng buộc: Không thể xóa tài khoản Quản trị viên cấp cao!');
      return;
    }
    if (userItem.can_delete === false) {
      showNotice('error', `Không thể xóa: ${userItem.cannot_delete_reason || 'Ràng buộc an toàn ngăn chặn xóa.'}`);
      return;
    }
    setDeleteModalUser(userItem);
    setDeleteReason('');
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteModalUser) return;
    if (!deleteReason.trim()) {
      showNotice('error', 'Bắt buộc nhập lý do xóa tài khoản để lưu vết Audit Log.');
      return;
    }

    setIsSubmittingDelete(true);
    try {
      await usersApi.delete(deleteModalUser.id, deleteReason.trim());
      setUsers((prev) => prev.filter((u) => u.id !== deleteModalUser.id));
      showNotice('success', `Đã xóa vĩnh viễn tài khoản [${deleteModalUser.full_name}] thành công!`);
      setDeleteModalUser(null);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Không thể xóa tài khoản này.';
      showNotice('error', msg);
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Quản trị tài khoản ngủ đông
  const handlePreviewDormant = async (level: '3m' | '6m' | '1y') => {
    setDormantLevel(level);
    setLoadingDormant(true);
    try {
      const res = await usersApi.previewDormant(level);
      setDormantData(res);
    } catch {
      showNotice('error', 'Lỗi khi tải danh sách tài khoản ngủ đông.');
    } finally {
      setLoadingDormant(false);
    }
  };

  useEffect(() => {
    if (activeMainTab === 'dormant') {
      handlePreviewDormant(dormantLevel);
    }
  }, [activeMainTab]);

  const handleOpenBatchModal = (action: 'remind' | 'lock' | 'delete') => {
    if (!dormantData || dormantData.count === 0) {
      showNotice('error', 'Không có tài khoản nào trong danh sách ngủ đông để thao tác.');
      return;
    }
    setDormantBatchAction(action);
    setDormantBatchReason('');
    setDormantConfirmStep(1);
  };

  const handleExecuteBatchAction = async () => {
    if (!dormantBatchAction) return;
    if (!dormantBatchReason.trim()) {
      showNotice('error', 'Bắt buộc nhập lý do cho thao tác hàng loạt.');
      return;
    }

    setIsSubmittingBatch(true);
    try {
      const res = await usersApi.batchActionDormant(dormantLevel, dormantBatchAction, dormantBatchReason.trim());
      showNotice('success', `Thành công: Đã xử lý ${res.processed_count} tài khoản (${dormantBatchAction}).`);
      setDormantBatchAction(null);
      handlePreviewDormant(dormantLevel);
      fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Lỗi khi thực hiện thao tác hàng loạt.';
      showNotice('error', msg);
    } finally {
      setIsSubmittingBatch(false);
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
              Tra cứu phân cấp, khóa/mở khóa an ninh, quản trị phiên đăng nhập & xử lý tài khoản ngủ đông
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => fetchUsers(true)}
            disabled={loading}
            className="btn-secondary"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          {activeMainTab === 'accounts' && (
            <button onClick={handleOpenCreateUserModal} className="btn-primary">
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>Thêm tài khoản</span>
            </button>
          )}

          {activeMainTab === 'rules' && (
            <button onClick={handleOpenCreateRuleModal} className="btn-primary">
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
          onClick={() => setActiveMainTab('dormant')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
            activeMainTab === 'dormant'
              ? 'bg-[#FFF0E8] dark:bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/30 shadow-2xs'
              : 'text-[#737780] dark:text-[#A1A7B1] hover:text-[#191B20] dark:hover:text-[#F5F6F8]'
          }`}
        >
          <Moon className="w-4 h-4" />
          <span>Tài khoản ngủ đông & Nhà hoang</span>
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
          <UserStatsCards stats={stats} />

          <UserFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedRole={selectedRole}
            onRoleChange={setSelectedRole}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            selectedDormancy={selectedDormancy}
            onDormancyChange={setSelectedDormancy}
            totalUsers={users.length}
            stats={stats}
          />

          <UserTable
            users={filteredUsers}
            onInspectPermissions={(u) => setUserPermissionModal(u)}
            onEditUser={handleOpenEditUserModal}
            onToggleStatus={handleOpenStatusModal}
            onDeleteUser={handleOpenDeleteModal}
            onViewTerminals={handleOpenTerminals}
          />
        </div>
      )}

      {/* TAB 2: TÀI KHOẢN NGỦ ĐÔNG & NHÀ HOANG */}
      {activeMainTab === 'dormant' && (
        <div className="space-y-6 animate-fade-in">
          {/* Level Selector & Action Header */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#1E2024] border border-[#E7E9ED] dark:border-[#2E3238] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#191B20] dark:text-[#F5F6F8] flex items-center gap-2">
                <Moon className="w-5 h-5 text-indigo-500" />
                Bộ lọc tài khoản ngủ đông theo mốc thời gian
              </h2>
              <p className="text-xs text-[#737780] dark:text-[#A1A7B1] mt-1">
                Tự động loại trừ Admin và Owner có nhà/thiết bị hoạt động. Tính theo lần đăng nhập cuối (hoặc ngày tạo).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePreviewDormant('3m')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all ${
                  dormantLevel === '3m'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-[#F3F4F6] dark:bg-[#2A2D33] text-[#737780] dark:text-[#A1A7B1]'
                }`}
              >
                &gt; 3 tháng (Nhắc nhở)
              </button>
              <button
                onClick={() => handlePreviewDormant('6m')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all ${
                  dormantLevel === '6m'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'bg-[#F3F4F6] dark:bg-[#2A2D33] text-[#737780] dark:text-[#A1A7B1]'
                }`}
              >
                &gt; 6 tháng (Khóa)
              </button>
              <button
                onClick={() => handlePreviewDormant('1y')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all ${
                  dormantLevel === '1y'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-[#F3F4F6] dark:bg-[#2A2D33] text-[#737780] dark:text-[#A1A7B1]'
                }`}
              >
                &gt; 1 năm (Đủ đ/k xóa)
              </button>
            </div>
          </div>

          {/* Dormant Preview Results */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#1E2024] border border-[#E7E9ED] dark:border-[#2E3238] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E9ED] dark:border-[#2E3238]">
              <div>
                <span className="text-xs uppercase tracking-wider font-mono text-[#737780] dark:text-[#A1A7B1]">
                  Kết quả quét ({dormantData?.threshold_days || 90} ngày không hoạt động)
                </span>
                <div className="text-xl font-bold text-[#191B20] dark:text-[#F5F6F8] mt-0.5">
                  Phát hiện <span className="text-[#FF6B35] font-mono">{dormantData?.count ?? 0}</span> tài khoản ngủ đông
                </div>
              </div>

              {dormantData && dormantData.count > 0 && (
                <div className="flex items-center gap-2">
                  {dormantLevel === '3m' && (
                    <button
                      onClick={() => handleOpenBatchModal('remind')}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Gửi nhắc nhở hàng loạt
                    </button>
                  )}
                  {dormantLevel === '6m' && (
                    <button
                      onClick={() => handleOpenBatchModal('lock')}
                      className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Khóa hàng loạt ({dormantData.count})
                    </button>
                  )}
                  {dormantLevel === '1y' && (
                    <button
                      onClick={() => handleOpenBatchModal('delete')}
                      className="px-3.5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa vĩnh viễn hàng loạt ({dormantData.count})
                    </button>
                  )}
                </div>
              )}
            </div>

            {loadingDormant ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 text-[#737780]">
                <RefreshCw className="w-6 h-6 animate-spin text-[#FF6B35]" />
                <span className="text-xs">Đang quét phân tích tài khoản ngủ đông...</span>
              </div>
            ) : !dormantData || dormantData.items.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#737780] dark:text-[#A1A7B1]">
                Không có tài khoản nào thuộc diện ngủ đông tại mốc thời gian này.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E7E9ED] dark:border-[#2E3238] text-[#737780] dark:text-[#A1A7B1] font-mono">
                      <th className="py-2.5 px-3">Tài khoản</th>
                      <th className="py-2.5 px-3">Vai trò</th>
                      <th className="py-2.5 px-3">Đăng nhập cuối</th>
                      <th className="py-2.5 px-3">Trạng thái</th>
                      <th className="py-2.5 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E9ED] dark:divide-[#2E3238]">
                    {dormantData.items.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-[#191B20] dark:text-[#F5F6F8]">{u.full_name}</div>
                          <div className="text-[11px] font-mono text-[#737780] dark:text-[#A1A7B1]">{u.phone}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md font-mono text-[10px] uppercase font-bold bg-[#F3F4F6] dark:bg-[#2A2D33] text-[#737780]">
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-[#737780] dark:text-[#A1A7B1]">
                          {u.last_login_at
                            ? new Date(u.last_login_at).toLocaleDateString('vi-VN')
                            : `Tạo: ${new Date(u.created_at).toLocaleDateString('vi-VN')}`}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            {u.status || (u.is_active ? 'active' : 'locked')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleOpenStatusModal(u)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            Khóa / Mở
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: VAI TRÒ & PHÂN QUYỀN (ROLE MANAGER UI) */}
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

      {/* MODAL 4: KHÓA / MỞ KHÓA THỦ CÔNG CÓ LÝ DO (Nghiệp vụ 2) */}
      {statusModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#1E2024] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7E9ED] dark:border-[#2E3238] space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  statusModalUser.status === 'locked_admin' || !statusModalUser.is_active
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-rose-500/10 text-rose-500'
                }`}
              >
                {statusModalUser.status === 'locked_admin' || !statusModalUser.is_active ? (
                  <Unlock className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#191B20] dark:text-[#F5F6F8]">
                  {statusModalUser.status === 'locked_admin' || !statusModalUser.is_active
                    ? 'Mở khóa tài khoản'
                    : 'Khóa tài khoản thủ công'}
                </h3>
                <p className="text-xs text-[#737780] dark:text-[#A1A7B1]">
                  Tài khoản: <span className="font-semibold">{statusModalUser.full_name}</span> ({statusModalUser.phone})
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmStatusChange} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#191B20] dark:text-[#F5F6F8] mb-1.5">
                  Lý do {statusModalUser.status === 'locked_admin' || !statusModalUser.is_active ? 'mở khóa' : 'khóa'}{' '}
                  <span className="text-rose-500">* (Bắt buộc để ghi Audit Log)</span>
                </label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Ví dụ: Vi phạm chính sách an ninh / Đã hoàn tất xác minh người dùng..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-[#E7E9ED] dark:border-[#2E3238] bg-transparent text-[#191B20] dark:text-[#F5F6F8] focus:outline-none focus:border-[#FF6B35]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusModalUser(null)}
                  disabled={isSubmittingStatus}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#E7E9ED] dark:border-[#2E3238] text-[#737780] hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStatus}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xs ${
                    statusModalUser.status === 'locked_admin' || !statusModalUser.is_active
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSubmittingStatus ? 'Đang lưu...' : 'Xác nhận thực hiện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: PHIÊN ĐĂNG NHẬP & THIẾT BỊ ĐẦU CUỐI (Nghiệp vụ 5) */}
      {terminalsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#1E2024] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E7E9ED] dark:border-[#2E3238] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#191B20] dark:text-[#F5F6F8]">Thiết bị & Phiên hoạt động</h3>
                  <p className="text-xs text-[#737780] dark:text-[#A1A7B1]">
                    {terminalsUser.full_name} ({terminalsUser.phone})
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogoutAllTerminals}
                className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5"
                title="Tăng token_version để vô hiệu hóa tức thì toàn bộ token đã cấp"
              >
                <LogOut className="w-3.5 h-3.5" />
                Đăng xuất tất cả
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 py-2">
              {loadingTerminals ? (
                <div className="py-8 text-center text-xs text-[#737780] flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#FF6B35]" />
                  <span>Đang truy xuất thông tin thiết bị...</span>
                </div>
              ) : terminalsList.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#737780]">
                  Chưa ghi nhận thiết bị nào đang duy trì phiên đăng nhập.
                </div>
              ) : (
                terminalsList.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl border border-[#E7E9ED] dark:border-[#2E3238] flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-xs text-[#191B20] dark:text-[#F5F6F8]">
                        {t.device_type || 'Thiết bị di động'}
                      </div>
                      <div className="text-[11px] font-mono text-[#737780] dark:text-[#A1A7B1] flex items-center gap-2 mt-0.5">
                        <span>IP: {t.ip_address || 'Chưa ghi nhận'}</span>
                        <span>•</span>
                        <span>
                          Lần cuối: {t.last_active_at ? new Date(t.last_active_at).toLocaleString('vi-VN') : 'Mới đây'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeTerminal(t.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      Thu hồi
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#E7E9ED] dark:border-[#2E3238]">
              <button
                onClick={() => setTerminalsUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#E7E9ED] dark:border-[#2E3238] text-[#737780]"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: XÓA TÀI KHOẢN CÓ LÝ DO (Audit Log bắt buộc) */}
      {deleteModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#1E2024] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7E9ED] dark:border-[#2E3238] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#191B20] dark:text-[#F5F6F8]">Xác nhận xóa tài khoản</h3>
                <p className="text-xs text-[#737780] dark:text-[#A1A7B1]">
                  Xóa vĩnh viễn: <span className="font-semibold">{deleteModalUser.full_name}</span> ({deleteModalUser.phone})
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmDelete} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#191B20] dark:text-[#F5F6F8] mb-1.5">
                  Lý do xóa <span className="text-rose-500">* (Bắt buộc ghi nhận kiểm toán)</span>
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Ví dụ: Người dùng yêu cầu hủy tài khoản sau thời gian dài ngủ đông..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-[#E7E9ED] dark:border-[#2E3238] bg-transparent text-[#191B20] dark:text-[#F5F6F8] focus:outline-none focus:border-[#FF6B35]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalUser(null)}
                  disabled={isSubmittingDelete}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#E7E9ED] dark:border-[#2E3238] text-[#737780]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDelete}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs"
                >
                  {isSubmittingDelete ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: XÁC NHẬN 2 BƯỚC THAO TÁC HÀNG LOẠT TÀI KHOẢN NGỦ ĐÔNG */}
      {dormantBatchAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#1E2024] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7E9ED] dark:border-[#2E3238] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#191B20] dark:text-[#F5F6F8]">
                  Thao tác hàng loạt: {dormantBatchAction.toUpperCase()}
                </h3>
                <p className="text-xs text-[#737780] dark:text-[#A1A7B1]">
                  Áp dụng cho <span className="font-bold text-[#FF6B35]">{dormantData?.count}</span> tài khoản ngủ đông
                </p>
              </div>
            </div>

            {dormantConfirmStep === 1 ? (
              <div className="space-y-4">
                <p className="text-xs text-[#737780] dark:text-[#A1A7B1]">
                  Bạn đang chuẩn bị thực hiện hành động{' '}
                  <span className="font-bold text-rose-500">[{dormantBatchAction}]</span> trên {dormantData?.count} tài
                  khoản. Vui lòng nhập lý do để ghi Audit Log.
                </p>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[#191B20] dark:text-[#F5F6F8]">
                    Lý do thao tác hàng loạt <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={dormantBatchReason}
                    onChange={(e) => setDormantBatchReason(e.target.value)}
                    placeholder="Ví dụ: Định kỳ dọn dẹp tài khoản ngủ đông theo quy chế 2026..."
                    rows={3}
                    className="w-full text-xs p-3 rounded-xl border border-[#E7E9ED] dark:border-[#2E3238] bg-transparent focus:outline-none focus:border-[#FF6B35]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setDormantBatchAction(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#E7E9ED] dark:border-[#2E3238] text-[#737780]"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      if (!dormantBatchReason.trim()) {
                        showNotice('error', 'Vui lòng nhập lý do trước khi tiếp tục.');
                        return;
                      }
                      setDormantConfirmStep(2);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF6B35] text-white"
                  >
                    Bước 2: Xác nhận cuối cùng
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
                  <strong>CẢNH BÁO BƯỚC 2:</strong> Hành động này sẽ thay đổi trạng thái của hàng loạt tài khoản ngay lập
                  tức. Bạn có chắc chắn muốn tiến hành không?
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setDormantConfirmStep(1)}
                    disabled={isSubmittingBatch}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#E7E9ED] dark:border-[#2E3238] text-[#737780]"
                  >
                    Quay lại
                  </button>
                  <button
                    onClick={handleExecuteBatchAction}
                    disabled={isSubmittingBatch}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    {isSubmittingBatch ? 'Đang thực thi...' : 'Tôi xác nhận thực hiện'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;

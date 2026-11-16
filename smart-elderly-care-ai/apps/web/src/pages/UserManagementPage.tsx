// src/pages/UserManagementPage.tsx
// Phân hệ: Quản lý người dùng & Phân quyền (User Management & Role/Permission Rules)
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
} from 'lucide-react';
import { User, UserRole, PermissionRule } from '../types';
import { usersApi } from '../services/api';
import { RoleManager } from '../components/RoleManager';
import {
  INITIAL_PERMISSION_RULES,
  UserStatsCards,
  UserFilterBar,
  UserTable,
  CreateEditUserModal,
  CreateEditRuleModal,
  UserPermissionModal,
  StatusReasonModal,
  UserTerminalsModal,
  DeleteUserModal,
  DormantBatchModal,
  DormantAccountsTab,
} from '../components/user-management';

export const UserManagementPage: React.FC = () => {
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

  // Modal State Khóa / Mở khóa thủ công có lý do
  const [statusModalUser, setStatusModalUser] = useState<User | null>(null);
  const [statusReason, setStatusReason] = useState<string>('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState<boolean>(false);

  // Modal State Phiên đăng nhập & Thiết bị
  const [terminalsUser, setTerminalsUser] = useState<User | null>(null);
  const [terminalsList, setTerminalsList] = useState<any[]>([]);
  const [loadingTerminals, setLoadingTerminals] = useState<boolean>(false);

  // Modal State Xóa người dùng có lý do
  const [deleteModalUser, setDeleteModalUser] = useState<User | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [isSubmittingDelete, setIsSubmittingDelete] = useState<boolean>(false);

  // Tab Ngủ đông State
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
    const q = searchQuery.toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        u.full_name.toLowerCase().includes(q) ||
        u.phone.includes(searchQuery) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.assigned_house && u.assigned_house.toLowerCase().includes(q));

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

      const uStatus = u.status || (u.is_active ? 'active' : 'locked_admin');
      const matchesStatus = selectedStatus === 'all' || uStatus === selectedStatus;
      const matchesDormancy = selectedDormancy === 'all' || u.dormancy_level === selectedDormancy;

      return matchesSearch && matchesRole && matchesStatus && matchesDormancy;
    });
  }, [users, searchQuery, selectedRole, selectedStatus, selectedDormancy]);

  // Thống kê KPIs
  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => (u.status ? u.status === 'active' : u.is_active)).length,
      admins: users.filter((u) => u.role === 'admin').length,
      doctors: users.filter((u) => u.role === 'doctor').length,
      owners: users.filter((u) => u.role === 'user' || (u.role as string) === 'owner').length,
      members: users.filter((u) => u.role === 'caregiver' || (u.role as string) === 'member').length,
      elderly: users.filter((u) => u.role === 'elderly').length,
    };
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
    const targetUser = statusModalUser;
    const prevUsers = [...users];

    // Optimistic Update
    setStatusModalUser(null);
    setUsers((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, status: targetStatus, is_active: targetStatus === 'active' } : u))
    );
    showNotice(
      'success',
      `Đã ${targetStatus === 'active' ? 'mở khóa' : 'khóa'} tài khoản [${targetUser.full_name}] thành công.`
    );

    setIsSubmittingStatus(true);
    try {
      const updated = await usersApi.updateStatus(targetUser.id, targetStatus, statusReason.trim());
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err: any) {
      setUsers(prevUsers);
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

    const targetUser = deleteModalUser;
    const prevUsers = [...users];

    // Optimistic Update
    setDeleteModalUser(null);
    setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
    showNotice('success', `Đã xóa vĩnh viễn tài khoản [${targetUser.full_name}] thành công!`);

    setIsSubmittingDelete(true);
    try {
      await usersApi.delete(targetUser.id, deleteReason.trim());
    } catch (err: any) {
      setUsers(prevUsers);
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

    const now = new Date().toISOString();
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
                updated_at: now,
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
        created_at: now,
        updated_at: now,
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
      <div className="flex items-center space-x-2 border-b border-[#E7E9ED] dark:border-[#454A53] pb-1 overflow-x-auto">
        {[
          { key: 'accounts' as const, label: `Danh sách tài khoản (${users.length})`, icon: Users },
          { key: 'dormant' as const, label: 'Tài khoản ngủ đông & Nhà hoang', icon: Moon },
          { key: 'rules' as const, label: `Vai trò & Phân quyền (${rules.length} Policies)`, icon: Sliders },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeMainTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveMainTab(tab.key)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#FFF0E8] dark:bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/30 shadow-2xs'
                  : 'text-[#737780] dark:text-[#A1A7B1] hover:text-[#191B20] dark:hover:text-[#F5F6F8]'
              }`}
            >
              <TabIcon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
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
        <DormantAccountsTab
          dormantLevel={dormantLevel}
          dormantData={dormantData}
          loadingDormant={loadingDormant}
          onSelectLevel={handlePreviewDormant}
          onOpenBatchModal={handleOpenBatchModal}
          onOpenStatusModal={handleOpenStatusModal}
        />
      )}

      {/* TAB 3: VAI TRÒ & PHÂN QUYỀN */}
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

      {/* MODAL 3: XEM & KIỂM TRA QUYỀN RIÊNG */}
      <UserPermissionModal
        user={userPermissionModal}
        rules={rules}
        onClose={() => setUserPermissionModal(null)}
        onNavigateToRulesTab={() => setActiveMainTab('rules')}
      />

      {/* MODAL 4: KHÓA / MỞ KHÓA THỦ CÔNG CÓ LÝ DO */}
      <StatusReasonModal
        user={statusModalUser}
        reason={statusReason}
        onReasonChange={setStatusReason}
        isSubmitting={isSubmittingStatus}
        onClose={() => setStatusModalUser(null)}
        onConfirm={handleConfirmStatusChange}
      />

      {/* MODAL 5: PHIÊN ĐĂNG NHẬP & THIẾT BỊ ĐẦU CUỐI */}
      <UserTerminalsModal
        user={terminalsUser}
        terminalsList={terminalsList}
        loading={loadingTerminals}
        onClose={() => setTerminalsUser(null)}
        onRevokeTerminal={handleRevokeTerminal}
        onLogoutAll={handleLogoutAllTerminals}
      />

      {/* MODAL 6: XÓA TÀI KHOẢN CÓ LÝ DO */}
      <DeleteUserModal
        user={deleteModalUser}
        reason={deleteReason}
        onReasonChange={setDeleteReason}
        isSubmitting={isSubmittingDelete}
        onClose={() => setDeleteModalUser(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* MODAL 7: XÁC NHẬN 2 BƯỚC THAO TÁC HÀNG LOẠT */}
      <DormantBatchModal
        action={dormantBatchAction}
        count={dormantData?.count || 0}
        reason={dormantBatchReason}
        onReasonChange={setDormantBatchReason}
        step={dormantConfirmStep}
        onNextStep={() => {
          if (!dormantBatchReason.trim()) {
            showNotice('error', 'Vui lòng nhập lý do trước khi tiếp tục.');
            return;
          }
          setDormantConfirmStep(2);
        }}
        onPrevStep={() => setDormantConfirmStep(1)}
        isSubmitting={isSubmittingBatch}
        onClose={() => setDormantBatchAction(null)}
        onExecute={handleExecuteBatchAction}
      />
    </div>
  );
};

export default UserManagementPage;

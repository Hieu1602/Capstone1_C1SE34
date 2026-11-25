import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, PermissionRule } from '../../types';
import { usersApi } from '../../services/api';
import { INITIAL_PERMISSION_RULES } from './constants';

export const useUserManagement = () => {
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
  const [dormantData, setDormantData] = useState<{
    level: string;
    threshold_days: number;
    count: number;
    items: User[];
  } | null>(null);
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
      const userList = Array.isArray(data) ? data : (data as any)?.items || [];
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
  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => (u.status ? u.status === 'active' : u.is_active)).length,
      admins: users.filter((u) => u.role === 'admin').length,
      doctors: users.filter((u) => u.role === 'doctor').length,
      owners: users.filter((u) => u.role === 'user' || (u.role as string) === 'owner').length,
      members: users.filter((u) => u.role === 'caregiver' || (u.role as string) === 'member').length,
      elderly: users.filter((u) => u.role === 'elderly').length,
    }),
    [users]
  );

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
      showNotice('error', err.response?.data?.detail || 'Lỗi khi cập nhật trạng thái tài khoản.');
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
      showNotice('error', err.response?.data?.detail || 'Không thể xóa tài khoản này.');
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
      showNotice('error', err.response?.data?.detail || 'Lỗi khi thực hiện thao tác hàng loạt.');
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
    setRulePermissions(['camera.view', 'camera.talk', 'vitals.view', 'emergency.push', 'emergency.ack']);
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

  return {
    activeMainTab,
    setActiveMainTab,
    users,
    filteredUsers,
    loading,
    stats,
    searchQuery,
    setSearchQuery,
    selectedRole,
    setSelectedRole,
    selectedStatus,
    setSelectedStatus,
    selectedDormancy,
    setSelectedDormancy,
    rules,
    notification,
    showNotice,
    fetchUsers,
    // User modal
    isModalOpen,
    setIsModalOpen,
    editingUser,
    formName,
    setFormName,
    formPhone,
    setFormPhone,
    formPassword,
    setFormPassword,
    formRole,
    setFormRole,
    formHouse,
    setFormHouse,
    handleOpenCreateUserModal,
    handleOpenEditUserModal,
    handleSaveUser,
    // Rule modal
    isRuleModalOpen,
    setIsRuleModalOpen,
    editingRule,
    ruleName,
    setRuleName,
    ruleDescription,
    setRuleDescription,
    ruleTargetRole,
    setRuleTargetRole,
    ruleModule,
    setRuleModule,
    rulePermissions,
    setRulePermissions,
    ruleIsActive,
    setRuleIsActive,
    handleOpenCreateRuleModal,
    handleSaveRule,
    // Permission inspect modal
    userPermissionModal,
    setUserPermissionModal,
    // Status modal
    statusModalUser,
    setStatusModalUser,
    statusReason,
    setStatusReason,
    isSubmittingStatus,
    handleOpenStatusModal,
    handleConfirmStatusChange,
    // Terminals modal
    terminalsUser,
    setTerminalsUser,
    terminalsList,
    loadingTerminals,
    handleOpenTerminals,
    handleRevokeTerminal,
    handleLogoutAllTerminals,
    // Delete modal
    deleteModalUser,
    setDeleteModalUser,
    deleteReason,
    setDeleteReason,
    isSubmittingDelete,
    handleOpenDeleteModal,
    handleConfirmDelete,
    // Dormant tab & batch modal
    dormantLevel,
    dormantData,
    loadingDormant,
    dormantBatchAction,
    setDormantBatchAction,
    dormantBatchReason,
    setDormantBatchReason,
    dormantConfirmStep,
    setDormantConfirmStep,
    isSubmittingBatch,
    handlePreviewDormant,
    handleOpenBatchModal,
    handleExecuteBatchAction,
  };
};

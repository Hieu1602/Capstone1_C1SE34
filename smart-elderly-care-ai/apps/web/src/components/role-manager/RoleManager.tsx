import React, { useState, useMemo, useEffect } from 'react';
import { Eye, Edit2, RotateCcw, X, AlertTriangle } from 'lucide-react';
import { SystemRole, RoleManagerProps, RoleViewMode, RoleDetailTab, PermissionCategory } from './types';
import { DEFAULT_SYSTEM_ROLES } from './constants';
import { RoleListView } from './RoleListView';
import { RoleSidebar } from './RoleSidebar';
import { RoleDisplayTab } from './RoleDisplayTab';
import { RolePermissionsTab } from './RolePermissionsTab';
import { RoleMembersTab } from './RoleMembersTab';
import { RoleUnsavedFloatingBar } from './RoleUnsavedFloatingBar';
import { ConfirmActionModal } from '../user-management/ConfirmActionModal';

export const RoleManager: React.FC<RoleManagerProps> = ({
  users,
  onBackToAccounts,
  onNotice,
}) => {
  // Chế độ xem: 'list' (Danh sách) | 'detail' (Xem chi tiết) | 'edit' (Chỉnh sửa)
  const [viewMode, setViewMode] = useState<RoleViewMode>('list');

  // Quản lý mở menu 3 chấm (Dropdown action)
  const [openMenuRoleId, setOpenMenuRoleId] = useState<string | null>(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleGlobalClick = () => setOpenMenuRoleId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Danh sách vai trò lưu trữ
  const [roles, setRoles] = useState<SystemRole[]>(() => {
    try {
      const saved = localStorage.getItem('seca_system_roles');
      if (saved) {
        const parsed: SystemRole[] = JSON.parse(saved);
        const clean = parsed.filter(
          (r) => r.id !== 'role-nurse' && r.id !== 'role-technician'
        );
        if (clean.length > 0) return clean;
      }
    } catch {
      // ignore
    }
    return DEFAULT_SYSTEM_ROLES;
  });

  // Lưu vào localStorage khi roles thay đổi
  useEffect(() => {
    try {
      localStorage.setItem('seca_system_roles', JSON.stringify(roles));
    } catch {
      // ignore
    }
  }, [roles]);

  // ID của vai trò đang được chọn trong Master-Detail Pane
  const [selectedRoleId, setSelectedRoleId] = useState<string>('role-admin');

  // Tìm kiếm vai trò ở Danh sách
  const [roleSearchQuery, setRoleSearchQuery] = useState<string>('');

  // Tìm kiếm quyền hạn ở Chi tiết & Chỉnh sửa
  const [permSearchQuery, setPermSearchQuery] = useState<string>('');

  // Tìm kiếm & Bộ lọc tài khoản trong tab Quản lý thành viên
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<string>('current');

  // Tab bên phải trong Master-Detail: 'display' | 'permissions' | 'members'
  const [activeRightTab, setActiveRightTab] = useState<RoleDetailTab>('permissions');

  // Form nháp tạm thời (Draft State) cho vai trò đang chỉnh sửa
  const [draftRole, setDraftRole] = useState<SystemRole | null>(null);

  // States xác nhận thao tác
  const [confirmDeleteRole, setConfirmDeleteRole] = useState<SystemRole | null>(null);
  const [pendingAction, setPendingAction] = useState<
    | { type: 'selectRole'; role: SystemRole }
    | { type: 'backToList' }
    | { type: 'cancelEdit' }
    | null
  >(null);

  // Tìm vai trò hiện tại
  const currentRole = useMemo(() => {
    return roles.find((r) => r.id === selectedRoleId) || roles[0];
  }, [roles, selectedRoleId]);

  // Khởi tạo draftRole khi chuyển vai trò hoặc vào chế độ edit
  useEffect(() => {
    if (currentRole) {
      setDraftRole(JSON.parse(JSON.stringify(currentRole)));
    }
  }, [selectedRoleId, roles]);

  // Kiểm tra xem người dùng có thay đổi chưa lưu (isDirty)
  const isDirty = useMemo(() => {
    if (!draftRole || !currentRole) return false;
    if (viewMode !== 'edit') return false;
    const sameName = draftRole.name === currentRole.name;
    const sameColor = draftRole.color === currentRole.color;
    const sameDesc = draftRole.description === currentRole.description;
    const sameHoist = !!draftRole.hoist === !!currentRole.hoist;
    const samePerms =
      draftRole.permissions.length === currentRole.permissions.length &&
      draftRole.permissions.every((p) => currentRole.permissions.includes(p));
    return !(sameName && sameColor && sameDesc && sameHoist && samePerms);
  }, [draftRole, currentRole, viewMode]);

  // Handlers
  const handleInspectRole = (role: SystemRole) => {
    setSelectedRoleId(role.id);
    setDraftRole(JSON.parse(JSON.stringify(role)));
    setActiveRightTab('permissions');
    setViewMode('detail');
  };

  const handleEditRole = (role: SystemRole) => {
    setSelectedRoleId(role.id);
    setDraftRole(JSON.parse(JSON.stringify(role)));
    setActiveRightTab('permissions');
    setViewMode('edit');
  };

  const handleCreateNewRole = () => {
    const newId = `role-${Date.now()}`;
    const newRole: SystemRole = {
      id: newId,
      name: 'vai trò mới',
      color: '#ec4899',
      is_system: false,
      target_role: 'caregiver',
      description: 'Vai trò tùy chỉnh mới được tạo. Vui lòng thiết lập quyền truy cập.',
      hoist: false,
      permissions: ['camera.view', 'vitals.view'],
    };

    const updated = [...roles, newRole];
    setRoles(updated);
    setSelectedRoleId(newId);
    setDraftRole(JSON.parse(JSON.stringify(newRole)));
    setActiveRightTab('display');
    setViewMode('edit');

    if (onNotice) {
      onNotice('success', 'Đã tạo vai trò mới thành công! Bạn có thể chỉnh sửa tên, màu và quyền hạn.');
    }
  };

  const handleDeleteRole = (roleId: string) => {
    const target = roles.find((r) => r.id === roleId);
    if (!target) return;
    if (target.is_system) {
      if (onNotice) onNotice('error', 'Không thể xóa vai trò mặc định của hệ thống SECA!');
      return;
    }
    setConfirmDeleteRole(target);
  };

  const executeDeleteRole = () => {
    if (!confirmDeleteRole) return;
    const remaining = roles.filter((r) => r.id !== confirmDeleteRole.id);
    setRoles(remaining);
    setSelectedRoleId(remaining[0]?.id || 'role-admin');
    setViewMode('list');
    if (onNotice) onNotice('success', `Đã xóa vai trò "${confirmDeleteRole.name}" thành công!`);
    setConfirmDeleteRole(null);
  };

  const handleConfirmPendingAction = (save: boolean) => {
    if (!pendingAction) return;
    if (save) {
      handleSaveChanges();
    } else {
      handleResetChanges();
    }
    if (pendingAction.type === 'selectRole') {
      setSelectedRoleId(pendingAction.role.id);
      setDraftRole(JSON.parse(JSON.stringify(pendingAction.role)));
      setViewMode('detail');
    } else if (pendingAction.type === 'backToList') {
      setViewMode('list');
    } else if (pendingAction.type === 'cancelEdit') {
      setViewMode('detail');
    }
    setPendingAction(null);
  };

  const handleCloneRole = (role: SystemRole) => {
    const cloneId = `role-${Date.now()}`;
    const clonedRole: SystemRole = {
      ...role,
      id: cloneId,
      name: `${role.name} (Bản sao)`,
      is_system: false,
    };
    setRoles([...roles, clonedRole]);
    setSelectedRoleId(cloneId);
    setDraftRole(JSON.parse(JSON.stringify(clonedRole)));
    setViewMode('edit');
    if (onNotice) onNotice('success', `Đã nhân bản vai trò "${role.name}"!`);
  };

  const handleTogglePermission = (permId: string) => {
    if (!draftRole || viewMode !== 'edit') return;
    const currentPerms = new Set(draftRole.permissions);
    if (currentPerms.has(permId)) {
      currentPerms.delete(permId);
    } else {
      currentPerms.add(permId);
    }
    setDraftRole({
      ...draftRole,
      permissions: Array.from(currentPerms),
    });
  };

  const handleToggleCategoryPermissions = (cat: PermissionCategory, enableAll: boolean) => {
    if (!draftRole || viewMode !== 'edit') return;
    const currentPerms = new Set(draftRole.permissions);
    cat.permissions.forEach((p) => {
      if (enableAll) {
        currentPerms.add(p.id);
      } else {
        currentPerms.delete(p.id);
      }
    });
    setDraftRole({
      ...draftRole,
      permissions: Array.from(currentPerms),
    });
  };

  const handleSaveChanges = () => {
    if (!draftRole) return;
    const updated = roles.map((r) => (r.id === draftRole.id ? draftRole : r));
    setRoles(updated);
    setViewMode('detail');
    if (onNotice) {
      onNotice('success', `Đã lưu các thay đổi cho vai trò "${draftRole.name}"!`);
    }
  };

  const handleResetChanges = () => {
    if (currentRole) {
      setDraftRole(JSON.parse(JSON.stringify(currentRole)));
    }
    setViewMode('detail');
  };

  const handleUpdateDraft = (updates: Partial<SystemRole>) => {
    if (!draftRole) return;
    setDraftRole({ ...draftRole, ...updates });
  };

  // VIEW 1: Danh sách tổng quan
  if (viewMode === 'list') {
    return (
      <>
        <RoleListView
          roles={roles}
          users={users}
          searchQuery={roleSearchQuery}
          onSearchChange={setRoleSearchQuery}
          onCreateNewRole={handleCreateNewRole}
          onInspectRole={handleInspectRole}
          onEditRole={handleEditRole}
          onCloneRole={handleCloneRole}
          onDeleteRole={handleDeleteRole}
          openMenuRoleId={openMenuRoleId}
          onToggleMenu={(e, roleId) => {
            e.stopPropagation();
            setOpenMenuRoleId(openMenuRoleId === roleId ? null : roleId);
          }}
        />

        {/* Modal xác nhận xóa vai trò */}
        <ConfirmActionModal
          isOpen={!!confirmDeleteRole}
          type="delete"
          title="Xác nhận xóa vai trò"
          message={`Bạn có chắc chắn muốn xóa vai trò "${confirmDeleteRole?.name}" không? Thao tác này sẽ xóa quy tắc phân quyền đã gán cho vai trò này.`}
          confirmLabel="Xóa vai trò"
          cancelLabel="Hủy bỏ"
          onConfirm={executeDeleteRole}
          onCancel={() => setConfirmDeleteRole(null)}
        />
      </>
    );
  }

  // VIEW 2 & 3: Master-Detail
  return (
    <div className="relative space-y-4 animate-fade-in pb-20">
      <div className="glass-card border border-slate-200 dark:border-[#454A53] rounded-2xl bg-white/95 dark:bg-[#17191E] overflow-hidden shadow-xl grid grid-cols-1 md:grid-cols-12 min-h-[700px]">
        {/* Cột trái */}
        <RoleSidebar
          roles={roles}
          selectedRoleId={selectedRoleId}
          onSelectRole={(role) => {
            if (isDirty) {
              setPendingAction({ type: 'selectRole', role });
            } else {
              setSelectedRoleId(role.id);
              setDraftRole(JSON.parse(JSON.stringify(role)));
              setViewMode('detail');
            }
          }}
          onBackToList={() => {
            if (isDirty) {
              setPendingAction({ type: 'backToList' });
            } else {
              setViewMode('list');
            }
          }}
          onCreateNewRole={handleCreateNewRole}
          onDeleteRole={handleDeleteRole}
        />

        {/* Cột phải */}
        <div className="md:col-span-8 lg:col-span-9 p-5 sm:p-6 flex flex-col justify-between">
          <div className="space-y-5">
            {/* Header Cột Phải */}
            <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-[#454A53]">
              <div className="flex items-center gap-3">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: draftRole?.color || currentRole.color }}
                />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F5F6F8] flex items-center gap-2">
                  <span>
                    {viewMode === 'edit' ? 'Sửa đổi Vai trò' : 'Chi tiết Vai trò'} –{' '}
                    {draftRole?.name || currentRole.name}
                  </span>
                </h2>
                {viewMode === 'detail' ? (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-[#202329] text-slate-600 dark:text-[#A1A7B1] border border-slate-200 dark:border-[#454A53]">
                    <Eye className="w-3 h-3 text-slate-400" />
                    Chế độ xem (Chỉ đọc)
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    <Edit2 className="w-3 h-3 text-amber-500" />
                    Đang chỉnh sửa
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {viewMode === 'detail' ? (
                  <button
                    type="button"
                    onClick={() => setViewMode('edit')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 active:bg-amber-700 shadow-md shadow-amber-600/20 transition-all cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Chỉnh sửa vai trò</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (isDirty) {
                        setPendingAction({ type: 'cancelEdit' });
                      } else {
                        setViewMode('detail');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-[#F5F6F8] bg-slate-100 hover:bg-slate-200 dark:bg-[#202329] dark:hover:bg-[#292D34] border border-slate-200 dark:border-[#454A53] transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Hủy chỉnh sửa</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (isDirty) {
                      setPendingAction({ type: 'backToList' });
                    } else {
                      setViewMode('list');
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-[#F5F6F8] hover:bg-slate-100 dark:hover:bg-[#202329] transition-colors cursor-pointer"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Banner vai trò hệ thống cốt lõi */}
            {currentRole.is_system && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs leading-relaxed animate-fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">
                    Vai trò này được quản lý bởi hệ thống SECA cốt lõi ({currentRole.name}).
                  </p>
                  <p className="mt-0.5 text-slate-600 dark:text-amber-200/80">
                    Không thể phân công vai trò này cho các thành viên theo cách thủ công bất hợp lệ hoặc xóa vai trò này.
                    Các quyền cơ bản được bảo vệ để đảm bảo an toàn y tế và tính năng cứu hộ SOS.
                  </p>
                </div>
              </div>
            )}

            {/* Sub-Tabs: Hiển thị | Quyền hạn | Quản lý thành viên */}
            <div className="flex items-center gap-6 border-b border-slate-200 dark:border-[#454A53] text-xs font-bold">
              <button
                onClick={() => setActiveRightTab('display')}
                className={`pb-2.5 transition-all cursor-pointer ${
                  activeRightTab === 'display'
                    ? 'text-sky-500 dark:text-[#FF6B35] border-b-2 border-sky-500 dark:border-[#FF6B35]'
                    : 'text-slate-500 dark:text-[#A1A7B1] hover:text-slate-900 dark:hover:text-[#F5F6F8]'
                }`}
              >
                Hiển thị
              </button>
              <button
                onClick={() => setActiveRightTab('permissions')}
                className={`pb-2.5 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeRightTab === 'permissions'
                    ? 'text-sky-500 dark:text-[#FF6B35] border-b-2 border-sky-500 dark:border-[#FF6B35]'
                    : 'text-slate-500 dark:text-[#A1A7B1] hover:text-slate-900 dark:hover:text-[#F5F6F8]'
                }`}
              >
                <span>Quyền hạn</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-100 text-sky-700 dark:bg-[#FF6B35]/20 dark:text-[#FF8A50] font-mono">
                  {draftRole?.permissions.length || 0}
                </span>
              </button>
              <button
                onClick={() => setActiveRightTab('members')}
                className={`pb-2.5 transition-all cursor-pointer ${
                  activeRightTab === 'members'
                    ? 'text-sky-500 dark:text-[#FF6B35] border-b-2 border-sky-500 dark:border-[#FF6B35]'
                    : 'text-slate-500 dark:text-[#A1A7B1] hover:text-slate-900 dark:hover:text-[#F5F6F8]'
                }`}
              >
                Quản lý thành viên
              </button>
            </div>

            {/* Nội dung theo Tab */}
            {activeRightTab === 'display' && draftRole && (
              <RoleDisplayTab
                draftRole={draftRole}
                isEditMode={viewMode === 'edit'}
                onUpdateDraft={handleUpdateDraft}
              />
            )}

            {activeRightTab === 'permissions' && draftRole && (
              <RolePermissionsTab
                draftRole={draftRole}
                isEditMode={viewMode === 'edit'}
                searchQuery={permSearchQuery}
                onSearchChange={setPermSearchQuery}
                onTogglePermission={handleTogglePermission}
                onToggleCategoryPermissions={handleToggleCategoryPermissions}
              />
            )}

            {activeRightTab === 'members' && (
              <RoleMembersTab
                currentRole={currentRole}
                users={users}
                memberSearchQuery={memberSearchQuery}
                onSearchChange={setMemberSearchQuery}
                memberRoleFilter={memberRoleFilter}
                onFilterChange={setMemberRoleFilter}
              />
            )}
          </div>
        </div>
      </div>

      {/* Floating Save Bar */}
      <RoleUnsavedFloatingBar
        isVisible={isDirty}
        onReset={handleResetChanges}
        onSave={handleSaveChanges}
      />

      {/* Modal xác nhận xóa vai trò */}
      <ConfirmActionModal
        isOpen={!!confirmDeleteRole}
        type="delete"
        title="Xác nhận xóa vai trò"
        message={`Bạn có chắc chắn muốn xóa vai trò "${confirmDeleteRole?.name}" không? Thao tác này sẽ xóa quy tắc phân quyền đã gán cho vai trò này.`}
        confirmLabel="Xóa vai trò"
        cancelLabel="Hủy bỏ"
        onConfirm={executeDeleteRole}
        onCancel={() => setConfirmDeleteRole(null)}
      />

      {/* Modal xác nhận khi chuyển trang / hủy mà có thay đổi chưa lưu */}
      <ConfirmActionModal
        isOpen={!!pendingAction}
        type="unsaved"
        title="Bạn có thay đổi chưa lưu"
        message="Cấu hình quyền hạn của vai trò đang được chỉnh sửa. Bạn có muốn lưu thay đổi trước khi tiếp tục không?"
        confirmLabel="Lưu thay đổi"
        discardLabel="Không lưu (Hủy thay đổi)"
        cancelLabel="Tiếp tục chỉnh sửa"
        onConfirm={() => handleConfirmPendingAction(true)}
        onDiscard={() => handleConfirmPendingAction(false)}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};


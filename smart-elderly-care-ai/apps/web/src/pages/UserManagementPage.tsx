// src/pages/UserManagementPage.tsx
// Phân hệ: Quản lý người dùng & Phân quyền (User Management & Role/Permission Rules)
// Thiết kế: Chia rõ Chủ nhà (Owner) & Thành viên (Member); Bổ sung Tạo & Chỉnh sửa Rule về quyền.
// Nghiệp vụ Admin: Tra cứu, Khóa/Mở khóa có lý do, Phiên đăng nhập & Thiết bị, Quản trị tài khoản ngủ đông.

import React from 'react';
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
import { RoleManager } from '../components/RoleManager';
import {
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
  useUserManagement,
} from '../components/user-management';

export const UserManagementPage: React.FC = () => {
  const vm = useUserManagement();

  const mainTabs = [
    { key: 'accounts' as const, label: `Danh sách tài khoản (${vm.users.length})`, icon: Users },
    { key: 'dormant' as const, label: 'Tài khoản ngủ đông & Nhà hoang', icon: Moon },
    { key: 'rules' as const, label: `Vai trò & Phân quyền (${vm.rules.length} Policies)`, icon: Sliders },
  ];

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Toast Notification */}
      {vm.notification && (
        <div className="fixed top-20 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-2xl border border-slate-700 dark:border-slate-200 animate-slide-left">
          {vm.notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{vm.notification.message}</span>
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
            onClick={() => vm.fetchUsers(true)}
            disabled={vm.loading}
            className="btn-secondary"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${vm.loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          {vm.activeMainTab === 'accounts' && (
            <button onClick={vm.handleOpenCreateUserModal} className="btn-primary">
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>Thêm tài khoản</span>
            </button>
          )}

          {vm.activeMainTab === 'rules' && (
            <button onClick={vm.handleOpenCreateRuleModal} className="btn-primary">
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Tạo Rule quyền mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-[#E7E9ED] dark:border-[#454A53] pb-1 overflow-x-auto">
        {mainTabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = vm.activeMainTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => vm.setActiveMainTab(tab.key)}
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
      {vm.activeMainTab === 'accounts' && (
        <div className="space-y-4 animate-fade-in">
          <UserStatsCards stats={vm.stats} />

          <UserFilterBar
            searchQuery={vm.searchQuery}
            onSearchChange={vm.setSearchQuery}
            selectedRole={vm.selectedRole}
            onRoleChange={vm.setSelectedRole}
            selectedStatus={vm.selectedStatus}
            onStatusChange={vm.setSelectedStatus}
            selectedDormancy={vm.selectedDormancy}
            onDormancyChange={vm.setSelectedDormancy}
            totalUsers={vm.users.length}
            stats={vm.stats}
          />

          <UserTable
            users={vm.filteredUsers}
            onInspectPermissions={(u) => vm.setUserPermissionModal(u)}
            onEditUser={vm.handleOpenEditUserModal}
            onToggleStatus={vm.handleOpenStatusModal}
            onDeleteUser={vm.handleOpenDeleteModal}
            onViewTerminals={vm.handleOpenTerminals}
          />
        </div>
      )}

      {/* TAB 2: TÀI KHOẢN NGỦ ĐÔNG & NHÀ HOANG */}
      {vm.activeMainTab === 'dormant' && (
        <DormantAccountsTab
          dormantLevel={vm.dormantLevel}
          dormantData={vm.dormantData}
          loadingDormant={vm.loadingDormant}
          onSelectLevel={vm.handlePreviewDormant}
          onOpenBatchModal={vm.handleOpenBatchModal}
          onOpenStatusModal={vm.handleOpenStatusModal}
        />
      )}

      {/* TAB 3: VAI TRÒ & PHÂN QUYỀN */}
      {vm.activeMainTab === 'rules' && (
        <div className="space-y-4 animate-fade-in">
          <RoleManager
            users={vm.users}
            onBackToAccounts={() => vm.setActiveMainTab('accounts')}
            onNotice={vm.showNotice}
          />
        </div>
      )}

      {/* MODAL 1: THÊM / SỬA TÀI KHOẢN */}
      <CreateEditUserModal
        isOpen={vm.isModalOpen}
        onClose={() => vm.setIsModalOpen(false)}
        editingUser={vm.editingUser}
        formName={vm.formName}
        setFormName={vm.setFormName}
        formPhone={vm.formPhone}
        setFormPhone={vm.setFormPhone}
        formPassword={vm.formPassword}
        setFormPassword={vm.setFormPassword}
        formRole={vm.formRole}
        setFormRole={vm.setFormRole}
        formHouse={vm.formHouse}
        setFormHouse={vm.setFormHouse}
        onSubmit={vm.handleSaveUser}
      />

      {/* MODAL 2: TẠO / CHỈNH SỬA RULE VỀ QUYỀN */}
      <CreateEditRuleModal
        isOpen={vm.isRuleModalOpen}
        onClose={() => vm.setIsRuleModalOpen(false)}
        editingRule={vm.editingRule}
        ruleName={vm.ruleName}
        setRuleName={vm.setRuleName}
        ruleDescription={vm.ruleDescription}
        setRuleDescription={vm.setRuleDescription}
        ruleTargetRole={vm.ruleTargetRole}
        setRuleTargetRole={vm.setRuleTargetRole}
        ruleModule={vm.ruleModule}
        setRuleModule={vm.setRuleModule}
        rulePermissions={vm.rulePermissions}
        setRulePermissions={vm.setRulePermissions}
        ruleIsActive={vm.ruleIsActive}
        setRuleIsActive={vm.setRuleIsActive}
        onSubmit={vm.handleSaveRule}
      />

      {/* MODAL 3: XEM & KIỂM TRA QUYỀN RIÊNG */}
      <UserPermissionModal
        user={vm.userPermissionModal}
        rules={vm.rules}
        onClose={() => vm.setUserPermissionModal(null)}
        onNavigateToRulesTab={() => vm.setActiveMainTab('rules')}
      />

      {/* MODAL 4: KHÓA / MỞ KHÓA THỦ CÔNG CÓ LÝ DO */}
      <StatusReasonModal
        user={vm.statusModalUser}
        reason={vm.statusReason}
        onReasonChange={vm.setStatusReason}
        isSubmitting={vm.isSubmittingStatus}
        onClose={() => vm.setStatusModalUser(null)}
        onConfirm={vm.handleConfirmStatusChange}
      />

      {/* MODAL 5: PHIÊN ĐĂNG NHẬP & THIẾT BỊ ĐẦU CUỐI */}
      <UserTerminalsModal
        user={vm.terminalsUser}
        terminalsList={vm.terminalsList}
        loading={vm.loadingTerminals}
        onClose={() => vm.setTerminalsUser(null)}
        onRevokeTerminal={vm.handleRevokeTerminal}
        onLogoutAll={vm.handleLogoutAllTerminals}
      />

      {/* MODAL 6: XÓA TÀI KHOẢN CÓ LÝ DO */}
      <DeleteUserModal
        user={vm.deleteModalUser}
        reason={vm.deleteReason}
        onReasonChange={vm.setDeleteReason}
        isSubmitting={vm.isSubmittingDelete}
        onClose={() => vm.setDeleteModalUser(null)}
        onConfirm={vm.handleConfirmDelete}
      />

      {/* MODAL 7: XÁC NHẬN 2 BƯỚC THAO TÁC HÀNG LOẠT */}
      <DormantBatchModal
        action={vm.dormantBatchAction}
        count={vm.dormantData?.count || 0}
        reason={vm.dormantBatchReason}
        onReasonChange={vm.setDormantBatchReason}
        step={vm.dormantConfirmStep}
        onNextStep={() => {
          if (!vm.dormantBatchReason.trim()) {
            vm.showNotice('error', 'Vui lòng nhập lý do trước khi tiếp tục.');
            return;
          }
          vm.setDormantConfirmStep(2);
        }}
        onPrevStep={() => vm.setDormantConfirmStep(1)}
        isSubmitting={vm.isSubmittingBatch}
        onClose={() => vm.setDormantBatchAction(null)}
        onExecute={vm.handleExecuteBatchAction}
      />
    </div>
  );
};

export default UserManagementPage;

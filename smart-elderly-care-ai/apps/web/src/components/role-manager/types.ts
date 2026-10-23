import React from 'react';
import { User, UserRole } from '../../types';

export interface SystemRole {
  id: string;
  name: string;
  color: string;
  is_system: boolean;
  target_role: UserRole;
  description: string;
  permissions: string[];
  hoist?: boolean; // Hiển thị nhóm riêng trong danh sách
  mentionable?: boolean;
}

export interface PermissionDefinition {
  id: string;
  name: string;
  description: string;
}

export interface PermissionCategory {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  permissions: PermissionDefinition[];
}

export interface RoleColorSwatch {
  name: string;
  hex: string;
}

export interface RoleManagerProps {
  users: User[];
  onBackToAccounts?: () => void;
  onNotice?: (type: 'success' | 'error', message: string) => void;
}

export type RoleViewMode = 'list' | 'detail' | 'edit';
export type RoleDetailTab = 'display' | 'permissions' | 'members';


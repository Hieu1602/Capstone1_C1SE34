import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../theme/colors';
import { useAuthStore } from '../../../../store/useAuthStore';
import { useVitalStore } from '../../../../store/useVitalStore';

interface ProfileUserCardProps {
  displayName: string;
  avatarUri: string | null;
  isDarkMode: boolean;
  colors: any;
  onPressProfile: () => void;
  onPressAddMember: () => void;
  roleBadgeText?: string;
}

export const ProfileUserCard: React.FC<ProfileUserCardProps> = ({
  displayName,
  avatarUri,
  isDarkMode,
  colors,
  onPressProfile,
  onPressAddMember,
  roleBadgeText: propRoleText,
}) => {
  const { permissions, userRole, role, fetchMyPermissions } = useAuthStore();
  const { house, fetchHouseFromBackend } = useVitalStore();

  useEffect(() => {
    fetchMyPermissions?.();
    fetchHouseFromBackend?.();
  }, []);

  const hasLinkedHouse = Boolean(house?.id && house?.hasHouse !== false && house?.name && house.name.trim() !== '');

  const isOwner =
    hasLinkedHouse &&
    (permissions?.is_owner === true ||
      permissions?.role_in_house === 'OWNER' ||
      userRole === 'admin' ||
      role === 'admin' ||
      userRole === 'owner' ||
      role === 'owner');

  const isDoctor =
    userRole === 'doctor' ||
    role === 'doctor' ||
    permissions?.role_in_house === 'DOCTOR';

  const resolvedRoleText =
    propRoleText ||
    (isOwner
      ? 'Chủ hộ'
      : isDoctor
      ? 'Bác sĩ gia đình'
      : 'Thành viên');

  const roleIcon: keyof typeof Ionicons.glyphMap = isOwner
    ? 'ribbon'
    : isDoctor
    ? 'medkit'
    : 'person';

  const roleColor = isOwner ? '#D97706' : isDoctor ? '#2563EB' : '#EA580C';
  const roleBg = isOwner
    ? isDarkMode
      ? 'rgba(217, 119, 6, 0.2)'
      : '#FEF3C7'
    : isDoctor
    ? isDarkMode
      ? 'rgba(37, 99, 235, 0.2)'
      : '#EFF6FF'
    : isDarkMode
    ? 'rgba(234, 88, 12, 0.15)'
    : '#FFF7ED';

  return (
    <View
      style={[
        styles.fbProfileCard,
        isDarkMode && {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.fbProfileInfoRow}
        activeOpacity={0.8}
        onPress={onPressProfile}
      >
        <View style={styles.fbAvatarCircle}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.fbAvatarImg} />
          ) : (
            <Ionicons name="person" size={26} color="#FFFFFF" />
          )}
        </View>
        <View style={styles.fbNameContainer}>
          <Text
            style={[
              styles.fbProfileName,
              isDarkMode && { color: colors.textPrimary },
            ]}
          >
            {displayName}
          </Text>
          <View style={[styles.fbRoleBadgeRow, { backgroundColor: roleBg }]}>
            <Ionicons name={roleIcon} size={11} color={roleColor} />
            <Text style={[styles.fbRoleBadgeText, { color: roleColor }]}>
              {resolvedRoleText}
            </Text>
          </View>
        </View>
        <View style={styles.fbProfileRightBadge}>
          <Ionicons name="chevron-forward" size={20} color="#64748B" />
        </View>
      </TouchableOpacity>

      {isOwner && Boolean(onPressAddMember) ? (
        <>
          <View
            style={[
              styles.fbCardDivider,
              isDarkMode && { backgroundColor: colors.border },
            ]}
          />

          <TouchableOpacity
            style={styles.fbSubActionRow}
            activeOpacity={0.7}
            onPress={onPressAddMember}
          >
            <View style={styles.fbPlusCircleBtn}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </View>
            <Text
              style={[
                styles.fbSubActionText,
                isDarkMode && { color: colors.textPrimary },
              ]}
            >
              Thêm thành viên
            </Text>
          </TouchableOpacity>
        </>
      ) : !hasLinkedHouse && Boolean(onPressAddMember) ? (
        <>
          <View
            style={[
              styles.fbCardDivider,
              isDarkMode && { backgroundColor: colors.border },
            ]}
          />

          <TouchableOpacity
            style={styles.fbSubActionRow}
            activeOpacity={0.7}
            onPress={onPressAddMember}
          >
            <View style={[styles.fbPlusCircleBtn, { backgroundColor: '#4F46E5' }]}>
              <Ionicons name="link-outline" size={18} color="#FFFFFF" />
            </View>
            <Text
              style={[
                styles.fbSubActionText,
                { color: '#4F46E5', fontWeight: '700' },
              ]}
            >
              Nhập mã / Liên kết tham gia nhà
            </Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fbProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fbProfileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
  },
  fbAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fbAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  fbNameContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  
  fbRoleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  fbRoleBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#EA580C',
  },
  fbProfileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  fbProfileRightBadge: {
    padding: 4,
  },
  fbCardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 10,
  },
  fbSubActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  fbPlusCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbSubActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
});


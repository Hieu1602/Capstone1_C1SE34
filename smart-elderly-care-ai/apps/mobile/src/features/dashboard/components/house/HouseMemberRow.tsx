import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../theme/colors';

interface HouseMemberRowProps {
  member: any;
  index: number;
  isLast: boolean;
  onPress: (member: any) => void;
  onDelete?: (member: any) => void;
  isDarkMode: boolean;
  colors: {
    bgCard: string;
    borderCol: string;
    textTitle: string;
    textSub: string;
  };
}

export const HouseMemberRow: React.FC<HouseMemberRowProps> = ({
  member,
  isLast,
  onPress,
  onDelete,
  isDarkMode,
  colors: { borderCol, textTitle, textSub },
}) => {
  const isOwner = Boolean(member.is_owner || member.role_in_house === 'OWNER');
  const isDoctor =
    member.role_in_house === 'DOCTOR' ||
    member.role === 'DOCTOR' ||
    member.role === 'doctor' ||
    (member.role_in_house || '').includes('Bác sĩ');

  const roleDisplay = isOwner
    ? 'Người sở hữu'
    : isDoctor
    ? 'Bác sĩ gia đình'
    : 'Thành viên';

  const displayName = isOwner ? `${member.full_name} (Chủ hộ)` : member.full_name;

  return (
    <>
      <TouchableOpacity
        style={styles.memberCardRow}
        onPress={() => onPress(member)}
        activeOpacity={0.7}
      >
        {/* Avatar Icon */}
        <View
          style={[
            styles.memberAvatarCircle,
            {
              backgroundColor: isOwner
                ? isDarkMode
                  ? '#4A2810'
                  : '#FEF3C7'
                : isDoctor
                ? isDarkMode
                  ? '#064E3B'
                  : '#DCFCE7'
                : isDarkMode
                ? '#1E293B'
                : '#F1F5F9',
            },
          ]}
        >
          <Ionicons
            name={isOwner ? 'key' : isDoctor ? 'medkit' : 'person'}
            size={20}
            color={isOwner ? '#F59E0B' : isDoctor ? '#16A34A' : isDarkMode ? '#94A3B8' : '#64748B'}
          />
        </View>

        {/* Member Details */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.memberNameText, { color: textTitle }]}>{displayName}</Text>
            <View
              style={[
                styles.roleBadge,
                {
                  backgroundColor: isOwner
                    ? '#FEF3C7'
                    : isDoctor
                    ? '#DCFCE7'
                    : isDarkMode
                    ? '#334155'
                    : '#F1F5F9',
                },
              ]}
            >
              <Text
                style={[
                  styles.inviteRoleBadgeText,
                  { color: isOwner ? '#B45309' : isDoctor ? '#15803D' : textSub },
                ]}
              >
                {roleDisplay}
              </Text>
            </View>
          </View>

          <Text style={[styles.memberPhoneSub, { color: textSub }]}>
            {member.phone_number || '--'}
          </Text>

          {/* Permission Chips (Pills) */}
          <View style={styles.permissionPillsRow}>
            {/* 1. Camera */}
            <View
              style={[
                styles.permChip,
                member.can_view_camera !== false || isOwner
                  ? styles.permChipActive
                  : styles.permChipDisabled,
              ]}
            >
              <Ionicons
                name="videocam"
                size={12}
                color={member.can_view_camera !== false || isOwner ? '#10B981' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.permChipText,
                  { color: member.can_view_camera !== false || isOwner ? '#065F46' : '#94A3B8' },
                ]}
              >
                Camera
              </Text>
            </View>

            {/* 2. Sức khỏe */}
            <View
              style={[
                styles.permChip,
                member.can_view_health !== false || isOwner
                  ? styles.permChipActiveBlue
                  : styles.permChipDisabled,
              ]}
            >
              <Ionicons
                name="heart"
                size={12}
                color={member.can_view_health !== false || isOwner ? '#3B82F6' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.permChipText,
                  { color: member.can_view_health !== false || isOwner ? '#1E40AF' : '#94A3B8' },
                ]}
              >
                Sức khỏe
              </Text>
            </View>

            {/* 3. SOS */}
            <View
              style={[
                styles.permChip,
                member.can_handle_emergency !== false || isOwner
                  ? styles.permChipActiveRed
                  : styles.permChipDisabled,
              ]}
            >
              <Ionicons
                name="alert-circle"
                size={12}
                color={member.can_handle_emergency !== false || isOwner ? '#EF4444' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.permChipText,
                  { color: member.can_handle_emergency !== false || isOwner ? '#991B1B' : '#94A3B8' },
                ]}
              >
                SOS
              </Text>
            </View>

            {/* 4. Cấu hình thiết bị (nếu có) */}
            {(member.can_manage_devices || isOwner) && (
              <View style={[styles.permChip, styles.permChipActivePurple]}>
                <Ionicons name="settings" size={12} color="#8B5CF6" />
                <Text style={[styles.permChipText, { color: '#5B21B6' }]}>Cấu hình</Text>
              </View>
            )}
          </View>
        </View>

        {/* Nút Xóa thành viên */}
        {isOwner ? (
          <View style={styles.ownerBadgeBox}>
            <Text style={[styles.ownerBadgeText, { color: textSub }]}>Chủ hộ</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.deleteBtnBox, { backgroundColor: isDarkMode ? '#450A0A' : '#FEF2F2', borderColor: isDarkMode ? '#7F1D1D' : '#FECACA' }]}
            onPress={() => (onDelete ? onDelete(member) : onPress(member))}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={14} color="#EF4444" />
            <Text style={styles.deleteBtnText}>Xóa</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {!isLast && <View style={[styles.divider, { backgroundColor: borderCol }]} />}
    </>
  );
};

const styles = StyleSheet.create({
  memberCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  memberAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberNameText: {
    fontSize: 15,
    fontWeight: '700',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inviteRoleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  memberPhoneSub: {
    fontSize: 12,
    marginTop: 2,
  },
  permissionPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  permChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  permChipActive: {
    backgroundColor: '#D1FAE5',
  },
  permChipActiveBlue: {
    backgroundColor: '#DBEAFE',
  },
  permChipActiveRed: {
    backgroundColor: '#FEE2E2',
  },
  permChipActivePurple: {
    backgroundColor: '#EDE9FE',
  },
  permChipDisabled: {
    backgroundColor: '#E2E8F0',
    opacity: 0.6,
  },
  permChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionChevronBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 2,
  },
  permissionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ownerBadgeBox: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ownerBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 4,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  divider: {
    height: 1,
    marginHorizontal: 14,
  },
});


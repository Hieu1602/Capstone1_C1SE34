import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../theme/colors';

interface ProfileUserCardProps {
  displayName: string;
  avatarUri: string | null;
  isDarkMode: boolean;
  colors: any;
  onPressProfile: () => void;
  onPressAddMember: () => void;
}

export const ProfileUserCard: React.FC<ProfileUserCardProps> = ({
  displayName,
  avatarUri,
  isDarkMode,
  colors,
  onPressProfile,
  onPressAddMember,
}) => {
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
          <View style={styles.fbRoleBadgeRow}>
            <Ionicons name="person" size={11} color="#FF7A00" />
            <Text style={styles.fbRoleBadgeText}>Thành viên gia đình</Text>
          </View>
        </View>
        <View style={styles.fbProfileRightBadge}>
          <Ionicons name="chevron-forward" size={20} color="#64748B" />
        </View>
      </TouchableOpacity>

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


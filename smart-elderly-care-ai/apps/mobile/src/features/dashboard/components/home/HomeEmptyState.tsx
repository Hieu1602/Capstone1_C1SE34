import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../../i18n/LocalizedComponents';
import { Colors, Shadows } from '../../../../theme/colors';

interface HomeEmptyStateProps {
  isNewAccount: boolean;
  isMemberInLinkedHouse: boolean;
  canManageDevices: boolean;
  isDarkMode: boolean;
  colors: any;
  onJoinHouse: () => void;
  onAddDevice: () => void;
  onRefresh: () => void;
}

export const HomeEmptyState: React.FC<HomeEmptyStateProps> = ({
  isNewAccount,
  isMemberInLinkedHouse,
  canManageDevices,
  isDarkMode,
  colors,
  onJoinHouse,
  onAddDevice,
  onRefresh,
}) => (
  <View style={styles.emptyContainer}>
    <View style={[styles.emptyIconCircle, isDarkMode && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
      <Ionicons name="home-outline" size={54} color={isDarkMode ? '#64748B' : '#94A3B8'} />
    </View>

    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Chưa có dữ liệu theo dõi</Text>

    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
      {isNewAccount
        ? 'Tài khoản của bạn hiện chưa tham gia ngôi nhà nào. Bạn có thể nhập mã mời để tham gia nhà của người thân hoặc bấm thêm thiết bị mới.'
        : isMemberInLinkedHouse
        ? 'Tài khoản thành viên chưa có thiết bị theo dõi trong ngôi nhà này. Sau khi Chủ hộ thêm camera hoặc vòng đeo tay thông minh, hệ thống sẽ tự động hiển thị dữ liệu tại đây.'
        : 'Ngôi nhà của bạn chưa có thiết bị theo dõi nào. Hãy thêm camera an ninh hoặc vòng đeo tay thông minh để bắt đầu giám sát.'}
    </Text>

    {isNewAccount && (
      <TouchableOpacity
        style={[styles.addDevicePrimaryBtn, { backgroundColor: '#4F46E5', marginBottom: 10 }]}
        onPress={onJoinHouse}
        activeOpacity={0.88}
      >
        <Ionicons name="link-outline" size={20} color="#FFF" style={{ marginRight: 6 }} />
        <Text style={styles.addDevicePrimaryBtnText}>Nhập mã tham gia nhà</Text>
      </TouchableOpacity>
    )}

    {canManageDevices ? (
      <TouchableOpacity style={styles.addDevicePrimaryBtn} onPress={onAddDevice} activeOpacity={0.88}>
        <Ionicons name="add-circle" size={20} color="#FFF" style={{ marginRight: 6 }} />
        <Text style={styles.addDevicePrimaryBtnText}>Thêm thiết bị mới</Text>
      </TouchableOpacity>
    ) : null}

    <TouchableOpacity style={styles.refreshMemberBtn} onPress={onRefresh} activeOpacity={0.8}>
      <Ionicons name="refresh-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
      <Text style={styles.refreshMemberBtnText}>Kiểm tra & Làm mới</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  emptyContainer: { paddingTop: 32, paddingBottom: 40, alignItems: 'center', paddingHorizontal: 8 },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Shadows.soft,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { fontSize: 13.5, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16, marginBottom: 24 },
  addDevicePrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EA580C',
    paddingVertical: 13,
    paddingHorizontal: 26,
    borderRadius: 24,
    marginBottom: 12,
    ...Shadows.card,
  },
  addDevicePrimaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  refreshMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    ...Shadows.card,
  },
  refreshMemberBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

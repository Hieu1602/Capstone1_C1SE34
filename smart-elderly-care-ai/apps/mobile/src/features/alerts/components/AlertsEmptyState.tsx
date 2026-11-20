import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Colors } from '../../../theme/colors';

interface AlertsEmptyStateProps {
  loading: boolean;
  isUnassignedAccount: boolean;
  filterType: 'ALL' | 'CRITICAL' | 'VITAL' | 'MEDICATION' | 'APPOINTMENT';
  isDarkMode: boolean;
  colors: any;
  onRefresh: () => void;
}

export const AlertsEmptyState: React.FC<AlertsEmptyStateProps> = ({
  loading,
  isUnassignedAccount,
  filterType,
  isDarkMode,
  colors,
  onRefresh,
}) => {
  if (loading) {
    return (
      <View style={[styles.emptyBox, { paddingVertical: 60 }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.emptyBox}>
      {isUnassignedAccount ? (
        <>
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9' },
            ]}
          >
            <Ionicons
              name={filterType === 'MEDICATION' ? 'medical-outline' : 'videocam-off-outline'}
              size={36}
              color={isDarkMode ? '#64748B' : '#94A3B8'}
            />
          </View>
          <Text style={[styles.emptyTitle, isDarkMode && { color: colors.textPrimary }]}>Chưa có thông báo mới</Text>
          <Text style={[styles.emptySub, isDarkMode && { color: colors.textSecondary }]}>
            Tài khoản của bạn chưa được liên kết với ngôi nhà nào. Khi được Chủ hộ thêm số điện thoại vào nhà, thông báo gia nhập sẽ hiển thị tại đây.
          </Text>
          <TouchableOpacity
            style={[
              styles.refreshMemberBtn,
              isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={14} color={Colors.primary} />
            <Text style={styles.refreshMemberBtnText}>Kiểm tra lại</Text>
          </TouchableOpacity>
        </>
      ) : (
        (() => {
          const EMPTY_STATE_CONFIG: Record<string, { icon: 'calendar-outline' | 'medical' | 'shield-checkmark-outline'; color: string; bg: string; title: string; subtitle: string }> = {
            APPOINTMENT: {
              icon: 'calendar-outline',
              color: '#0284C7',
              bg: '#EFF6FF',
              title: 'Chưa có thông báo lịch khám nào',
              subtitle: 'Các lịch hẹn tái khám và nhắc lịch từ bác sĩ sẽ hiển thị tại đây.',
            },
            MEDICATION: {
              icon: 'medical',
              color: '#0284C7',
              bg: '#EFF6FF',
              title: 'Không có nhắc nhở uống thuốc nào',
              subtitle: 'Lịch nhắc uống thuốc hằng ngày của người cao tuổi đang được đồng bộ.',
            },
          };
          const cfg = EMPTY_STATE_CONFIG[filterType] ?? {
            icon: 'shield-checkmark-outline' as const,
            color: '#10B981',
            bg: '#ECFDF5',
            title: 'Không có cảnh báo bất thường nào',
            subtitle: 'Hệ thống AI đang giám sát an toàn 24/7 và mọi chỉ số sức khỏe đều trong ngưỡng chuẩn.',
          };
          return (
            <>
              <View style={[styles.emptyIconCircle, { backgroundColor: cfg.bg }]}>
                <Ionicons name={cfg.icon} size={36} color={cfg.color} />
              </View>
              <Text style={[styles.emptyTitle, isDarkMode && { color: colors.textPrimary }]}>
                {cfg.title}
              </Text>
              <Text style={[styles.emptySub, isDarkMode && { color: colors.textSecondary }]}>
                {cfg.subtitle}
              </Text>
            </>
          );
        })()
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  emptyBox: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 24, gap: 10 },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 15, color: Colors.textPrimary, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 19 },
  refreshMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFF4EC',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  refreshMemberBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
});

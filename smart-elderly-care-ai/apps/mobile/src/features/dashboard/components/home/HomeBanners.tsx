import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../../i18n/LocalizedComponents';
import { Colors, Shadows } from '../../../../theme/colors';

interface AppointmentBannerProps {
  notice: any;
  isDarkMode: boolean;
  colors: any;
  onPress: () => void;
}

export const HomeAppointmentBanner: React.FC<AppointmentBannerProps> = ({
  notice,
  isDarkMode,
  colors,
  onPress,
}) => {
  const isRequested =
    notice.notes?.includes('APPOINTMENT_REQUESTED') ||
    notice.note?.includes('APPOINTMENT_REQUESTED') ||
    notice.message?.includes('đã đặt lịch khám');

  return (
    <TouchableOpacity
      style={[
        styles.appointmentBanner,
        isDarkMode && { backgroundColor: 'rgba(217, 119, 6, 0.12)', borderColor: '#D97706' },
      ]}
      activeOpacity={0.88}
      onPress={onPress}
    >
      <View style={styles.appointmentBannerLeft}>
        <View style={[styles.appointmentIconCircle, isDarkMode && { backgroundColor: 'rgba(217, 119, 6, 0.25)' }]}>
          <Ionicons name="calendar" size={20} color="#D97706" />
        </View>
        <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 }}>
            <Text style={[styles.appointmentBannerTitle, isDarkMode && { color: '#FBBF24' }]}>
              {isRequested ? '🗓️ YÊU CẦU LỊCH KHÁM TỪ GIA ĐÌNH' : '🗓️ LỊCH KHÁM MỚI TỪ BÁC SĨ'}
            </Text>
            <View style={styles.appointmentBadge}>
              <Text style={styles.appointmentBadgeText}>
                {isRequested ? 'Chờ Bác sĩ xác nhận' : 'Chờ xác nhận'}
              </Text>
            </View>
          </View>
          <Text style={[styles.appointmentBannerSubtitle, isDarkMode && { color: colors.textSecondary }]} numberOfLines={2}>
            {notice.message}
          </Text>
        </View>
      </View>
      <View style={[styles.appointmentActionBtn, isDarkMode && { backgroundColor: 'rgba(217, 119, 6, 0.25)' }]}>
        <Text style={[styles.appointmentActionBtnText, isDarkMode && { color: '#FBBF24' }]}>Xác nhận</Text>
        <Ionicons name="chevron-forward" size={14} color="#D97706" />
      </View>
    </TouchableOpacity>
  );
};

interface EmergencyBannerProps {
  hasEmergency: boolean;
  activeEmergency: any;
  hasLinkedHouse: boolean;
  isUserEmptyMember: boolean;
  isDarkMode: boolean;
  onNavigateToEmergency: () => void;
}

export const HomeStatusBanner: React.FC<EmergencyBannerProps> = ({
  hasEmergency,
  activeEmergency,
  hasLinkedHouse,
  isUserEmptyMember,
  isDarkMode,
  onNavigateToEmergency,
}) => {
  if (hasEmergency) {
    return (
      <TouchableOpacity style={styles.emergencyBanner} activeOpacity={0.9} onPress={onNavigateToEmergency}>
        <View style={styles.emergencyBannerHeader}>
          <View style={styles.emergencySirenPulse}>
            <Ionicons name="warning" size={20} color="#FFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.emergencyBannerTitle}>🚨 CẢNH BÁO KHẨN CẤP ĐANG KÍCH HOẠT</Text>
            <Text style={styles.emergencyBannerMessage} numberOfLines={2}>
              {activeEmergency?.message || 'Phát hiện sự cố té ngã (YOLO-Pose AI). Cần kiểm tra video và xác nhận xử lý ngay!'}
            </Text>
          </View>
          <TouchableOpacity style={styles.emergencyActionBtn} onPress={onNavigateToEmergency} activeOpacity={0.8}>
            <Text style={styles.emergencyActionBtnText}>Xem & Xử lý</Text>
            <Ionicons name="chevron-forward" size={14} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  if (hasLinkedHouse && !isUserEmptyMember) {
    return (
      <View
        style={[
          styles.stableHealthCard,
          { backgroundColor: isDarkMode ? '#064E3B18' : '#F0FDF4', borderColor: isDarkMode ? '#065F46' : '#BBF7D0' },
        ]}
      >
        <View style={styles.stablePulseDot} />
        <Ionicons name="shield-checkmark" size={18} color="#16A34A" />
        <Text style={[styles.stableHealthText, { color: isDarkMode ? '#86EFAC' : '#15803D' }]}>
          Sức khoẻ ổn định • Hệ thống giám sát AI đang bảo vệ 24/7
        </Text>
      </View>
    );
  }

  return null;
};

export const HomeSosCard: React.FC<{ onPress: () => void }> = ({ onPress }) => (
  <TouchableOpacity style={styles.sosCard} onPress={onPress} activeOpacity={0.9}>
    <View style={styles.sosLeftContent}>
      <View style={styles.sosIconCircle}>
        <Ionicons name="call" size={24} color="#FFF" />
      </View>
      <View style={styles.sosTextContainer}>
        <View style={styles.sosTitleRow}>
          <Text style={styles.sosTitleText}>ONE-TOUCH SOS 115</Text>
          <View style={styles.sosTag}>
            <Text style={styles.sosTagText}>KHẨN CẤP</Text>
          </View>
        </View>
        <Text style={styles.sosSubtitleText} numberOfLines={1}>
          Báo người thân &amp; gọi cấp cứu 115
        </Text>
      </View>
    </View>
    <View style={styles.sosActionCircle}>
      <Ionicons name="arrow-forward" size={18} color={Colors.danger} />
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  appointmentBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.soft,
  },
  appointmentBannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 8 },
  appointmentIconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  appointmentBannerTitle: { fontSize: 12, fontWeight: '800', color: '#B45309', letterSpacing: 0.3 },
  appointmentBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  appointmentBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  appointmentBannerSubtitle: { fontSize: 12, color: '#475569', marginTop: 2, lineHeight: 16 },
  appointmentActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, gap: 2, flexShrink: 0 },
  appointmentActionBtnText: { fontSize: 11, fontWeight: '700', color: '#B45309' },

  emergencyBanner: { backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#EF4444', borderRadius: 16, padding: 14, marginBottom: 16, ...Shadows.card },
  emergencyBannerHeader: { flexDirection: 'row', alignItems: 'center' },
  emergencySirenPulse: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' },
  emergencyBannerTitle: { fontSize: 13, fontWeight: '800', color: '#DC2626', marginBottom: 2 },
  emergencyBannerMessage: { fontSize: 12, color: '#475569', lineHeight: 16, fontWeight: '500' },
  emergencyActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginLeft: 8, gap: 2 },
  emergencyActionBtnText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },

  stableHealthCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16, gap: 8 },
  stablePulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  stableHealthText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },

  sosCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#DC2626', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 18, borderWidth: 1.5, borderColor: '#EF4444', ...Shadows.card },
  sosLeftContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  sosIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.22)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sosTextContainer: { flex: 1 },
  sosTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sosTitleText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  sosTag: { backgroundColor: '#FFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  sosTagText: { color: '#DC2626', fontSize: 9, fontWeight: '900' },
  sosSubtitleText: { color: 'rgba(255, 255, 255, 0.92)', fontSize: 12, marginTop: 2, fontWeight: '500' },
  sosActionCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});

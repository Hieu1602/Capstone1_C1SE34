// ============================================================================
// MÀN HÌNH CÀI ĐẶT HỆ THỐNG (SETTINGS SCREEN)
// Hệ thống: Smart Elderly Care AI (SECA)
// Giao diện: Hỗ trợ linh hoạt Dark Mode / Light Mode theo chuẩn thiết kế cấp cao
// Chức năng:
//   - Quản trị hồ sơ người giám sát & Hồ sơ bệnh án người cao tuổi (Bảo mật AES-256)
//   - Tùy chỉnh chế độ giao diện Sáng / Tối toàn cục qua useTheme
//   - Cấu hình phản hồi rung thiết bị khi có cảnh báo SOS hoặc té ngã khẩn cấp
//   - Cấu hình thông báo đẩy (Push Notifications) & Thông tin phiên bản hệ thống
// ============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../store/useThemeStore';

export default function SettingsScreen({ navigation }: any) {
  // Hook trạng thái giao diện Sáng / Tối toàn cục của ứng dụng
  const { isDarkMode, colors, toggleTheme } = useTheme();

  // Trạng thái bật / tắt rung khi có thông báo & cảnh báo
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  // Trạng thái bật / tắt nhận thông báo đẩy thời gian thực
  const [notificationEnabled, setNotificationEnabled] = useState(true);

  /**
   * Hiển thị hộp thoại thông tin phiên bản và hệ thống
   */
  const handleShowAppInfo = () => {
    Alert.alert(
      'Hệ thống SECA AI',
      'Phiên bản: 1.0.0 (Bản phát hành chính thức)\n' +
      'Đồ án Capstone: Hệ thống AI giám sát và chăm sóc sức khỏe người cao tuổi.\n' +
      'Bảo vệ sức khỏe & An toàn 24/7.',
      [{ text: 'Đóng', style: 'cancel' }]
    );
  };

  /**
   * Hiển thị hộp thoại hướng dẫn cấu hình thông báo
   */
  const handleNotificationConfig = () => {
    Alert.alert(
      'Thiết lập thông báo',
      'Hệ thống tự động kích hoạt thông báo đẩy (Push Notification) thời gian thực cho các sự kiện khẩn cấp (Té ngã, Nhịp tim bất thường, SOS).',
      [
        {
          text: notificationEnabled ? 'Tắt thông báo' : 'Bật thông báo',
          onPress: () => setNotificationEnabled(!notificationEnabled),
        },
        { text: 'Đóng', style: 'cancel' },
      ]
    );
  };

  /**
   * Hiển thị thông báo trợ năng
   */
  const handleAccessibilityInfo = () => {
    Alert.alert(
      'Khả năng tiếp cận (Accessibility)',
      'Giao diện ứng dụng được tối ưu với cỡ chữ lớn, độ tương phản cao và phím bấm rộng nhằm hỗ trợ người lớn tuổi và người có thị lực kém dễ dàng thao tác.',
      [{ text: 'Đã hiểu', style: 'default' }]
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' },
      ]}
      edges={['top']}
    >
      {/* ================================================================= */}
      {/* PHẦN 1: HEADER TRÊN CÙNG (NÚT QUAY LẠI & TIÊU ĐỀ)                 */}
      {/* ================================================================= */}
      <View
        style={[
          styles.headerRow,
          {
            backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC',
            borderBottomColor: isDarkMode ? '#1E293B' : '#E2E8F0',
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backButton,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
          onPress={() => navigation?.goBack?.()}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back-outline"
            size={24}
            color={isDarkMode ? '#F8FAFC' : '#0F172A'}
          />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
          ]}
        >
          Cài đặt
        </Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ================================================================= */}
        {/* KHỐI 1: QUẢN LÝ HỒ SƠ & BỆNH ÁN NGƯỜI CAO TUỔI                   */}
        {/* ================================================================= */}
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#F1F5F9',
            },
          ]}
        >
          {/* Mục 1.1: Hồ sơ người giám sát (Tài khoản người nhà / Bác sĩ) */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => navigation?.navigate?.('Profile')}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isDarkMode ? 'rgba(255, 122, 0, 0.16)' : '#FFF7ED' },
                ]}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View>
                <Text
                  style={[
                    styles.itemTitle,
                    { color: colors.textPrimary },
                  ]}
                >
                  Hồ sơ người giám sát
                </Text>
                <Text
                  style={[
                    styles.itemSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Tài khoản người thân theo dõi, SĐT liên hệ khẩn cấp
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View
            style={[
              styles.divider,
              { backgroundColor: colors.border },
            ]}
          />

          {/* Mục 1.2: Hồ sơ bệnh án người cao tuổi (Bảo mật chuẩn y tế AES-256) */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => navigation?.navigate?.('PatientMedicalRecord')}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isDarkMode ? '#082F49' : '#E0F2FE' },
                ]}
              >
                <Ionicons
                  name="medkit-outline"
                  size={20}
                  color="#0EA5E9"
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={[
                      styles.itemTitle,
                      { color: colors.textPrimary },
                    ]}
                  >
                    Hồ sơ bệnh án người cao tuổi
                  </Text>
                  <View style={styles.aesBadge}>
                    <Text style={styles.aesBadgeText}>Bảo mật AES-256</Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.itemSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Thông tin cụ, bệnh nền, nhóm máu & đơn thuốc
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ================================================================= */}
        {/* KHỐI 2: GIAO DIỆN & TRỢ NĂNG (THEME & ACCESSIBILITY)              */}
        {/* ================================================================= */}
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#F1F5F9',
            },
          ]}
        >
          {/* Mục 2.1: Chuyển đổi Dark Mode / Chế độ ban đêm */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={toggleTheme}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isDarkMode ? '#312E81' : '#F3E8FF' },
                ]}
              >
                <Ionicons
                  name={isDarkMode ? 'moon' : 'sunny-outline'}
                  size={20}
                  color={isDarkMode ? '#A855F7' : '#9333EA'}
                />
              </View>
              <Text
                style={[
                  styles.itemTitle,
                  { color: colors.textPrimary },
                ]}
              >
                Chế độ tối (Dark Mode)
              </Text>
            </View>
            <View style={styles.itemRight}>
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: '#CBD5E1', true: '#FF7A00' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </TouchableOpacity>

          {/* Đường gạch phân cách */}
          <View
            style={[
              styles.divider,
              { backgroundColor: colors.border },
            ]}
          />

          {/* Mục 2.2: Khả năng tiếp cận & Trợ năng */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={handleAccessibilityInfo}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: colors.iconBg },
                ]}
              >
                <Ionicons
                  name="accessibility-outline"
                  size={20}
                  color={colors.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.itemTitle,
                  { color: colors.textPrimary },
                ]}
              >
                Khả năng tiếp cận
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Đường gạch phân cách */}
          <View
            style={[
              styles.divider,
              { backgroundColor: colors.border },
            ]}
          />

          {/* Mục 2.3: Thông tin ứng dụng */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={handleShowAppInfo}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: colors.iconBg },
                ]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={colors.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.itemTitle,
                  { color: colors.textPrimary },
                ]}
              >
                Thông tin ứng dụng
              </Text>
            </View>
            <View style={styles.itemRight}>
              <Text
                style={[
                  styles.subText,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                v1.0.0
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>
        </View>

        {/* ================================================================= */}
        {/* KHỐI 3: THIẾT LẬP THÔNG BÁO & PHẢN HỒI RUNG                      */}
        {/* ================================================================= */}
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#F1F5F9',
            },
          ]}
        >
          {/* Mục 3.1: Thiết lập thông báo đẩy */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={handleNotificationConfig}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: colors.iconBg },
                ]}
              >
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color={colors.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.itemTitle,
                  { color: colors.textPrimary },
                ]}
              >
                Thiết lập thông báo
              </Text>
            </View>
            <View style={styles.itemRight}>
              <Text
                style={[
                  styles.subText,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                {notificationEnabled ? 'Đang bật' : 'Đã tắt'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          {/* Đường gạch phân cách */}
          <View
            style={[
              styles.divider,
              { backgroundColor: colors.border },
            ]}
          />

          {/* Mục 3.2: Phản hồi Rung khi có báo động */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setVibrationEnabled(!vibrationEnabled)}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: colors.iconBg },
                ]}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={20}
                  color={colors.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.itemTitle,
                  { color: colors.textPrimary },
                ]}
              >
                Rung khi có cảnh báo
              </Text>
            </View>
            <View style={styles.itemRight}>
              <Text
                style={[
                  styles.subText,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                {vibrationEnabled ? 'Mở' : 'Tắt'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerRightSpacer: {
    width: 42,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 14,
  },
  cardGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  subText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginLeft: 62,
  },
  itemSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
    flexShrink: 1,
  },
  aesBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aesBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
});

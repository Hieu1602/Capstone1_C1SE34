import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ProfileSettingsAccordionProps {
  isExpanded: boolean;
  onToggle: () => void;
  isDarkMode: boolean;
  colors: any;
  onOpenNotifications: () => void;
  onOpenFontSize: () => void;
  onOpenAppearance: () => void;
  onOpenSecurityCenter: () => void;
  onOpenChangePassword: () => void;
}

export const ProfileSettingsAccordion: React.FC<ProfileSettingsAccordionProps> = ({
  isExpanded,
  onToggle,
  isDarkMode,
  colors,
  onOpenNotifications,
  onOpenFontSize,
  onOpenAppearance,
  onOpenSecurityCenter,
  onOpenChangePassword,
}) => {
  return (
    <View
      style={[
        styles.fbAccordionCard,
        isDarkMode && {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.fbAccordionHeader}
        activeOpacity={0.7}
        onPress={onToggle}
      >
        <View style={styles.fbAccordionHeaderLeft}>
          <Ionicons
            name="settings-outline"
            size={24}
            color={isDarkMode ? colors.textPrimary : '#0F172A'}
          />
          <Text
            style={[
              styles.fbAccordionTitle,
              isDarkMode && { color: colors.textPrimary },
            ]}
          >
            Cài đặt và quyền riêng tư
          </Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#64748B"
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.fbAccordionBody}>
          {/* Cài đặt thông báo & Âm thanh */}
          <TouchableOpacity
            style={styles.fbAccordionSubRow}
            activeOpacity={0.7}
            onPress={onOpenNotifications}
          >
            <View
              style={[
                styles.fbSubIconBox,
                { backgroundColor: '#FEF3C7' },
              ]}
            >
              <Ionicons
                name="notifications-outline"
                size={18}
                color="#D97706"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.fbSubRowTitle,
                  isDarkMode && { color: colors.textPrimary },
                ]}
              >
                Cài đặt thông báo & Âm thanh báo động
              </Text>
              <Text style={styles.fbSubRowSub}>
                Chuông còi hú, rung, thông báo đẩy
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </TouchableOpacity>

          <View
            style={[
              styles.fbSubDivider,
              isDarkMode && { backgroundColor: colors.border },
            ]}
          />

          {/* Kích thước chữ cho người cao tuổi */}
          <TouchableOpacity
            style={styles.fbAccordionSubRow}
            activeOpacity={0.7}
            onPress={onOpenFontSize}
          >
            <View
              style={[
                styles.fbSubIconBox,
                { backgroundColor: '#ECFDF5' },
              ]}
            >
              <Ionicons
                name="text-outline"
                size={18}
                color="#10B981"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.fbSubRowTitle,
                  isDarkMode && { color: colors.textPrimary },
                ]}
              >
                Cỡ chữ lớn (Dành cho người cao tuổi)
              </Text>
              <Text style={styles.fbSubRowSub}>
                Điều chỉnh độ phóng to chữ đọc dễ dàng
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </TouchableOpacity>

          <View
            style={[
              styles.fbSubDivider,
              isDarkMode && { backgroundColor: colors.border },
            ]}
          />

          {/* Chế độ Sáng / Tối */}
          <TouchableOpacity
            style={styles.fbAccordionSubRow}
            activeOpacity={0.7}
            onPress={onOpenAppearance}
          >
            <View
              style={[
                styles.fbSubIconBox,
                { backgroundColor: '#F1F5F9' },
              ]}
            >
              <Ionicons
                name="contrast-outline"
                size={18}
                color="#475569"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.fbSubRowTitle,
                  isDarkMode && { color: colors.textPrimary },
                ]}
              >
                Chế độ giao diện Sáng / Tối
              </Text>
              <Text style={styles.fbSubRowSub}>
                {isDarkMode
                  ? 'Đang dùng Giao diện Tối'
                  : 'Đang dùng Giao diện Sáng'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </TouchableOpacity>

          <View
            style={[
              styles.fbSubDivider,
              isDarkMode && { backgroundColor: colors.border },
            ]}
          />

          {/* Trung tâm bảo mật */}
          <TouchableOpacity
            style={styles.fbAccordionSubRow}
            activeOpacity={0.7}
            onPress={onOpenSecurityCenter}
          >
            <View
              style={[
                styles.fbSubIconBox,
                { backgroundColor: '#F0FDF4' },
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color="#16A34A"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.fbSubRowTitle,
                  isDarkMode && { color: colors.textPrimary },
                ]}
              >
                Trung tâm bảo mật
              </Text>
              <Text style={styles.fbSubRowSub}>
                Xác thực 2 bước, quản lý thiết bị & đăng nhập
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </TouchableOpacity>

          <View
            style={[
              styles.fbSubDivider,
              isDarkMode && { backgroundColor: colors.border },
            ]}
          />

          {/* Đổi mật khẩu */}
          <TouchableOpacity
            style={styles.fbAccordionSubRow}
            activeOpacity={0.7}
            onPress={onOpenChangePassword}
          >
            <View
              style={[
                styles.fbSubIconBox,
                { backgroundColor: '#FEE2E2' },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color="#EF4444"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.fbSubRowTitle,
                  isDarkMode && { color: colors.textPrimary },
                ]}
              >
                Đổi mật khẩu tài khoản
              </Text>
              <Text style={styles.fbSubRowSub}>
                Cập nhật mã bảo mật đăng nhập
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fbAccordionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  fbAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  fbAccordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fbAccordionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  fbAccordionBody: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  fbAccordionSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  fbSubIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbSubRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  fbSubRowSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  fbSubDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 46,
  },
});

